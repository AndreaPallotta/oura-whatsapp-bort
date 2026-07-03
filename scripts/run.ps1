param (
    [Alias("t")]
    [switch]$Test,

    [Alias("d")]
    [switch]$Dry,

    [Alias("f")]
    [switch]$Force
)

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if ((-not (Test-Path .env)) -or (-not (Test-Path node_modules)) -or (-not (Test-Path state.json))) {
    Write-Host "Error: Bot is not configured yet." -ForegroundColor Red
    Write-Host "Please make sure you have created your .env file and completed the setup: .\scripts\setup.ps1" -ForegroundColor Yellow
    exit 1
}

# Build arguments list matching node flags
$cmdArgs = @()
if ($Test) { $cmdArgs += "--test-send" }
if ($Dry)  { $cmdArgs += "--dry-run" }
if ($Force) { $cmdArgs += "--force" }

# Execute node process
node index.js $cmdArgs
