# SpacetimeDB Installation Guide for Windows

## Method 1: Using Winget (Recommended for Windows 10/11)
1. Open PowerShell as Administrator
2. Run this command:

```powershell
# Install SpacetimeDB using Windows Package Manager
winget install clockworklabs.spacetimedb
```

## Method 2: PowerShell Script Installation (Alternative)
1. Open PowerShell as Administrator
2. Run the following commands:

```powershell
# Create temporary directory
$tempDir = "$env:TEMP\spacetimedb_install"
New-Item -ItemType Directory -Force -Path $tempDir

# Download using PowerShell (for systems without winget)
try {
    # Try to get the latest release info from GitHub API
    $apiUrl = "https://api.github.com/repos/clockworklabs/SpacetimeDB/releases/latest"
    $response = Invoke-RestMethod -Uri $apiUrl
    $downloadUrl = $response.assets | Where-Object { $_.name -like "*windows*" -and $_.name -like "*x86_64*" } | Select-Object -First 1 -ExpandProperty browser_download_url
    
    if ($downloadUrl) {
        Write-Host "Downloading from: $downloadUrl"
        Invoke-WebRequest -Uri $downloadUrl -OutFile "$tempDir\spacetimedb.zip"
        
        # Extract
        Expand-Archive "$tempDir\spacetimedb.zip" -DestinationPath "$tempDir\extracted" -Force
        
        # Create installation directory
        New-Item -ItemType Directory -Force -Path "C:\spacetimedb"
        
        # Copy files
        Copy-Item "$tempDir\extracted\*" "C:\spacetimedb" -Recurse -Force
        
        # Add to PATH
        $currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
        if ($currentPath -notlike "*C:\spacetimedb*") {
            [Environment]::SetEnvironmentVariable("PATH", $currentPath + ";C:\spacetimedb", "Machine")
        }
        
        Write-Host "✅ SpacetimeDB installed successfully!"
    } else {
        throw "Could not find Windows download"
    }
} catch {
    Write-Host "❌ Automated download failed. Please use Manual Installation method below."
    Write-Host "Error: $($_.Exception.Message)"
}
```

## Method 3: Cargo Installation (If you have Rust)
```powershell
# Install using Cargo (Rust package manager)
cargo install spacetimedb-cli
```

3. Close and reopen PowerShell
4. Verify installation: `spacetime --version`

## Method 2: Using Chocolatey (If you have it)
```powershell
choco install spacetimedb
```

## Method 3: Manual Installation
1. Go to: https://github.com/clockworklabs/SpacetimeDB/releases/latest
2. Download: `spacetimedb-cli-windows-amd64.zip`
3. Extract to: `C:\spacetimedb\`
4. Add `C:\spacetimedb` to your PATH environment variable

## Next Steps After Installation:
1. Open a new Command Prompt or PowerShell
2. Run: `spacetime --version` (should show version info)
3. Run: `spacetime register` (create free account)
4. Run: `spacetime login` (login to your account)