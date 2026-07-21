[CmdletBinding(PositionalBinding = $false)]
param(
    [switch]$SkipZmanager,
    [string]$ParentDir = ""
)

<#
.SYNOPSIS
Ensures tzap (and optionally zmanager) exist as sibling directories.

.DESCRIPTION
Clones the tzap repository into the parent directory of this repo so that
Cargo path dependencies in src-tauri/Cargo.toml and its vendored crates
can resolve. The zmanager sibling is only needed when zmanager-core is a
path dependency (local-dev mode); CI pins it to git instead.

Override defaults via environment variables:
  ZMANAGER_TZAP_REPO      – tzap repository URL
  ZMANAGER_TZAP_REF       – branch or tag to check out (default: v0.1.11)
  ZMANAGER_TZAP_DIR       – absolute path for tzap clone
  ZMANAGER_ZMANAGER_REPO  – zmanager repository URL
  ZMANAGER_ZMANAGER_REF   – branch or tag to check out (default: v1.0.7)
  ZMANAGER_ZMANAGER_DIR   – absolute path for zmanager clone

.Parameter ParentDir
Absolute path to the parent directory where tzap and zmanager should
be cloned. When building via build.bat with a subst drive, pass the
real (non-subst) parent path explicitly. If omitted, the script infers
the parent from its own location.
#>

$ErrorActionPreference = "Stop"

# Resolve the parent directory — prefer explicit -ParentDir (handles subst
# drives correctly), otherwise compute from the script's own location.
if ($ParentDir) {
    $parentDir = [System.IO.Path]::GetFullPath($ParentDir)
} else {
    $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
    $parentDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ".."))
}

$tzapRepo = if ($env:ZMANAGER_TZAP_REPO) { $env:ZMANAGER_TZAP_REPO } else { "https://github.com/tzap-org/tzap" }
$tzapRef = if ($env:ZMANAGER_TZAP_REF) { $env:ZMANAGER_TZAP_REF } else { "v0.1.11" }
$tzapDir = if ($env:ZMANAGER_TZAP_DIR) { $env:ZMANAGER_TZAP_DIR } else { Join-Path $parentDir "tzap" }

$zmanagerRepo = if ($env:ZMANAGER_ZMANAGER_REPO) { $env:ZMANAGER_ZMANAGER_REPO } else { "https://github.com/tzap-org/zmanager" }
$zmanagerRef = if ($env:ZMANAGER_ZMANAGER_REF) { $env:ZMANAGER_ZMANAGER_REF } else { "v1.0.7" }
$zmanagerDir = if ($env:ZMANAGER_ZMANAGER_DIR) { $env:ZMANAGER_ZMANAGER_DIR } else { Join-Path $parentDir "zmanager" }

function Invoke-Native {
    param(
        [string]$FilePath,
        [string[]]$Arguments = @()
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
}

function Resolve-GitCommand {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($git) { return $git.Source }
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) { return $git.Source }

    $candidates = @(
        "C:\Program Files\Git\cmd\git.exe",
        "C:\Program Files\Git\bin\git.exe",
        "C:\Program Files (x86)\Git\cmd\git.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }

    throw "Git was not found. Install Git for Windows, or put git.exe on PATH."
}

$git = Resolve-GitCommand

# ── tzap ───────────────────────────────────────────────────────────────

if (Test-Path $tzapDir) {
    Write-Host "tzap sibling found at: $tzapDir"
} else {
    Write-Host "Cloning tzap ($tzapRef) into: $tzapDir"
    Invoke-Native -FilePath $git -Arguments @(
        "clone", "--depth", "1", "--branch", $tzapRef, $tzapRepo, $tzapDir
    )
    Write-Host "tzap clone complete."
}

# ── zmanager ───────────────────────────────────────────────────────────

if ($SkipZmanager) {
    Write-Host "Skipping zmanager sibling (-SkipZmanager)."
    exit 0
}

if (Test-Path $zmanagerDir) {
    Write-Host "zmanager sibling found at: $zmanagerDir"
} else {
    Write-Host "Cloning zmanager ($zmanagerRef) into: $zmanagerDir"
    Invoke-Native -FilePath $git -Arguments @(
        "clone", "--depth", "1", "--branch", $zmanagerRef, $zmanagerRepo, $zmanagerDir
    )
    Write-Host "zmanager clone complete."
}
