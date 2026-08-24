[CmdletBinding(PositionalBinding = $false)]
param(
    [switch]$SkipZmanager,
    [string]$ParentDir = ""
)

<#
.SYNOPSIS
Ensures all required sibling repositories exist and are kept up to date.

.DESCRIPTION
Clones and updates sibling repositories (tzap, zmanager, forensic-vfs-engine,
iso9660-forensic, ntfs-forensic, udf-forensic, dpp) into the parent directory of this repo so
that Cargo path dependencies and bindings resolve.

Override defaults via environment variables:
  ZMANAGER_TZAP_REPO                 – tzap repository URL
  ZMANAGER_TZAP_REF                  – branch or tag to check out (default: main)
  ZMANAGER_TZAP_DIR                  – absolute path for tzap clone
  ZMANAGER_ZMANAGER_REPO             – zmanager repository URL
  ZMANAGER_ZMANAGER_REF              – branch or tag to check out (default: main)
  ZMANAGER_ZMANAGER_DIR              – absolute path for zmanager clone
  ZMANAGER_FORENSIC_VFS_ENGINE_REPO  – forensic-vfs-engine repository URL
  ZMANAGER_FORENSIC_VFS_ENGINE_REF   – branch or tag to check out (default: main)
  ZMANAGER_FORENSIC_VFS_ENGINE_DIR   – absolute path for forensic-vfs-engine clone
  ZMANAGER_ISO9660_FORENSIC_REPO     – iso9660-forensic repository URL
  ZMANAGER_ISO9660_FORENSIC_REF      – branch or tag to check out (default: PR branch)
  ZMANAGER_ISO9660_FORENSIC_DIR      – absolute path for iso9660-forensic clone
  ZMANAGER_NTFS_FORENSIC_REPO        – ntfs-forensic repository URL
  ZMANAGER_NTFS_FORENSIC_REF         – branch or tag to check out (default: main)
  ZMANAGER_NTFS_FORENSIC_DIR         – absolute path for ntfs-forensic clone
  ZMANAGER_UDF_FORENSIC_REPO         – udf-forensic repository URL
  ZMANAGER_UDF_FORENSIC_REF          – branch or tag to check out (default: main)
  ZMANAGER_UDF_FORENSIC_DIR          – absolute path for udf-forensic clone
  ZMANAGER_DPP_REPO                  – dpp repository URL
  ZMANAGER_DPP_REF                   – branch or tag to check out (default: main)
  ZMANAGER_DPP_DIR                   – absolute path for dpp clone

.Parameter ParentDir
Absolute path to the parent directory where sibling repositories should
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
$tzapRef = if ($env:ZMANAGER_TZAP_REF) { $env:ZMANAGER_TZAP_REF } else { "main" }
$tzapDir = if ($env:ZMANAGER_TZAP_DIR) { $env:ZMANAGER_TZAP_DIR } else { Join-Path $parentDir "tzap" }

$zmanagerRepo = if ($env:ZMANAGER_ZMANAGER_REPO) { $env:ZMANAGER_ZMANAGER_REPO } else { "https://github.com/tzap-org/zmanager" }
$zmanagerRef = if ($env:ZMANAGER_ZMANAGER_REF) { $env:ZMANAGER_ZMANAGER_REF } else { "main" }
$zmanagerDir = if ($env:ZMANAGER_ZMANAGER_DIR) { $env:ZMANAGER_ZMANAGER_DIR } else { Join-Path $parentDir "zmanager" }

$forensicVfsEngineRepo = if ($env:ZMANAGER_FORENSIC_VFS_ENGINE_REPO) { $env:ZMANAGER_FORENSIC_VFS_ENGINE_REPO } else { "https://github.com/frankmanzhu/forensic-vfs-engine" }
$forensicVfsEngineRef = if ($env:ZMANAGER_FORENSIC_VFS_ENGINE_REF) { $env:ZMANAGER_FORENSIC_VFS_ENGINE_REF } else { "main" }
$forensicVfsEngineDir = if ($env:ZMANAGER_FORENSIC_VFS_ENGINE_DIR) { $env:ZMANAGER_FORENSIC_VFS_ENGINE_DIR } else { Join-Path $parentDir "forensic-vfs-engine" }

$iso9660ForensicRepo = if ($env:ZMANAGER_ISO9660_FORENSIC_REPO) { $env:ZMANAGER_ISO9660_FORENSIC_REPO } else { "https://github.com/frankmanzhu/iso9660-forensic" }
$iso9660ForensicRef = if ($env:ZMANAGER_ISO9660_FORENSIC_REF) { $env:ZMANAGER_ISO9660_FORENSIC_REF } else { "macos/fix-hybrid-session-selection" }
$iso9660ForensicDir = if ($env:ZMANAGER_ISO9660_FORENSIC_DIR) { $env:ZMANAGER_ISO9660_FORENSIC_DIR } else { Join-Path $parentDir "iso9660-forensic" }

