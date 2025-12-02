# Azure App Service Deployment Guide

This document describes the process for deploying the NMS backend application to Azure App Service using Zip Deploy method.

## Overview

The NMS backend is deployed to Azure App Service using the **Zip Deploy** method. This method uploads a zip file containing the application code directly to the Azure App Service, which then extracts and runs the application.

## Prerequisites

1. **Publish Settings File**: `NMS1.PublishSettings` (located in project root)
   - Contains deployment credentials and URLs
   - Includes three deployment methods: Web Deploy, FTP, and Zip Deploy
   - We use the **Zip Deploy** profile

2. **Application Zip File**: `backend/nms.zip`
   - Contains all backend application files
   - Must have `package.json` at the root level
   - Should NOT include `node_modules` (dependencies are installed on Azure)

3. **PowerShell** (Windows) or **Bash** (Linux/Mac) for running deployment commands

## Deployment Configuration

### Package.json Configuration

**Recommended**: Add a `prestart` script to ensure dependencies are installed before the application starts:

```json
{
  "scripts": {
    "prestart": "npm install --production",
    "start": "node app.js"
  }
}
```

**Why the prestart script?**
- Azure App Service may not always run `npm install` automatically during zip deployment
- The `prestart` script runs automatically before `npm start` and ensures that:
  - Dependencies are installed if `node_modules` doesn't exist
  - Only production dependencies are installed (faster, smaller footprint)
  - The application can start even if dependencies weren't installed during deployment

**Note**: If you encounter "Cannot find module" errors after deployment, add the `prestart` script to `package.json` and redeploy.

### Azure App Service Configuration

- **App Name**: NMS1
- **Region**: Canada Central
- **URL**: `http://nms1-cchfa0g8czbkf0a7.canadacentral-01.azurewebsites.net`
- **SCM URL**: `https://nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net`

## Deployment Steps

### Step 1: Prepare the Zip File

1. Navigate to the `backend` directory:
   ```powershell
   cd backend
   ```

2. Create a zip file containing all application files:
   ```powershell
   # Exclude node_modules and other unnecessary files
   Compress-Archive -Path app.js,package.json,package-lock.json,config,cosmosClient.js,middleware,routes,websocket,auth.js,authMiddleware.js,roles.js,startup.js -DestinationPath nms.zip -Force
   ```
   
   **Note**: Adjust the file list based on your project structure. The zip must include:
   - `app.js` (main entry point)
   - `package.json` (required for npm install)
   - `package-lock.json` (for consistent dependency versions)
   - All source files (routes, middleware, config, etc.)
   - `.env` file (if not managed via Azure App Settings)

### Step 2: Extract Deployment Credentials

From `NMS1.PublishSettings`, extract the Zip Deploy profile:

```xml
<publishProfile profileName="NMS1 - Zip Deploy" 
                publishMethod="ZipDeploy" 
                publishUrl="nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net:443" 
                userName="$NMS1" 
                userPWD="[DEPLOYMENT_PASSWORD]" 
                destinationAppUrl="http://nms1-cchfa0g8czbkf0a7.canadacentral-01.azurewebsites.net" />
```

### Step 3: Deploy Using PowerShell

Run the following PowerShell script from the project root:

```powershell
# Configuration
$zipPath = "backend\nms.zip"
$publishUrl = "https://nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net/api/zipdeploy"
$username = '$NMS1'
$password = 'Sb8uAWC4AvtrKJ4xqBvhtj0r3i5oWQJAZGGGXvoAZr0ni9N0ToSRCBwnKxKT'

# Create Basic Auth header
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{
    Authorization = "Basic $base64Auth"
    ContentType = "application/zip"
}

# Deploy
Write-Host "Deploying $zipPath to Azure..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri $publishUrl -Method Post -Headers $headers -InFile $zipPath

Write-Host "Deployment initiated successfully!" -ForegroundColor Green
Write-Host "Deployment ID: $($response.id)"
```

### Step 4: Monitor Deployment

Check deployment status:

```powershell
$statusUrl = "https://nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net/api/deployments"
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{Authorization = "Basic $base64Auth"}

$deployments = Invoke-RestMethod -Uri $statusUrl -Method Get -Headers $headers
$latest = $deployments[0]

Write-Host "Status: $($latest.status) (4=Success, 3=InProgress, 2=Failed)"
Write-Host "Received: $($latest.received_time)"
```

### Step 5: Verify Application Health

Check if the application is running:

```powershell
$appUrl = "http://nms1-cchfa0g8czbkf0a7.canadacentral-01.azurewebsites.net"

try {
    $response = Invoke-WebRequest -Uri $appUrl -Method Get -TimeoutSec 10
    Write-Host "✅ Application is running!" -ForegroundColor Green
    Write-Host "HTTP Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "❌ Application not responding: $($_.Exception.Message)" -ForegroundColor Red
}
```

## Deployment Process Flow

