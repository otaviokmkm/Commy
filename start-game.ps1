# PowerShell script to start the MMORPG server
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "    STARTING WORKING MMORPG SERVER" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
Write-Host ""

# Copy package.json to the right name
if (Test-Path "package-fixed.json") {
    Copy-Item "package-fixed.json" "package.json" -Force
    Write-Host "✅ Package.json configured" -ForegroundColor Green
}

# Install dependencies
Write-Host "Installing Node.js dependencies..."
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies!" -ForegroundColor Red
    Write-Host "Make sure Node.js is installed: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Dependencies installed!" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Starting server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Server will start with:" -ForegroundColor Cyan
Write-Host "✅ 50 enemies spawned randomly" -ForegroundColor Green
Write-Host "✅ Real-time multiplayer" -ForegroundColor Green
Write-Host "✅ Working combat system" -ForegroundColor Green
Write-Host "✅ Chat system" -ForegroundColor Green
Write-Host ""

Write-Host "Starting server on http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

# Start the server
node server-fixed.js