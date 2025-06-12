@echo off
echo.
echo ===================================================
echo    SPACETIMEDB VERIFICATION AND SETUP
echo ===================================================
echo.

echo Step 1: Verifying SpacetimeDB installation...
echo.

spacetime --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ SpacetimeDB CLI found!
    spacetime --version
    echo.
) else (
    echo ❌ SpacetimeDB CLI not found in PATH.
    echo.
    echo Your installation path: D:\spacetime-x86_64-pc-windows-msvc
    echo.
    echo Please ensure this path is added to your system PATH:
    echo 1. Press Win + R, type "sysdm.cpl" and press Enter
    echo 2. Click "Environment Variables"
    echo 3. Under "System Variables", find and select "Path", then click "Edit"
    echo 4. Click "New" and add: D:\spacetime-x86_64-pc-windows-msvc
    echo 5. Click OK on all dialogs
    echo 6. Restart this command prompt and try again
    echo.
    pause
    exit /b 1
)

echo Step 2: Account setup...
echo.
set /p "hasAccount=Do you already have a SpacetimeDB account? (y/n): "
if /i "%hasAccount%"=="n" (
    echo.
    echo Creating new SpacetimeDB account...
    echo Please follow the prompts:
    spacetime register
    if %errorlevel% neq 0 (
        echo ❌ Registration failed. Please try again.
        pause
        exit /b 1
    )
    echo ✅ Account created successfully!
) else (
    echo.
    echo Logging into existing account...
    spacetime login
    if %errorlevel% neq 0 (
        echo ❌ Login failed. Please check your credentials.
        pause
        exit /b 1
    )
    echo ✅ Login successful!
)

echo.
echo Step 3: Setting up SpacetimeDB module structure...
echo.

if not exist "spacetimedb" (
    mkdir spacetimedb
    echo ✅ Created spacetimedb directory
)

if not exist "spacetimedb\src" (
    mkdir spacetimedb\src
    echo ✅ Created spacetimedb\src directory
)

echo ✅ Project structure ready!
echo.

echo Step 4: Building SpacetimeDB module...
echo.
cd spacetimedb

spacetime build
if %errorlevel% neq 0 (
    echo ❌ Build failed. The Rust code may have syntax errors.
    echo Please check the spacetimedb\src\lib.rs file.
    cd..
    pause
    exit /b 1
)

echo ✅ Build successful!
echo.

echo Step 5: Publishing to SpacetimeDB Cloud...
echo.

spacetime publish mmorpg-server
if %errorlevel% neq 0 (
    echo ❌ Publish failed. Please try again.
    cd..
    pause
    exit /b 1
)

echo ✅ Published successfully!
echo.

echo Step 6: Getting your database address...
echo.

for /f "tokens=2" %%a in ('spacetime list ^| findstr mmorpg-server') do set DB_ADDRESS=%%a

cd..

echo.
echo ================================================
echo            🎉 SETUP COMPLETE! 🎉
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
echo Happy gaming! 🎮
echo.

pause