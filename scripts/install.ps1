param(
    [string]$Target = ".",
    [string]$Agents = "auto",
    [switch]$Yes,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $root "bin\osd-workflow-init.mjs"
if (-not (Test-Path -LiteralPath $cli)) {
    throw "OSD CLI is missing: $cli"
}

$nodePath = if ($env:OSD_NODE -and (Test-Path -LiteralPath $env:OSD_NODE)) {
    $env:OSD_NODE
} else {
    (Get-Command node -ErrorAction Stop).Source
}

$arguments = @($cli, "init", $Target, "--agents", $Agents)
if ($Yes) { $arguments += "--yes" }
if ($DryRun) { $arguments += "--dry-run" }

& $nodePath @arguments
exit $LASTEXITCODE
