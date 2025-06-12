@echo off
echo.
echo ===================================================
echo    STOPPING EXISTING SERVERS
echo ===================================================
echo.

echo Checking for processes using port 3000...

REM Find and kill processes using port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000"') do (
    echo Found process %%a using port 3000
    taskkill /f /pid %%a >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Killed process %%a
    )
)

echo.
echo ✅ Port 3000 should now be available
echo.

pause