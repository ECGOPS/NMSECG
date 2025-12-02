# Script to prepare the backend deployment zip file
# Usage: .\prepare-deployment.ps1

$backendDir = "backend"
$outputZip = "backend\nms.zip"

Write-Host "📦 Preparing deployment zip file..." -ForegroundColor Cyan
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path $backendDir)) {
    Write-Host "❌ Backend directory not found: $backendDir" -ForegroundColor Red
    exit 1
}

# Check if package.json exists
$packageJson = Join-Path $backendDir "package.json"
if (-not (Test-Path $packageJson)) {
    Write-Host "❌ package.json not found in backend directory" -ForegroundColor Red
    exit 1
}

# Verify package.json has start script
$package = Get-Content $packageJson | ConvertFrom-Json
if (-not $package.scripts.start) {
    Write-Host "⚠️  Warning: package.json does not have a 'start' script" -ForegroundColor Yellow
    Write-Host "   Recommended: Add 'prestart' script to ensure npm install runs" -ForegroundColor Yellow
    Write-Host ""
}

# Files and directories to include
$filesToInclude = @(
    "app.js",
    "package.json",
    "package-lock.json",
    "auth.js",
    "authMiddleware.js",
    "roles.js",
    "cosmosClient.js",
    "startup.js",
    "config",
    "middleware",
    "routes",
    "websocket"
)

# Check for .env file (optional, may be managed via Azure App Settings)
$envFile = Join-Path $backendDir ".env"
if (Test-Path $envFile) {
    Write-Host "⚠️  Warning: .env file found. Consider using Azure App Settings instead." -ForegroundColor Yellow
    Write-Host "   If you include .env, make sure it is in .gitignore!" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "📋 Files to include:" -ForegroundColor Cyan
$missingFiles = @()
foreach ($item in $filesToInclude) {
    $path = Join-Path $backendDir $item
    if (Test-Path $path) {
        Write-Host "   ✅ $item" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $item (not found, will be skipped)" -ForegroundColor Yellow
        $missingFiles += $item
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Some files/directories are missing. Continue anyway? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Cancelled." -ForegroundColor Gray
        exit 0
    }
}

Write-Host ""
Write-Host "🗜️  Creating zip file..." -ForegroundColor Cyan

# Change to backend directory to ensure correct paths in zip
Push-Location $backendDir

try {
    # Remove existing zip if it exists
    if (Test-Path $outputZip) {
        Remove-Item $outputZip -Force
        Write-Host "   Removed existing zip file" -ForegroundColor Gray
    }
    
    # Create array of paths that exist
    $pathsToZip = @()
    foreach ($item in $filesToInclude) {
        if (Test-Path $item) {
            $pathsToZip += $item
        }
    }
    
    if ($pathsToZip.Count -eq 0) {
        Write-Host "❌ No files found to include in zip" -ForegroundColor Red
        exit 1
    }
    
    # Create zip file
    Compress-Archive -Path $pathsToZip -DestinationPath "nms.zip" -Force
    
    # Get zip file size
    $zipInfo = Get-Item "nms.zip"
    $zipSizeMB = [math]::Round($zipInfo.Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "✅ Zip file created successfully!" -ForegroundColor Green
    Write-Host "   File: $outputZip" -ForegroundColor Gray
    Write-Host "   Size: $zipSizeMB MB" -ForegroundColor Gray
    Write-Host ""
    
    # Verify package.json is in the zip
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path "nms.zip").Path)
    $hasPackageJson = $zip.Entries | Where-Object { $_.Name -eq "package.json" }
    $zip.Dispose()
    
    if ($hasPackageJson) {
        Write-Host "✅ Verified: package.json is in the zip file" -ForegroundColor Green
    } else {
        Write-Host "❌ Warning: package.json not found in zip file!" -ForegroundColor Red
        Write-Host "   This will cause deployment to fail!" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "🚀 Ready to deploy! Run: .\deploy-azure.ps1" -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "❌ Error creating zip file: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

