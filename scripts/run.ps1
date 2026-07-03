$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if ((-not (Test-Path .env)) -or (-not (Test-Path node_modules)) -or (-not (Test-Path state.json))) {
    Write-Host "Error: Bot is not configured yet." -ForegroundColor Red
    Write-Host "Please make sure you have created your .env file and completed the setup: .\scripts\setup.ps1" -ForegroundColor Yellow
    exit 1
}

# Pass all arguments directly
npm start -- $args
