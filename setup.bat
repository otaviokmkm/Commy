@echo off
echo.
echo ===================================================
echo    COMMY REVAMPED MMORPG - SpacetimeDB Setup
echo ===================================================
echo.

echo Step 1: Checking SpacetimeDB installation...
spacetime --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ SpacetimeDB CLI not found!
    echo.
    echo Please install SpacetimeDB CLI first:
    echo 1. Open PowerShell as Administrator
    echo 2. Run this command:
    echo    Invoke-WebRequest -Uri "https://github.com/clockworklabs/SpacetimeDB/releases/latest/download/spacetimedb-cli-windows-amd64.zip" -OutFile "$env:TEMP\spacetimedb.zip"; Expand-Archive "$env:TEMP\spacetimedb.zip" -DestinationPath "C:\spacetimedb" -Force; [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\spacetimedb", "Machine")
    echo 3. Restart this script
    echo.
    pause
    exit /b 1
)

spacetime --version
echo ✅ SpacetimeDB CLI found!
echo.

echo Step 2: Creating SpacetimeDB module structure...
if not exist "spacetimedb" mkdir spacetimedb
if not exist "spacetimedb\src" mkdir spacetimedb\src

echo ✅ Directory structure created!
echo.

echo Step 3: Account setup...
echo.
echo You need a SpacetimeDB account to deploy your game.
echo.
set /p "choice=Do you already have a SpacetimeDB account? (y/n): "
if /i "%choice%"=="n" (
    echo.
    echo Creating new account...
    echo Please follow the prompts to register:
    spacetime register
    if %errorlevel% neq 0 (
        echo ❌ Registration failed. Please try again.
        pause
        exit /b 1
    )
) else (
    echo.
    echo Logging in to existing account...
    spacetime login
    if %errorlevel% neq 0 (
        echo ❌ Login failed. Please check your credentials.
        pause
        exit /b 1
    )
)

echo.
echo ✅ Account setup complete!
echo.

echo Step 4: Building and deploying your MMORPG...
cd spacetimedb

echo Building SpacetimeDB module...
spacetime build
if %errorlevel% neq 0 (
    echo ❌ Build failed. Please check the Rust code.
    pause
    exit /b 1
)

echo Publishing to SpacetimeDB cloud...
spacetime publish mmorpg-server
if %errorlevel% neq 0 (
    echo ❌ Publish failed. Please try again.
    pause
    exit /b 1
)

echo.
echo Getting your database address...
for /f "tokens=2" %%a in ('spacetime list ^| findstr mmorpg-server') do set DB_ADDRESS=%%a

cd..

echo.
echo ================================================
echo            🎉 DEPLOYMENT SUCCESSFUL! 🎉
echo ================================================
echo.
echo Your MMORPG is now running on SpacetimeDB Cloud!
echo.
echo 📍 Database Address: %DB_ADDRESS%
echo.
echo 🎮 To play your game:
echo 1. Open 'spacetimedb-client.html' in your web browser
echo 2. Enter your player name
echo 3. Enter database address: %DB_ADDRESS%
echo 4. Click 'Join Game'
echo.
echo 🛠️ To initialize the game world:
echo - Press 'I' key in-game or click 'Initialize Map'
echo.
echo 📊 To monitor your database:
echo - Run: spacetime logs %DB_ADDRESS%
echo.
echo 📁 Game files:
echo - Client: spacetimedb-client.html
echo - Server: spacetimedb/src/lib.rs
echo.
echo Happy gaming! 🎮
echo.

pause