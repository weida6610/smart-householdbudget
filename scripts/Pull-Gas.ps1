$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "Backup-Gas.ps1")
& npx.cmd clasp pull

