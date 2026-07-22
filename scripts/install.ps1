param(
    [string]$Target = ".",
    [switch]$WithDocs,
    [switch]$Force,
    [switch]$Update,
    [switch]$DryRun,
    [string]$SourceArchiveUrl = "https://github.com/hpuhsp/OSD-Workflow/archive/refs/heads/main.zip"
)

$ErrorActionPreference = "Stop"

function Resolve-TemplateRoot {
    $scriptRoot = Split-Path -Parent $PSCommandPath
    $localRoot = Resolve-Path (Join-Path $scriptRoot "..") -ErrorAction SilentlyContinue

    if ($localRoot -and (Test-Path -LiteralPath (Join-Path $localRoot.Path ".ai"))) {
        return $localRoot.Path
    }

    $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("osd-workflow-" + [System.Guid]::NewGuid().ToString("N"))
    $archive = Join-Path $workDir "osd-workflow.zip"
    $extractDir = Join-Path $workDir "extract"

    New-Item -ItemType Directory -Path $workDir -Force | Out-Null
    Invoke-WebRequest -Uri $SourceArchiveUrl -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $extractDir -Force

    $root = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1
    if (-not $root -or -not (Test-Path -LiteralPath (Join-Path $root.FullName ".ai"))) {
        throw "Downloaded template archive does not contain .ai assets."
    }

    return $root.FullName
}

function Add-Result {
    param(
        [hashtable]$Summary,
        [string]$Key,
        [string]$Path
    )

    $Summary[$Key].Add($Path) | Out-Null
}

function Copy-TemplateEntry {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$TargetRoot,
        [hashtable]$Summary
    )

    $item = Get-Item -LiteralPath $Source -Force

    if ($item.PSIsContainer) {
        if (-not (Test-Path -LiteralPath $Destination)) {
            Add-Result $Summary "CreatedDirs" $Destination
            if (-not $DryRun) {
                New-Item -ItemType Directory -Path $Destination -Force | Out-Null
            }
        }

        Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
            Copy-TemplateEntry `
                -Source $_.FullName `
                -Destination (Join-Path $Destination $_.Name) `
                -TargetRoot $TargetRoot `
                -Summary $Summary
        }
        return
    }

    if ([System.IO.Path]::GetFullPath($Source) -eq [System.IO.Path]::GetFullPath($Destination)) {
        Add-Result $Summary "Skipped" $Destination
        return
    }

    if (Test-Path -LiteralPath $Destination) {
        if (-not ($Force -or $Update)) {
            Add-Result $Summary "Skipped" $Destination
            return
        }
        Add-Result $Summary "Overwritten" $Destination
    } else {
        Add-Result $Summary "CreatedFiles" $Destination
    }

    if (-not $DryRun) {
        $parent = Split-Path -Parent $Destination
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
    }
}

function Install-AgentEntry {
    param(
        [string]$Destination,
        [string]$Template,
        [hashtable]$Summary
    )

    $startMarker = "<!-- osd-workflow:start -->"
    $endMarker = "<!-- osd-workflow:end -->"
    $exists = Test-Path -LiteralPath $Destination
    $current = if ($exists) { [System.IO.File]::ReadAllText($Destination) } else { "" }
    $start = $current.IndexOf($startMarker, [System.StringComparison]::Ordinal)
    $end = $current.IndexOf($endMarker, [System.StringComparison]::Ordinal)

    if (($start -lt 0) -ne ($end -lt 0) -or ($start -ge 0 -and $end -lt $start)) {
        throw "Malformed OSD managed block in agent entry file: $Destination"
    }

    $block = $startMarker + "`n" + $Template.Trim() + "`n" + $endMarker
    if ($start -ge 0) {
        $after = $end + $endMarker.Length
        $next = $current.Substring(0, $start) + $block + $current.Substring($after)
    } elseif (-not [string]::IsNullOrWhiteSpace($current)) {
        $next = $current.TrimEnd() + "`n`n" + $block + "`n"
    } else {
        $next = $block + "`n"
    }

    if ($Destination.EndsWith(".mdc")) {
        $defaultFrontmatter = "---`ndescription: Use OSD Workflow as the top-level controller for repository changes`nalwaysApply: true`n---`n`n"
        if (-not $next.StartsWith("---")) {
            $next = $defaultFrontmatter + $next
        } else {
            $frontmatterEnd = $next.IndexOf("`n---", 3, [System.StringComparison]::Ordinal)
            if ($frontmatterEnd -lt 0) {
                throw "Malformed Cursor frontmatter in OSD agent entry file: $Destination"
            }
            $frontmatter = $next.Substring(0, $frontmatterEnd)
            if ($frontmatter -match "(?im)^alwaysApply:") {
                $frontmatter = [regex]::Replace($frontmatter, "(?im)^alwaysApply:.*$", "alwaysApply: true")
            } else {
                $frontmatter += "`nalwaysApply: true"
            }
            $next = $frontmatter + $next.Substring($frontmatterEnd)
        }
    }

    if ($next -ceq $current) {
        Add-Result $Summary "Skipped" $Destination
        return
    }

    if ($exists) {
        Add-Result $Summary "Overwritten" $Destination
    } else {
        Add-Result $Summary "CreatedFiles" $Destination
    }

    if (-not $DryRun) {
        $parent = Split-Path -Parent $Destination
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        [System.IO.File]::WriteAllText($Destination, $next, [System.Text.UTF8Encoding]::new($false))
    }
}

