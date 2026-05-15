$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $Root "backups"
$BackupDir = Join-Path $BackupRoot $Stamp

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
Copy-Item -LiteralPath (Join-Path $Root "src") -Destination $BackupDir -Recurse -Force

Write-Host "Backed up src to $BackupDir"

