@echo off
echo.
echo ===================================================
echo    STARTING WORKING MMORPG SERVER
echo ===================================================
echo.

echo Step 1: Installing dependencies...
echo.

REM Copy package.json to the right name
if exist package-fixed.json (
    copy package-fixed.json package.json
)

REM Install dependencies
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies!
    echo Make sure Node.js is installed: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Dependencies installed!
echo.

echo Step 2: Starting server...
echo.
echo 🚀 Server will start with:
echo ✅ 50 enemies spawned randomly
echo ✅ Real-time multiplayer
echo ✅ Tactical turn-based combat system
echo ✅ Movement and Action points
echo ✅ PvP and PvE combat
echo ✅ Intelligent AI - enemies hunt or flee based on level
echo ✅ Varied arena sizes and obstacles
echo ✅ Permadeath - characters deleted after defeat
echo ✅ Chat system
echo.

echo Starting server on http://localhost:3000
echo.

node server-fixed.js

pause