function Convert-ToRelativeDisplay {
    param(
        [string]$TargetRoot,
        [string]$Path
    )

    $root = [System.IO.Path]::GetFullPath($TargetRoot)
    if (-not $root.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $root += [System.IO.Path]::DirectorySeparatorChar
    }

    $rootUri = [System.Uri]::new($root)
    $pathUri = [System.Uri]::new([System.IO.Path]::GetFullPath($Path))
    $relative = [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString())
    return $relative -replace "/", "/"
}

$templateRoot = Resolve-TemplateRoot
if ([System.IO.Path]::IsPathRooted($Target)) {
    $targetRoot = [System.IO.Path]::GetFullPath($Target)
} else {
    $targetRoot = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Target))
}

if (-not (Test-Path -LiteralPath $targetRoot)) {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
    }
}

if ((Test-Path -LiteralPath $targetRoot) -and -not (Get-Item -LiteralPath $targetRoot).PSIsContainer) {
    throw "Target exists but is not a directory: $targetRoot"
}

if ($Update -and -not (Test-Path -LiteralPath (Join-Path $targetRoot ".ai\workflow-manifest.json"))) {
    throw "No existing OSD Workflow installation found at: $targetRoot"
}

$entries = @(".ai", "openspec", "knowledge", "scripts/verify-workflow-artifacts.mjs")
if ($WithDocs) {
    $entries += "docs"
}

$summary = @{
    CreatedDirs = [System.Collections.Generic.List[string]]::new()
    CreatedFiles = [System.Collections.Generic.List[string]]::new()
    Overwritten = [System.Collections.Generic.List[string]]::new()
    Skipped = [System.Collections.Generic.List[string]]::new()
}

foreach ($entry in $entries) {
    $source = Join-Path $templateRoot $entry
    $destination = Join-Path $targetRoot $entry

    if (-not (Test-Path -LiteralPath $source)) {
        throw "Template entry is missing: $entry"
    }

    Copy-TemplateEntry -Source $source -Destination $destination -TargetRoot $targetRoot -Summary $summary
}

$agentEntryTemplatePath = Join-Path $templateRoot ".ai\templates\agent-entry.md"
if (-not (Test-Path -LiteralPath $agentEntryTemplatePath)) {
    throw "Template entry is missing: .ai/templates/agent-entry.md"
}
$agentEntryTemplate = [System.IO.File]::ReadAllText($agentEntryTemplatePath)
$agentEntryFiles = @(
    "AGENTS.md"
)
foreach ($entry in $agentEntryFiles) {
    Install-AgentEntry -Destination (Join-Path $targetRoot $entry) -Template $agentEntryTemplate -Summary $summary
}

$action = if ($Update) { "Update" } else { "Initialization" }
$prefix = if ($DryRun) { "$action dry run complete" } else { "$action complete" }
Write-Host "$prefix`: $targetRoot"

$groups = @(
    @("Created directories", "CreatedDirs"),
    @("Created files", "CreatedFiles"),
    @("Overwritten files", "Overwritten"),
    @("Skipped existing files", "Skipped")
)

foreach ($group in $groups) {
    $label = $group[0]
    $key = $group[1]
    if ($summary[$key].Count -eq 0) {
        continue
    }

    Write-Host ""
    Write-Host "$label`:"
    foreach ($item in $summary[$key]) {
        Write-Host ("  - " + (Convert-ToRelativeDisplay -TargetRoot $targetRoot -Path $item))
    }
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Install or confirm the global OpenSpec CLI: npm install -g @fission-ai/openspec@latest."
Write-Host "  2. Run openspec init in the target project if it has not been initialized."
Write-Host "  3. Ensure Superpowers is available in each developer's AI agent or harness."
Write-Host "  4. Start a new agent session and describe the task normally; the generated agent entries activate OSD."
Write-Host "  5. If an agent does not load project instructions, use: Execute with OSD: <task>."
Write-Host "  6. Before handoff, run: node scripts/verify-workflow-artifacts.mjs --target . --feature <feature> --mode <mode>."
