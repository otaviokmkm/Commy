@echo off
cd /d "c:\Users\otavi\Servidor do meu MMORPG\Commy Revamped"

echo.
echo ===================================================
echo    QUICK START MMORPG
echo ===================================================
echo.

REM Check if we have dependencies
if not exist "node_modules" (
    echo Installing dependencies...
    if exist package-fixed.json copy package-fixed.json package.json >nul
    npm install
)

echo Starting MMORPG server...
echo Open http://localhost:3000 in your browser
echo.

node server-fixed.js