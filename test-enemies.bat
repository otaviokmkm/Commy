@echo off
echo.
echo ===================================================
echo    TESTING ENEMY RENDERING
echo ===================================================
echo.

echo This will test if enemies render properly by using a simple test server.
echo.

echo Step 1: Installing dependencies for test server...
if not exist "node_modules" (
    npm install express socket.io
)

echo.
echo Step 2: Starting test server on port 3001...
echo.
echo The test server will:
echo ✅ Generate 10 test enemies around position (90,90)
echo ✅ Send them immediately when you join
echo ✅ Show debug logs for troubleshooting
echo.

start "Test Enemy Server" node test-enemy-server.js

timeout /t 2 >nul

echo.
echo Step 3: Instructions:
echo.
echo 1. Open http://localhost:3001 in your browser
echo 2. Join the game with any name
echo 3. Look for red enemy squares around the center
echo 4. Check browser console (F12) for enemy debug messages
echo.
echo Expected results:
echo - You should see: "👹 Received mapEnemies" in browser console
echo - You should see: "👹 Enemies loaded: 10" in browser console  
echo - You should see red squares on the map
echo.
echo If enemies appear: Your client works, issue is with main server
echo If no enemies: Issue is with client-side rendering
echo.

pause