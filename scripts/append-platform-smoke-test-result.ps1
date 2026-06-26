param(
    [Parameter(Mandatory)] [string]$Platform,
    [Parameter(Mandatory)] [string]$OS,
    [Parameter(Mandatory)] [string]$Artifact,
    [string]$InstallStep,
    [string]$Launch = "Not Run",
    [string]$OpenArchive = "Not Run",
    [string]$Extract = "Not Run",
    [string]$DismissJob = "Not Run",
    [string]$Result = "Pending",
    [string]$CommitTag = "",
    [string]$Notes = "Not yet executed"
)

$resultsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "docs/platform-smoke-test-results.md"

function Escape-Cell([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return ""
    }
    return ($value -replace "`r|`n", " " -replace "\|", "\\|")
}

$platform = Escape-Cell $Platform
$os = Escape-Cell $OS
$artifact = Escape-Cell $Artifact
$installStep = Escape-Cell $InstallStep
$launch = Escape-Cell $Launch
$openArchive = Escape-Cell $OpenArchive
$extract = Escape-Cell $Extract
$dismissJob = Escape-Cell $DismissJob
$result = Escape-Cell $Result
$commitTag = Escape-Cell $CommitTag
$notes = Escape-Cell $Notes
$date = Get-Date -Format 'yyyy-MM-dd'

$line = "| $date | $platform | $os | $artifact | $installStep | $launch | $openArchive | $extract | $dismissJob | $result | $commitTag | $notes |"

if (-not (Test-Path $resultsPath)) {
    throw "Smoke-test matrix file not found: $resultsPath"
}

$content = Get-Content -Path $resultsPath
$insertIndex = [Array]::IndexOf($content, "## Required evidence per row")

if ($insertIndex -gt 0) {
    $updated = @()
    $updated += $content[0..($insertIndex - 1)]
    $updated += $line
    $updated += $content[$insertIndex..($content.Length - 1)]
    Set-Content -Path $resultsPath -Value $updated
} else {
    Add-Content -Path $resultsPath -Value $line
}

Write-Host "Appended smoke-test row to $resultsPath"
