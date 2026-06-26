param(
    [switch]$SkipInstallerInstall,
    [switch]$SkipAppLaunch
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$logDir = Join-Path $repoRoot "target/release-gate"
$installDir = Join-Path $logDir "installed-app"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$transcriptPath = Join-Path $logDir "release-gate-windows-arm64-$timestamp.log"
$installerPath = Join-Path $repoRoot "src-tauri/target/release/bundle/nsis/ZManager_0.1.0_arm64-setup.exe"
$artifactPath = Join-Path $repoRoot "src-tauri/target/release/zmanager-desktop.exe"
$gateResult = "Pass"
$gateNotes = "Release gate passed. Log: $transcriptPath"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Invoke-GateStep([string]$Name, [scriptblock]$Script) {
    Write-Host ""
    Write-Host "== $Name =="
    & $Script
}

function Stop-GateProcess($Process) {
    if ($null -ne $Process -and -not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force
        $Process.WaitForExit(5000) | Out-Null
    }
}

Start-Transcript -Path $transcriptPath -Force | Out-Null

try {
    Invoke-GateStep "Frontend tests" {
        & "C:\Program Files\nodejs\npm.cmd" run test:frontend
    }

    Invoke-GateStep "Rust command tests in Windows ARM64 static environment" {
        $setupScript = Join-Path $repoRoot "scripts/setup-windows-arm64-static-env.ps1"
        & powershell -ExecutionPolicy Bypass -File $setupScript -Run "Set-Location src-tauri; cargo test"
    }

    Invoke-GateStep "Windows ARM64 static package build" {
        $buildScript = Join-Path $repoRoot "scripts/build-windows-arm64-static.ps1"
        & powershell -ExecutionPolicy Bypass -File $buildScript
    }

    Invoke-GateStep "Recovery smoke" {
        $smokeScript = Join-Path $repoRoot "scripts/smoke-windows-arm64.ps1"
        $smokeArgs = @(
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            $smokeScript,
            "-SkipResultAppend",
            "-LogDir",
            $logDir
        )
        if ($SkipAppLaunch) {
            $smokeArgs += "-SkipAppLaunch"
        }
        & powershell @smokeArgs
    }

    if (-not $SkipInstallerInstall) {
        Invoke-GateStep "Silent installer install and launch smoke" {
            if (-not (Test-Path $installerPath)) {
                throw "Installer not found: $installerPath"
            }

            if (Test-Path $installDir) {
                Remove-Item -LiteralPath $installDir -Recurse -Force
            }
            New-Item -ItemType Directory -Force -Path $installDir | Out-Null

            $installer = Start-Process `
                -FilePath $installerPath `
                -ArgumentList @("/S", "/D=$installDir") `
                -Wait `
                -PassThru `
                -WindowStyle Hidden
            if ($installer.ExitCode -ne 0) {
                throw "Installer smoke failed with exit code $($installer.ExitCode)"
            }

            $installedExe = Get-ChildItem -Path $installDir -Recurse -Filter "zmanager-desktop.exe" |
                Select-Object -First 1
            if ($null -eq $installedExe) {
                throw "Installed executable not found under $installDir"
            }

            $process = Start-Process -FilePath $installedExe.FullName -PassThru -WindowStyle Hidden
            try {
                Start-Sleep -Seconds 5
                if ($process.HasExited) {
                    throw "Installed app exited during launch smoke with code $($process.ExitCode)"
                }
            } finally {
                Stop-GateProcess $process
            }
        }
    } else {
        Invoke-GateStep "Installer smoke skipped" {
            Write-Host "Installer install/launch smoke skipped by -SkipInstallerInstall."
            if (-not (Test-Path $artifactPath)) {
                throw "Packaged executable missing: $artifactPath"
            }
        }
    }

    Invoke-GateStep "Release gate passed" {
        Write-Host "Release gate log: $transcriptPath"
    }
} catch {
    $gateResult = "Fail"
    $gateNotes = "Release gate failed: $($_.Exception.Message). Log: $transcriptPath"
    throw
} finally {
    Stop-Transcript | Out-Null
    $appendScript = Join-Path $repoRoot "scripts/append-platform-smoke-test-result.ps1"
    $artifact = if (Test-Path $installerPath) { $installerPath } elseif (Test-Path $artifactPath) { $artifactPath } else { "Not built" }
    & powershell -ExecutionPolicy Bypass -File $appendScript `
        -Platform "Windows ARM64" `
        -OS "Windows" `
        -Artifact $artifact `
        -InstallStep $(if ($SkipInstallerInstall) { "Installer install skipped; packaged exe launch checked" } else { "Silent installer install and launch" }) `
        -Launch $gateResult `
        -OpenArchive $gateResult `
        -Extract $gateResult `
        -DismissJob "Command smoke covered terminal jobs" `
        -Result $gateResult `
        -CommitTag "working-tree" `
        -Notes $gateNotes
}
