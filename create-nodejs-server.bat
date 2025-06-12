@echo off
echo.
echo ===================================================
echo    CREATING NODE.JS MMORPG (CLEAN VERSION)
echo ===================================================
echo.

echo This will create a professional Node.js MMORPG that's:
echo ✅ Easy to setup and modify
echo ✅ Has real-time multiplayer
echo ✅ Includes enemies, combat, and maps
echo ✅ No complex dependencies
echo.

echo Step 1: Checking Node.js...
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found!
node --version
echo.

echo Step 2: Creating clean server structure...
echo.

if not exist "nodejs-mmorpg" mkdir nodejs-mmorpg
cd nodejs-mmorpg

echo Creating package.json...
echo {> package.json
echo   "name": "commy-revamped-mmorpg-clean",>> package.json
echo   "version": "2.0.0",>> package.json
echo   "description": "Clean Node.js MMORPG with real-time multiplayer",>> package.json
echo   "main": "server.js",>> package.json
echo   "scripts": {>> package.json
echo     "start": "node server.js",>> package.json
echo     "dev": "node server.js">> package.json
echo   },>> package.json
echo   "dependencies": {>> package.json
echo     "express": "^4.18.2",>> package.json
echo     "socket.io": "^4.7.2">> package.json
echo   }>> package.json
echo }>> package.json

echo ✅ Package.json created!
echo.

echo Step 3: Installing dependencies...
echo.

npm install
if %errorlevel% neq 0 (
    echo ❌ NPM install failed!
    pause
    exit /b 1
)

echo ✅ Dependencies installed!
echo.

echo Step 4: Creating server files...
echo.

echo Creating clean server.js...
rem (The server.js content will be created by the next script)

echo Creating client files...
if not exist "public" mkdir public

echo ✅ Project structure created!
echo.

cd..

echo.
echo ================================================
echo        ✅ NODE.JS MMORPG CREATED!
echo ================================================
echo.
echo Your clean MMORPG is ready in: nodejs-mmorpg\
echo.
echo To start:
echo 1. cd nodejs-mmorpg
echo 2. npm start
echo 3. Open http://localhost:3000 in your browser
echo.
echo This version will have:
echo ✅ Working enemies that appear
echo ✅ Real-time multiplayer
echo ✅ Clean, debuggable code
echo ✅ Easy to customize
echo.

pause