param(
    [string]$SourceRoot = "..\ZManager\cli\tests\fixtures",
    [string]$Destination = "docs\fixtures"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourceRoot)) {
    Write-Host "Skipping fixture sync: source not found: $SourceRoot"
    exit 0
}

New-Item -ItemType Directory -Path $Destination -Force | Out-Null
Copy-Item -Recurse -Force -Path (Join-Path $SourceRoot "*") -Destination $Destination

Write-Host "Synced fixture corpus to $Destination from $SourceRoot"
