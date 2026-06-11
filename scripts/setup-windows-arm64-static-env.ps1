[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$VcpkgRoot = "C:\vcpkg",
    [string]$PerlBin = "C:\Strawberry\perl\bin",
    [string]$Triplet = "arm64-windows-static-md",
    [string]$Run
)

$ErrorActionPreference = "Stop"

$toolchainFile = Join-Path $VcpkgRoot "scripts\buildsystems\vcpkg.cmake"
$debugLib = Join-Path $VcpkgRoot "installed\$Triplet\debug\lib"
$releaseLib = Join-Path $VcpkgRoot "installed\$Triplet\lib"
$include = Join-Path $VcpkgRoot "installed\$Triplet\include"
$debugBin = Join-Path $VcpkgRoot "installed\$Triplet\debug\bin"
$releaseBin = Join-Path $VcpkgRoot "installed\$Triplet\bin"

if (-not (Test-Path $toolchainFile)) {
    throw "vcpkg toolchain file was not found: $toolchainFile"
}

if (-not (Test-Path $PerlBin)) {
    throw "Perl bin directory was not found: $PerlBin"
}

$env:VCPKG_INSTALLATION_ROOT = $VcpkgRoot
$env:VCPKG_ROOT = $VcpkgRoot
$env:CMAKE_TOOLCHAIN_FILE = $toolchainFile
$env:VCPKG_DEFAULT_TRIPLET = $Triplet
$env:VCPKG_TARGET_TRIPLET = $Triplet
$env:LIB = "$debugLib;$releaseLib;" + $env:LIB
$env:INCLUDE = "$include;" + $env:INCLUDE
$env:PATH = "$PerlBin;$debugBin;$releaseBin;" + $env:PATH

Write-Host "Configured Windows ARM64 static native build environment."
Write-Host "Triplet: $Triplet"
Write-Host "VCPKG_ROOT: $env:VCPKG_ROOT"
Write-Host "CMAKE_TOOLCHAIN_FILE: $env:CMAKE_TOOLCHAIN_FILE"

if (-not [string]::IsNullOrWhiteSpace($Run)) {
    Write-Host "Running: $Run"
    powershell -NoProfile -Command $Run
    exit $LASTEXITCODE
}
