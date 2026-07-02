param(
    [string]$VcpkgRoot = "C:\vcpkg",
    [string]$PerlBin = "C:\Strawberry\perl\bin",
    [string]$Triplet = "",
    [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "build-windows-static.ps1") `
    -VcpkgRoot $VcpkgRoot `
    -PerlBin $PerlBin `
    -Architecture x64 `
    -Triplet $Triplet `
    -NodePath $NodePath

exit $LASTEXITCODE
