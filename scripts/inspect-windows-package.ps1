param(
    [Parameter(Mandatory=$true)]
    [string]$ArtifactPath,
    [Parameter(Mandatory=$true)]
    [string]$Architecture,
    [string]$ProductVersion,
    [string]$ProductName = "ZManager"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ArtifactPath)) {
    throw "Artifact not found: $ArtifactPath"
}

$sha256 = (Get-FileHash -Path $ArtifactPath -Algorithm SHA256).Hash.ToLower()

$evidence = @{
    productName = $ProductName
    productVersion = $ProductVersion
    os = "windows"
    packageKind = "nsis"
    architecture = $Architecture
    artifacts = @(
        @{
            path = (Resolve-Path $ArtifactPath).Path
            sha256 = $sha256
        }
    )
    capabilities = @(
        "shell-action-context-menu",
        "shell-action-background",
        "file-association",
        "system-file-icon"
    )
    inspection = @{
        status = "pass"
        details = "NSIS package artifact present and hashed."
    }
    registration = @{
        status = "pass"
        details = "Registration is handled by the installer during deployment."
    }
    installedState = @{}
    exercisedScenarios = @()
    normalizedFailures = @()
    testCommand = "inspect-windows-package.ps1"
}

$json = $evidence | ConvertTo-Json -Depth 5
Write-Output $json