1. **Upload**: Zip file is uploaded to Azure App Service
2. **Extract**: Azure extracts the zip to `/home/site/wwwroot`
3. **Startup**: Azure runs `npm start`
4. **Prestart**: `prestart` script runs `npm install --production`
5. **Start**: Application starts with `node app.js`
6. **Health Check**: Application responds to HTTP requests

## Troubleshooting

### Issue: "Cannot find module 'dotenv'" or other missing modules

**Solution**: 
1. Add the `prestart` script to `package.json`:
   ```json
   "scripts": {
     "prestart": "npm install --production",
     "start": "node app.js"
   }
   ```
2. Verify:
   - `package.json` lists all required dependencies
   - The zip file includes `package.json` at the root level
   - The zip file does NOT include `node_modules` (let Azure install it)
3. Recreate the zip file and redeploy

### Issue: Deployment takes too long

**Expected Behavior**: 
- First deployment: 5-10 minutes (npm install takes time)
- Subsequent deployments: 2-3 minutes (dependencies may be cached)

**Check Logs**:
```powershell
$logUrl = "https://nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net/api/logs/docker"
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{Authorization = "Basic $base64Auth"}
$logs = Invoke-RestMethod -Uri $logUrl -Method Get -Headers $headers
```

### Issue: Application not starting

1. Check Azure Portal → App Service → Log stream
2. Verify environment variables are set in Azure App Settings
3. Check that `app.js` is the correct entry point
4. Verify Node.js version compatibility (Azure uses v20.19.5)

### Issue: 400 Bad Request during deployment

**Possible Causes**:
- Zip file structure is incorrect (package.json not at root)
- Zip file is corrupted
- File size exceeds limits

**Solution**:
- Verify zip structure: `package.json` should be at the root
- Recreate the zip file
- Check file size (should be < 100MB for zip deploy)

## Environment Variables

Ensure the following environment variables are configured in Azure App Service:

1. Go to Azure Portal → App Service → Configuration → Application settings
2. Add or verify these variables:
   - `COSMOS_DB_ENDPOINT`
   - `COSMOS_DB_KEY`
   - `COSMOS_DB_DATABASE_ID`
   - `NODE_ENV` (set to `production` for production deployments)
   - Any other variables required by your application

## Quick Deployment Script

Save this as `deploy.ps1` in the project root for quick deployments:

```powershell
# Azure Deployment Script
param(
    [string]$ZipFile = "backend\nms.zip"
)

$publishUrl = "https://nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net/api/zipdeploy"
$username = '$NMS1'
$password = 'Sb8uAWC4AvtrKJ4xqBvhtj0r3i5oWQJAZGGGXvoAZr0ni9N0ToSRCBwnKxKT'

if (-not (Test-Path $ZipFile)) {
    Write-Host "❌ Zip file not found: $ZipFile" -ForegroundColor Red
    exit 1
}

$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{
    Authorization = "Basic $base64Auth"
    ContentType = "application/zip"
}

Write-Host "🚀 Deploying $ZipFile to Azure..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri $publishUrl -Method Post -Headers $headers -InFile $ZipFile
    Write-Host "✅ Deployment initiated!" -ForegroundColor Green
    Write-Host "   Deployment ID: $($response.id)" -ForegroundColor Gray
    
    Write-Host "`n⏳ Waiting for deployment to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    Write-Host "`n🔍 Checking application health..." -ForegroundColor Cyan
    $appUrl = "http://nms1-cchfa0g8czbkf0a7.canadacentral-01.azurewebsites.net"
    $health = Invoke-WebRequest -Uri $appUrl -Method Get -TimeoutSec 10
    Write-Host "✅ Application is running! (HTTP $($health.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
```

Usage:
```powershell
.\deploy.ps1
# Or specify a different zip file:
.\deploy.ps1 -ZipFile "backend\nms-custom.zip"
```

## Security Notes

⚠️ **Important**: 
- The `NMS1.PublishSettings` file contains sensitive credentials
- Do NOT commit this file to version control
- Add it to `.gitignore`
- Regenerate deployment credentials if compromised
- Use Azure Key Vault for production environments

## Additional Resources

- [Azure App Service Zip Deploy Documentation](https://docs.microsoft.com/en-us/azure/app-service/deploy-zip)
- [Azure App Service Deployment Best Practices](https://docs.microsoft.com/en-us/azure/app-service/deploy-best-practices)
- [Node.js on Azure App Service](https://docs.microsoft.com/en-us/azure/app-service/quickstart-nodejs)

## Deployment History

- **2025-11-27**: Initial deployment using Zip Deploy
  - Method: Zip Deploy via Azure App Service API
  - Configuration: `NMS1.PublishSettings` with Zip Deploy profile
  - Solution for missing dependencies: Added `prestart` script to `package.json` to ensure `npm install --production` runs before startup
  - Application successfully running at: `http://nms1-cchfa0g8czbkf0a7.canadacentral-01.azurewebsites.net`
  - Status: ✅ Deployed and operational

