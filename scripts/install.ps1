param(
    [string]$Target = ".",
    [string[]]$Agents,
    [switch]$Yes,
    [switch]$DryRun,
    [switch]$WithDocs,
    [switch]$Force,
    [switch]$Update
)

$ErrorActionPreference = "Stop"

if ($WithDocs -or $Force -or $Update) {
    Write-Warning "OSD 2.0 no longer copies a project template; -WithDocs, -Force, and -Update are ignored."
}

$root = (Resolve-Path (Join-Path (Split-Path -Parent $PSCommandPath) "..")).Path
$cli = Join-Path $root "bin\osd-workflow-init.mjs"
$arguments = @($cli, "init", "--target", $Target)

if ($Agents -and $Agents.Count -gt 0) {
    $arguments += @("--agents", ($Agents -join ","))
}
if ($Yes) { $arguments += "--yes" }
if ($DryRun) { $arguments += "--dry-run" }

& node @arguments
exit $LASTEXITCODE
