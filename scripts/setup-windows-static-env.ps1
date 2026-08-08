[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$VcpkgRoot = "C:\vcpkg",
    [string]$PerlBin = "C:\Strawberry\perl\bin",
    [ValidateSet("Auto", "x64", "arm64")]
    [string]$Architecture = "Auto",
    [string]$Triplet = "",
    [string]$Run
)

$ErrorActionPreference = "Stop"

function Resolve-WindowsStaticArchitecture {
    param([string]$RequestedArchitecture)

    if ($RequestedArchitecture -ne "Auto") {
        return $RequestedArchitecture
    }

    $architecture = $env:PROCESSOR_ARCHITECTURE
    if ($architecture -eq "ARM64") {
        return "arm64"
    }
    if ($architecture -eq "AMD64") {
        return "x64"
    }

    throw "Could not determine Windows build architecture from PROCESSOR_ARCHITECTURE='$architecture'. Pass -Architecture x64 or -Architecture arm64."
}

function Resolve-WindowsStaticTriplet {
    param(
        [string]$RequestedTriplet,
        [string]$ResolvedArchitecture
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedTriplet)) {
        return $RequestedTriplet
    }

    if ($ResolvedArchitecture -eq "arm64") {
        return "arm64-windows-static-md"
    }

    return "x64-windows-static-md"
}

function Resolve-PerlBin {
    param([string]$RequestedPerlBin)

    if ((Test-Path (Join-Path $RequestedPerlBin "perl.exe"))) {
        return (Resolve-Path $RequestedPerlBin).Path
    }

    $perl = Get-Command "perl.exe" -ErrorAction SilentlyContinue
    if (-not $perl) {
        $perl = Get-Command "perl" -ErrorAction SilentlyContinue
    }
    if ($perl) {
        return (Split-Path $perl.Source -Parent)
    }

    throw "Perl was not found at $RequestedPerlBin or on PATH. Install Strawberry Perl, or pass -PerlBin C:\path\to\perl\bin."
}

function Resolve-CargoBin {
    $cargo = Get-Command "cargo.exe" -ErrorAction SilentlyContinue
    if (-not $cargo) {
        $cargo = Get-Command "cargo" -ErrorAction SilentlyContinue
    }
    if ($cargo) {
        return (Split-Path $cargo.Source -Parent)
    }

    $defaultCargo = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
    if (Test-Path $defaultCargo) {
        return (Split-Path (Resolve-Path $defaultCargo).Path -Parent)
    }

    throw "Rust Cargo was not found on PATH or at $defaultCargo. Install Rust with the MSVC toolchain, then reopen the shell."
}

$resolvedArchitecture = Resolve-WindowsStaticArchitecture -RequestedArchitecture $Architecture
$Triplet = Resolve-WindowsStaticTriplet -RequestedTriplet $Triplet -ResolvedArchitecture $resolvedArchitecture
$resolvedPerlBin = Resolve-PerlBin -RequestedPerlBin $PerlBin
$resolvedCargoBin = Resolve-CargoBin

$toolchainFile = Join-Path $VcpkgRoot "scripts\buildsystems\vcpkg.cmake"
$debugLib = Join-Path $VcpkgRoot "installed\$Triplet\debug\lib"
$releaseLib = Join-Path $VcpkgRoot "installed\$Triplet\lib"
$include = Join-Path $VcpkgRoot "installed\$Triplet\include"
$debugBin = Join-Path $VcpkgRoot "installed\$Triplet\debug\bin"
$releaseBin = Join-Path $VcpkgRoot "installed\$Triplet\bin"

if (-not (Test-Path $toolchainFile)) {
    throw "vcpkg toolchain file was not found: $toolchainFile. Install vcpkg at $VcpkgRoot and run $VcpkgRoot\bootstrap-vcpkg.bat."
}

if ((-not (Test-Path $include)) -or (-not (Test-Path $debugLib)) -or (-not (Test-Path $releaseLib))) {
    $vcpkgExe = Join-Path $VcpkgRoot "vcpkg.exe"
    throw "vcpkg dependencies were not found for triplet '$Triplet'. Run: $vcpkgExe install zlib bzip2 liblzma zstd lz4 openssl --triplet $Triplet"
}

$env:VCPKG_INSTALLATION_ROOT = $VcpkgRoot
$env:VCPKG_ROOT = $VcpkgRoot
$env:CMAKE_TOOLCHAIN_FILE = $toolchainFile
$env:VCPKG_DEFAULT_TRIPLET = $Triplet
$env:VCPKG_TARGET_TRIPLET = $Triplet
$env:LIB = "$debugLib;$releaseLib;" + $env:LIB
$env:INCLUDE = "$include;" + $env:INCLUDE
$env:PATH = "$resolvedCargoBin;$resolvedPerlBin;$debugBin;$releaseBin;" + $env:PATH

if ($resolvedArchitecture -eq "arm64") {
    $env:CC_aarch64_pc_windows_msvc = "cl.exe"
    $env:AR_aarch64_pc_windows_msvc = "lib.exe"
}

Write-Host "Configured Windows static native build environment."
Write-Host "Architecture: $resolvedArchitecture"
Write-Host "Triplet: $Triplet"
Write-Host "Perl bin: $resolvedPerlBin"
Write-Host "Cargo bin: $resolvedCargoBin"
Write-Host "VCPKG_ROOT: $env:VCPKG_ROOT"
Write-Host "CMAKE_TOOLCHAIN_FILE: $env:CMAKE_TOOLCHAIN_FILE"

if (-not [string]::IsNullOrWhiteSpace($Run)) {
    Write-Host "Running: $Run"
    powershell -NoProfile -Command $Run
    exit $LASTEXITCODE
}
