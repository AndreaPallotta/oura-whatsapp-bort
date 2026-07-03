$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "=== Oura WhatsApp Bot Setup (Windows) ===" -ForegroundColor Cyan

# 1. Check for .env file
if (-not (Test-Path .env)) {
    Write-Host "Configuration file (.env) not found." -ForegroundColor Yellow
    Write-Host "Copying .env.example to .env..." -ForegroundColor Gray
    Copy-Item .env.example .env
    Write-Host "Please edit the .env file in your project folder and fill in your Oura credentials." -ForegroundColor Green
    Write-Host "After editing .env, run this setup script again." -ForegroundColor Yellow
    exit
}

# 2. Install dependencies
if (-not (Test-Path node_modules)) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Green
    npm install
} else {
    Write-Host "Dependencies already installed."
}

# 3. Run Oura authorization setup
Write-Host "Starting Oura Ring Authorization..." -ForegroundColor Green
npm run auth
