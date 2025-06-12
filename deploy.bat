@echo off
REM SpacetimeDB Deployment Script for Windows

echo 🚀 Deploying Commy Revamped MMORPG to SpacetimeDB...

REM Navigate to the SpacetimeDB module directory
cd spacetimedb

REM Build the module
echo 🔨 Building SpacetimeDB module...
spacetime build

REM Publish the module to SpacetimeDB cloud
echo 📤 Publishing to SpacetimeDB cloud...
spacetime publish mmorpg-server

REM Get the database address
echo 📋 Getting database address...
for /f "tokens=2" %%a in ('spacetime list ^| findstr mmorpg-server') do set DB_ADDRESS=%%a

echo.
echo ✅ Deployment complete!
echo.
echo 🎮 Your MMORPG is now running on SpacetimeDB!
echo 📍 Database Address: %DB_ADDRESS%
echo.
echo 🌐 To play:
echo 1. Open spacetimedb-client.html in your browser
echo 2. Enter your player name
echo 3. Enter database address: %DB_ADDRESS%
echo 4. Click 'Join Game'
echo.
echo 🛠️ To initialize the game world:
echo 1. Join the game
echo 2. Press 'I' key or click 'Initialize Map' button
echo.
echo 📊 To monitor your database:
echo spacetime logs %DB_ADDRESS%
echo.
echo Happy gaming! 🎉

pause