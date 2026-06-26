param(
    [switch]$SkipAppLaunch,
    [switch]$SkipResultAppend,
    [string]$LogDir
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

if ([string]::IsNullOrWhiteSpace($LogDir)) {
    $LogDir = Join-Path $repoRoot "target/release-gate"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$transcriptPath = Join-Path $LogDir "smoke-windows-arm64-$timestamp.log"
$artifactPath = Join-Path $repoRoot "src-tauri/target/release/zmanager-desktop.exe"
$installerPath = Join-Path $repoRoot "src-tauri/target/release/bundle/nsis/ZManager_0.1.0_arm64-setup.exe"

function Invoke-SmokeStep([string]$Name, [scriptblock]$Script) {
    Write-Host ""
    Write-Host "== $Name =="
    & $Script
}

function Stop-SmokeProcess($Process) {
    if ($null -ne $Process -and -not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force
        $Process.WaitForExit(5000) | Out-Null
    }
}

Start-Transcript -Path $transcriptPath -Force | Out-Null
$result = "Pass"
$notes = "Command smoke and app launch passed. Log: $transcriptPath"

try {
    Invoke-SmokeStep "Rust recovery smoke tests" {
        $setupScript = Join-Path $repoRoot "scripts/setup-windows-arm64-static-env.ps1"
        & powershell -ExecutionPolicy Bypass -File $setupScript -Run "Set-Location src-tauri; cargo test recovery_smoke -- --nocapture"
    }

    if (-not $SkipAppLaunch) {
        Invoke-SmokeStep "Launch packaged app executable" {
            if (-not (Test-Path $artifactPath)) {
                throw "Packaged app not found. Run scripts/build-windows-arm64-static.ps1 first: $artifactPath"
            }

            $process = Start-Process -FilePath $artifactPath -PassThru -WindowStyle Hidden
            try {
                Start-Sleep -Seconds 5
                if ($process.HasExited) {
                    throw "Packaged app exited during launch smoke with code $($process.ExitCode)"
                }
            } finally {
                Stop-SmokeProcess $process
            }
        }
    }
} catch {
    $result = "Fail"
    $notes = "Smoke failed: $($_.Exception.Message). Log: $transcriptPath"
    throw
} finally {
    Stop-Transcript | Out-Null
    if (-not $SkipResultAppend) {
        $appendScript = Join-Path $repoRoot "scripts/append-platform-smoke-test-result.ps1"
        $artifact = if (Test-Path $installerPath) { $installerPath } elseif (Test-Path $artifactPath) { $artifactPath } else { "Not built" }
        & powershell -ExecutionPolicy Bypass -File $appendScript `
            -Platform "Windows ARM64" `
            -OS "Windows" `
            -Artifact $artifact `
            -InstallStep "Packaged exe launch smoke" `
            -Launch $(if ($SkipAppLaunch) { "Skipped" } else { $result }) `
            -OpenArchive $result `
            -Extract $result `
            -DismissJob "Command smoke covered terminal jobs" `
            -Result $result `
            -CommitTag "working-tree" `
            -Notes $notes
    }
}
