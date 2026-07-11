param(
    [ValidateSet("Auto", "x64", "arm64")]
    [string]$Architecture = "Auto",
    [switch]$RunTests
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $repoRoot "native\windows-shell-extension\Cargo.toml"
$targetRoot = Join-Path $repoRoot "target\windows-shell-extension"
$cargoTargetDir = Join-Path $targetRoot "build"
$outputPath = Join-Path $targetRoot "zmanager-shell-extension.dll"

if ($Architecture -eq "Auto") {
    $Architecture = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
}

$targetTriple = if ($Architecture -eq "arm64") {
    "aarch64-pc-windows-msvc"
} else {
    "x86_64-pc-windows-msvc"
}

if ($RunTests) {
    & cargo test --manifest-path $manifestPath
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

& cargo build `
    --manifest-path $manifestPath `
    --release `
    --target $targetTriple `
    --target-dir $cargoTargetDir
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$builtDll = Join-Path $cargoTargetDir "$targetTriple\release\zmanager_shell_extension.dll"
if (-not (Test-Path $builtDll)) {
    throw "Windows shell extension build did not produce: $builtDll"
}

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
Copy-Item -LiteralPath $builtDll -Destination $outputPath -Force

Write-Host "Built Windows shell extension."
Write-Host "Architecture: $Architecture"
Write-Host "Artifact: $outputPath"