$ntfsForensicRepo = if ($env:ZMANAGER_NTFS_FORENSIC_REPO) { $env:ZMANAGER_NTFS_FORENSIC_REPO } else { "https://github.com/frankmanzhu/ntfs-forensic" }
$ntfsForensicRef = if ($env:ZMANAGER_NTFS_FORENSIC_REF) { $env:ZMANAGER_NTFS_FORENSIC_REF } else { "main" }
$ntfsForensicDir = if ($env:ZMANAGER_NTFS_FORENSIC_DIR) { $env:ZMANAGER_NTFS_FORENSIC_DIR } else { Join-Path $parentDir "ntfs-forensic" }

$udfForensicRepo = if ($env:ZMANAGER_UDF_FORENSIC_REPO) { $env:ZMANAGER_UDF_FORENSIC_REPO } else { "https://github.com/frankmanzhu/udf-forensic" }
$udfForensicRef = if ($env:ZMANAGER_UDF_FORENSIC_REF) { $env:ZMANAGER_UDF_FORENSIC_REF } else { "main" }
$udfForensicDir = if ($env:ZMANAGER_UDF_FORENSIC_DIR) { $env:ZMANAGER_UDF_FORENSIC_DIR } else { Join-Path $parentDir "udf-forensic" }

$dppRepo = if ($env:ZMANAGER_DPP_REPO) { $env:ZMANAGER_DPP_REPO } else { "https://github.com/frankmanzhu/dpp" }
$dppRef = if ($env:ZMANAGER_DPP_REF) { $env:ZMANAGER_DPP_REF } else { "main" }
$dppDir = if ($env:ZMANAGER_DPP_DIR) { $env:ZMANAGER_DPP_DIR } else { Join-Path $parentDir "dpp" }

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

function Ensure-SiblingRepo {
    param(
        [string]$Name,
        [string]$Directory,
        [string]$RepoUrl,
        [string]$BranchRef
    )

    if (Test-Path $Directory) {
        Write-Host "$Name sibling found at: $Directory"
        if (Test-Path (Join-Path $Directory ".git")) {
            Write-Host "Updating $Name repository at: $Directory"
            try {
                Invoke-Native -FilePath $git -Arguments @("-C", $Directory, "pull")
            } catch {
                Write-Host "Warning: git pull failed for $Name at ${Directory}: $_"
            }
        }
    } else {
        Write-Host "Cloning $Name ($BranchRef) into: $Directory"
        Invoke-Native -FilePath $git -Arguments @(
            "clone", "--depth", "1", "--branch", $BranchRef, $RepoUrl, $Directory
        )
        Write-Host "$Name clone complete."
    }
}

# ── zmanager-desktop ───────────────────────────────────────────────────

$zmanagerDesktopDir = if ($env:ZMANAGER_DESKTOP_DIR) { $env:ZMANAGER_DESKTOP_DIR } else { Join-Path $parentDir "zmanager-desktop" }

if (Test-Path (Join-Path $repoRoot ".git")) {
    Write-Host "Updating zmanager-desktop repository at: $repoRoot"
    try {
        Invoke-Native -FilePath $git -Arguments @("-C", $repoRoot, "pull")
    } catch {
        Write-Host "Warning: git pull failed for zmanager-desktop at ${repoRoot}: $_"
    }
}

if ($zmanagerDesktopDir -ne $repoRoot -and (Test-Path (Join-Path $zmanagerDesktopDir ".git"))) {
    Write-Host "Updating sibling zmanager-desktop repository at: $zmanagerDesktopDir"
    try {
        Invoke-Native -FilePath $git -Arguments @("-C", $zmanagerDesktopDir, "pull")
    } catch {
        Write-Host "Warning: git pull failed for zmanager-desktop at ${zmanagerDesktopDir}: $_"
    }
}

# ── tzap ───────────────────────────────────────────────────────────────
Ensure-SiblingRepo -Name "tzap" -Directory $tzapDir -RepoUrl $tzapRepo -BranchRef $tzapRef

# ── zmanager ───────────────────────────────────────────────────────────
if (-not $SkipZmanager) {
    Ensure-SiblingRepo -Name "zmanager" -Directory $zmanagerDir -RepoUrl $zmanagerRepo -BranchRef $zmanagerRef
} else {
    Write-Host "Skipping zmanager sibling (-SkipZmanager)."
}

# ── forensic-vfs-engine ────────────────────────────────────────────────
Ensure-SiblingRepo -Name "forensic-vfs-engine" -Directory $forensicVfsEngineDir -RepoUrl $forensicVfsEngineRepo -BranchRef $forensicVfsEngineRef

# ── iso9660-forensic ────────────────────────────────────────────────────
Ensure-SiblingRepo -Name "iso9660-forensic" -Directory $iso9660ForensicDir -RepoUrl $iso9660ForensicRepo -BranchRef $iso9660ForensicRef

# ── ntfs-forensic ──────────────────────────────────────────────────────
Ensure-SiblingRepo -Name "ntfs-forensic" -Directory $ntfsForensicDir -RepoUrl $ntfsForensicRepo -BranchRef $ntfsForensicRef

# ── udf-forensic ───────────────────────────────────────────────────────
Ensure-SiblingRepo -Name "udf-forensic" -Directory $udfForensicDir -RepoUrl $udfForensicRepo -BranchRef $udfForensicRef

# ── dpp ────────────────────────────────────────────────────────────────
Ensure-SiblingRepo -Name "dpp" -Directory $dppDir -RepoUrl $dppRepo -BranchRef $dppRef
