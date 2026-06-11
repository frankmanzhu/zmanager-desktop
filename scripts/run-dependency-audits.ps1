param(
    [string]$OutputDir = "docs/reports"
)

$ErrorActionPreference = "Continue"

$timestamp = Get-Date -Format "yyyy-MM-dd"
$outputPath = Join-Path $OutputDir "dependency-audit-$timestamp.md"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$lines = @()
$lines += "# Dependency and license audit ($timestamp)"
$lines += ""
$lines += "## Frontend dependencies"
$lines += ""

Set-Location (Split-Path $PSScriptRoot -Parent)
$lines += "## `npm ls --depth 0`"
$lines += '```'
$lines += & npm ls --depth 0 2>&1 | ForEach-Object { $_ } | Out-String
$lines += '```'
$lines += ""
$lines += "## `npm audit --audit-level high`"
$lines += '```'
$lines += & npm audit --audit-level high 2>&1 | ForEach-Object { $_ } | Out-String
$lines += '```'
$lines += ""

$lines += "## Rust dependencies"
$lines += ""
Push-Location src-tauri
$lines += "### `cargo tree --depth 1`"
$lines += '```'
$lines += & cargo tree --depth 1 2>&1 | ForEach-Object { $_ } | Out-String
$lines += '```'
$lines += ""
$lines += "### `cargo audit`"
$lines += '```'
$lines += & cargo audit 2>&1 | ForEach-Object { $_ } | Out-String
$lines += '```'
Pop-Location

$content = $lines -join "`r`n"
Set-Content -Path $outputPath -Value $content -Encoding UTF8
Write-Host "Saved dependency and license audit report to $outputPath"

