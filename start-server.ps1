# Comfort Counsel Server Starter
# This script kills any existing Node processes and starts the server

Write-Host "🔄 Stopping any existing Node.js processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "🚀 Starting Comfort Counsel server..." -ForegroundColor Green
npm start
