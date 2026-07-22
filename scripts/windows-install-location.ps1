function ConvertTo-ZManagerAbsoluteInstallDirectory {
    param([string]$InstallDirectory)

    if ([string]::IsNullOrWhiteSpace($InstallDirectory)) {
        return $null
    }

    $trimmedDirectory = $InstallDirectory.Trim().Trim('"')
    if ([string]::IsNullOrWhiteSpace($trimmedDirectory)) {
        return $null
    }

    $absoluteDirectory = [System.IO.Path]::GetFullPath($trimmedDirectory)
    if (Test-Path -LiteralPath $absoluteDirectory) {
        return (Resolve-Path -LiteralPath $absoluteDirectory).Path
    }

    return $absoluteDirectory
}

function Read-ZManagerRegistryValue {
    param(
        [string]$RegistryPath,
        [string]$ValueName
    )

    if (-not (Test-Path -LiteralPath $RegistryPath)) {
        return $null
    }

    $registryKey = Get-Item -LiteralPath $RegistryPath
    return $registryKey.GetValue($ValueName)
}

function Get-ZManagerRegisteredInstallDirectory {
    param([scriptblock]$RegistryValueReader)

    if ($null -eq $RegistryValueReader) {
        $RegistryValueReader = ${function:Read-ZManagerRegistryValue}
    }

    $locations = @(
        @{
            Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ZManager"
            Name = "InstallLocation"
        },
        @{
            Path = "HKCU:\Software\frankmanzhu\ZManager"
            Name = ""
        }
    )

    foreach ($location in $locations) {
        $registeredValue = & $RegistryValueReader $location.Path $location.Name
        $resolvedValue = ConvertTo-ZManagerAbsoluteInstallDirectory -InstallDirectory $registeredValue
        if ($resolvedValue) {
            return $resolvedValue
        }
    }

    return $null
}

function Resolve-ZManagerInstallDirectory {
    param(
        [string]$RequestedInstallDir,
        [scriptblock]$RegistryValueReader
    )

    $explicitDirectory = ConvertTo-ZManagerAbsoluteInstallDirectory -InstallDirectory $RequestedInstallDir
    if ($explicitDirectory) {
        return $explicitDirectory
    }

    if ($null -eq $RegistryValueReader) {
        return Get-ZManagerRegisteredInstallDirectory
    }

    return Get-ZManagerRegisteredInstallDirectory -RegistryValueReader $RegistryValueReader
}

function New-ZManagerNsisInstallArguments {
    param([string]$InstallDirectory)

    $arguments = @("/S")
    if (-not [string]::IsNullOrWhiteSpace($InstallDirectory)) {
        # NSIS requires /D to be the final installer argument.
        $arguments += "/D=$InstallDirectory"
    }

    return $arguments
}
