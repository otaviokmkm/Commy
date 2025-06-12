@echo off
echo.
echo ===================================================
echo    SPACETIMEDB MMORPG - SIMPLIFIED SETUP
echo ===================================================
echo.

echo Step 1: Testing SpacetimeDB CLI...
echo.

spacetime --version
if %errorlevel% neq 0 (
    echo ❌ SpacetimeDB not found in PATH!
    echo Please add D:\spacetime-x86_64-pc-windows-msvc to your PATH
    echo and restart this script.
    pause
    exit /b 1
)

echo ✅ SpacetimeDB CLI found!
echo.

echo Step 2: Checking login status...
echo.

spacetime list >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ Not logged in. Let's set up your account...
    echo.
    set /p "hasAccount=Do you have a SpacetimeDB account? (y/n): "
    if /i "!hasAccount!"=="y" (
        echo.
        echo Please login:
        spacetime login
    ) else (
        echo.
        echo Creating new account:
        spacetime register
    )
    
    if %errorlevel% neq 0 (
        echo ❌ Account setup failed. Please try again.
        pause
        exit /b 1
    )
) else (
    echo ✅ Already logged in!
)

echo.
echo Step 3: Setting up project structure...
echo.

if not exist "spacetimedb" mkdir spacetimedb
if not exist "spacetimedb\src" mkdir spacetimedb\src

echo ✅ Directories created!
echo.

echo Step 4: Since you don't have Rust, let's use a pre-built module...
echo.

echo For now, let's test the SpacetimeDB connection with a simple example.
echo We'll create a basic database first:

cd spacetimedb

echo Creating minimal test module...
spacetime init test-db --lang=rust

echo.
echo Step 5: Building the test module...
echo.

spacetime build
if %errorlevel% neq 0 (
    echo ❌ Build failed. This might be because Rust is not installed.
    echo.
    echo ALTERNATIVE SOLUTION:
    echo Let me create a working Node.js MMORPG server instead!
    echo This will be much easier to set up and will work great.
    echo.
    set /p "useNodeJS=Would you like to use Node.js instead? (y/n): "
    if /i "!useNodeJS!"=="y" (
        cd..
        echo ✅ Let's set up the Node.js version...
        call create-nodejs-server.bat
    )
    cd..
    pause
    exit /b 1
)

echo ✅ Build successful!
echo.

echo Step 6: Publishing to SpacetimeDB Cloud...
echo.

spacetime publish test-mmorpg
if %errorlevel% neq 0 (
    echo ❌ Publish failed. Please try again.
    cd..
    pause
    exit /b 1
)

echo ✅ Published successfully!
echo.

echo Getting your database address...
for /f "tokens=2" %%a in ('spacetime list ^| findstr test-mmorpg') do set DB_ADDRESS=%%a

cd..

echo.
echo ================================================
echo            🎉 BASIC SETUP COMPLETE! 🎉
echo ================================================
echo.
echo Database Address: %DB_ADDRESS%
echo.
echo Next steps:
echo 1. We need to add the MMORPG logic to the module
echo 2. Or we can create a Node.js version that's easier to modify
echo.
echo What would you prefer?
echo A) Continue with SpacetimeDB (requires Rust knowledge)
echo B) Create Node.js MMORPG (easier to customize)
echo.
set /p "choice=Your choice (A/B): "

if /i "%choice%"=="B" (
    echo.
    echo ✅ Creating Node.js MMORPG...
    call create-nodejs-server.bat
) else (
    echo.
    echo ✅ SpacetimeDB setup complete!
    echo You can now customize the Rust module in spacetimedb\src\lib.rs
)

pause