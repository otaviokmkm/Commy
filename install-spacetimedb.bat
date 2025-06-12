@echo off
echo.
echo ===================================================
echo    SPACETIMEDB INSTALLATION FOR WINDOWS
echo ===================================================
echo.

echo Step 1: Trying winget installation (Recommended)...
echo.

winget --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Winget found! Installing SpacetimeDB...
    winget install clockworklabs.spacetimedb
    if %errorlevel% equ 0 (
        echo ✅ SpacetimeDB installed successfully via winget!
        goto verify
    ) else (
        echo ❌ Winget installation failed. Trying alternative method...
    )
) else (
    echo ❌ Winget not available. Trying alternative method...
)

echo.
echo Step 2: Trying Cargo installation (if Rust is installed)...
echo.

cargo --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Cargo found! Installing SpacetimeDB CLI...
    cargo install spacetimedb-cli
    if %errorlevel% equ 0 (
        echo ✅ SpacetimeDB installed successfully via cargo!
        goto verify
    ) else (
        echo ❌ Cargo installation failed. Trying manual method...
    )
) else (
    echo ❌ Cargo not available. Proceeding to manual installation...
)

echo.
echo Step 3: Manual download method...
echo.

powershell -Command "& {
    Write-Host 'Downloading SpacetimeDB CLI...'
    
    # Create temp directory
    $tempDir = '$env:TEMP\spacetimedb_manual'
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    
    try {
        # Try direct download from GitHub releases
        $downloadUrl = 'https://github.com/clockworklabs/SpacetimeDB/releases/latest/download/spacetimedb-cli-windows-amd64.zip'
        Write-Host 'Attempting download from: $downloadUrl'
        Invoke-WebRequest -Uri $downloadUrl -OutFile '$tempDir\spacetimedb.zip' -ErrorAction Stop
        
        # Extract
        Write-Host 'Extracting files...'
        Expand-Archive '$tempDir\spacetimedb.zip' -DestinationPath '$tempDir\extracted' -Force
        
        # Create installation directory
        Write-Host 'Installing to C:\spacetimedb...'
        New-Item -ItemType Directory -Force -Path 'C:\spacetimedb' | Out-Null
        
        # Copy files
        Copy-Item '$tempDir\extracted\*' 'C:\spacetimedb' -Recurse -Force
        
        # Add to PATH
        $currentPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
        if ($currentPath -notlike '*C:\spacetimedb*') {
            [Environment]::SetEnvironmentVariable('PATH', $currentPath + ';C:\spacetimedb', 'Machine')
            Write-Host 'Added SpacetimeDB to system PATH'
        }
        
        Write-Host '✅ Manual installation completed!'
        
    } catch {
        Write-Host '❌ Manual installation failed: $($_.Exception.Message)'
        Write-Host ''
        Write-Host 'Please try manual installation:'
        Write-Host '1. Go to: https://github.com/clockworklabs/SpacetimeDB/releases/latest'
        Write-Host '2. Download the Windows ZIP file'
        Write-Host '3. Extract to C:\spacetimedb\'
        Write-Host '4. Add C:\spacetimedb to your PATH'
        exit 1
    }
}"

if %errorlevel% neq 0 (
    echo.
    echo ❌ All automatic installation methods failed.
    echo.
    echo Please install manually:
    echo 1. Go to: https://github.com/clockworklabs/SpacetimeDB/releases/latest
    echo 2. Download: spacetimedb-cli-windows-amd64.zip
    echo 3. Extract to: C:\spacetimedb\
    echo 4. Add C:\spacetimedb to your PATH environment variable
    echo.
    pause
    exit /b 1
)

:verify
echo.
echo Step 4: Verifying installation...
echo.

rem Close and reopen the PATH
set PATH=%PATH%;C:\spacetimedb

spacetime --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ SpacetimeDB CLI installed successfully!
    spacetime --version
    echo.
    echo Next steps:
    echo 1. Run: spacetime register  (create free account)
    echo 2. Run: spacetime login     (login to your account)
    echo 3. Run: setup.bat           (deploy your MMORPG)
    echo.
) else (
    echo ❌ Installation verification failed.
    echo Please restart your terminal and try: spacetime --version
    echo.
    echo If still failing, try manual installation:
    echo 1. Go to: https://github.com/clockworklabs/SpacetimeDB/releases/latest
    echo 2. Download: spacetimedb-cli-windows-amd64.zip
    echo 3. Extract to: C:\spacetimedb\
    echo 4. Add C:\spacetimedb to PATH
    echo.
)

pause