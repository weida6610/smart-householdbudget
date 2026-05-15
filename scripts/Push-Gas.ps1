$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "Backup-Gas.ps1")
& npm.cmd test
& npx.cmd clasp push --force

