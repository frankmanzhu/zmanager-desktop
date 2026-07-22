$ErrorActionPreference = "Stop"

$helperPath = Join-Path $PSScriptRoot "windows-install-location.ps1"
. $helperPath

function Assert-Equal {
    param(
        [object]$Expected,
        [object]$Actual,
        [string]$Message
    )

    if ($Expected -ne $Actual) {
        throw "$Message Expected '$Expected', received '$Actual'."
    }
}

$registeredPath = "C:\Software\ZManager"
$registeredReader = {
    param([string]$RegistryPath, [string]$ValueName)

    if ($RegistryPath -like "*\Uninstall\ZManager" -and $ValueName -eq "InstallLocation") {
        return '"C:\Software\ZManager"'
    }
    return $null
}

$resolvedRegistered = Resolve-ZManagerInstallDirectory `
    -RequestedInstallDir "" `
    -RegistryValueReader $registeredReader
Assert-Equal $registeredPath $resolvedRegistered "The registered installation must be reused."

$explicitPath = "C:\Explicit\ZManager"
$unexpectedRegistryRead = {
    throw "The registry must not be consulted when -InstallDir is explicit."
}
$resolvedExplicit = Resolve-ZManagerInstallDirectory `
    -RequestedInstallDir $explicitPath `
    -RegistryValueReader $unexpectedRegistryRead
Assert-Equal $explicitPath $resolvedExplicit "An explicit install directory must win."

$legacyReader = {
    param([string]$RegistryPath, [string]$ValueName)

    if ($RegistryPath -eq "HKCU:\Software\frankmanzhu\ZManager" -and $ValueName -eq "") {
        return "C:\Legacy\ZManager"
    }
    return $null
}
$resolvedLegacy = Resolve-ZManagerInstallDirectory `
    -RequestedInstallDir "" `
    -RegistryValueReader $legacyReader
Assert-Equal "C:\Legacy\ZManager" $resolvedLegacy "The NSIS product-location key must remain a compatibility fallback."

$missingReader = {
    return $null
}
$resolvedMissing = Resolve-ZManagerInstallDirectory `
    -RequestedInstallDir "" `
    -RegistryValueReader $missingReader
Assert-Equal $null $resolvedMissing "A fresh install must leave the directory choice to NSIS."

$arguments = New-ZManagerNsisInstallArguments -InstallDirectory $registeredPath
Assert-Equal 2 $arguments.Count "An existing install must produce two NSIS arguments."
Assert-Equal "/S" $arguments[0] "The build install must remain silent."
Assert-Equal "/D=C:\Software\ZManager" $arguments[1] "The registered directory must be passed explicitly to NSIS."

Write-Host "Windows install-location regression tests passed."
