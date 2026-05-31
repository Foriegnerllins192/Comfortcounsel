@echo off
echo Stopping any existing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting Comfort Counsel server...
npm start
