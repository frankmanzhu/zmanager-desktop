[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$VcpkgRoot = "C:\vcpkg",
    [string]$PerlBin = "C:\Strawberry\perl\bin",
    [ValidateSet("Auto", "x64", "arm64")]
    [string]$Architecture = "Auto",
    [string]$Triplet = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Resolve-TargetArchitecture {
    param([string]$RequestedArchitecture)

    if ($RequestedArchitecture -ne "Auto") {
        return $RequestedArchitecture
    }

    $rustc = Get-Command "rustc.exe" -ErrorAction SilentlyContinue
    if (-not $rustc) {
        $rustc = Get-Command "rustc" -ErrorAction Stop
    }
    $hostLine = & $rustc.Source -vV | Where-Object { $_ -like "host: *" } | Select-Object -First 1
    if ($hostLine -like "*aarch64*") {
        return "arm64"
    }
    if ($hostLine -like "*x86_64*") {
        return "x64"
    }

    throw "Could not determine the Rust Windows target architecture. Pass -Architecture x64 or -Architecture arm64."
}

$resolvedArchitecture = Resolve-TargetArchitecture -RequestedArchitecture $Architecture
$targetTriple = if ($resolvedArchitecture -eq "arm64") {
    "aarch64-pc-windows-msvc"
} else {
    "x86_64-pc-windows-msvc"
}

if (-not $env:CARGO_TARGET_DIR) {
    $env:CARGO_TARGET_DIR = Join-Path $env:USERPROFILE ".zmbuild"
}

# This is the same environment initializer used by scripts\build.bat. It
# must be dot-sourced so vcpkg/MSVC variables remain available to both the
# Tauri build and the WDIO process in this PowerShell session.
. (Join-Path $PSScriptRoot "setup-windows-static-env.ps1") `
    -VcpkgRoot $VcpkgRoot `
    -PerlBin $PerlBin `
    -Architecture $resolvedArchitecture `
    -Triplet $Triplet

$node = Get-Command "node.exe" -ErrorAction Stop
$npm = Get-Command "npm.cmd" -ErrorAction Stop
$tauriCli = Join-Path $repoRoot "node_modules\@tauri-apps\cli\tauri.js"
$guiConfig = Join-Path $repoRoot "src-tauri\tauri.gui.conf.json"
$guiBinary = Join-Path $env:CARGO_TARGET_DIR "$targetTriple\debug\zmanager-desktop.exe"

if (-not (Test-Path $tauriCli)) {
    throw "Tauri CLI was not found at $tauriCli. Run npm install first."
}

Write-Host "Building Windows GUI test binary: $guiBinary"
& $node.Source $tauriCli build --debug --no-bundle --config $guiConfig --target $targetTriple
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if (-not (Test-Path $guiBinary)) {
    throw "The debug GUI binary was not produced at $guiBinary."
}

$env:ZMANAGER_GUI_APP_PATH = (Resolve-Path $guiBinary).Path
$webviewUserData = Join-Path $env:TEMP "zmanager-gui-webview2-$PID"
New-Item -ItemType Directory -Force -Path $webviewUserData | Out-Null
$env:WEBVIEW2_USER_DATA_FOLDER = $webviewUserData
Write-Host "Using isolated WebView2 GUI profile: $webviewUserData"
Write-Host "Running native Windows GUI tests against $env:ZMANAGER_GUI_APP_PATH"
& $npm.Source run test:gui:run
exit $LASTEXITCODE
