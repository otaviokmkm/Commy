@echo off
echo.
echo ===================================================
echo    SPACETIMEDB QUICK VERIFICATION
echo ===================================================
echo.

echo Testing SpacetimeDB CLI...
echo.

spacetime --version
if %errorlevel% equ 0 (
    echo ✅ SpacetimeDB CLI is working!
    echo.
    echo Let's check if you're logged in...
    spacetime list >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ You're already logged in!
        echo Your databases:
        spacetime list
    ) else (
        echo ⚠️ You need to login or register first.
        echo.
        set /p "hasAccount=Do you have a SpacetimeDB account? (y/n): "
        if /i "!hasAccount!"=="y" (
            echo Logging in...
            spacetime login
        ) else (
            echo Creating new account...
            spacetime register
        )
    )
) else (
    echo ❌ SpacetimeDB CLI not found!
    echo.
    echo Please ensure D:\spacetime-x86_64-pc-windows-msvc is in your PATH
    echo Current PATH check:
    echo %PATH% | findstr spacetime
    echo.
    echo To add to PATH:
    echo 1. Press Win + R, type "sysdm.cpl"
    echo 2. Environment Variables -> System Variables -> Path -> Edit
    echo 3. Add: D:\spacetime-x86_64-pc-windows-msvc
    echo 4. Restart terminal
)

echo.
pause