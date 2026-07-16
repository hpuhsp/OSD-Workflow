param(
    [string]$Target = ".",
    [switch]$WithDocs,
    [switch]$Force,
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

    if (Test-Path -LiteralPath $Destination) {
        if (-not $Force) {
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

$entries = @(".ai", "openspec", "knowledge")
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

$prefix = if ($DryRun) { "Dry run complete" } else { "Initialization complete" }
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
Write-Host "  1. Configure project-level OpenSpec in the target project."
Write-Host "  2. Ensure user-level Superpowers is available for each developer."
Write-Host "  3. Start from .ai/workflows/feature-development.yaml for feature work."
