# Azure App Service Deployment Script for NMS Backend
# Usage: .\deploy-azure.ps1 [-ZipFile "backend\nms.zip"]

param(
    [string]$ZipFile = "backend\nms.zip"
)

# Configuration from NMS1.PublishSettings (Zip Deploy profile)
$publishUrl = "https://nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net/api/zipdeploy"
$appUrl = "http://nms1-cchfa0g8czbkf0a7.canadacentral-01.azurewebsites.net"
$username = '$NMS1'
$password = 'Sb8uAWC4AvtrKJ4xqBvhtj0r3i5oWQJAZGGGXvoAZr0ni9N0ToSRCBwnKxKT'

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }

# Validate zip file exists
if (-not (Test-Path $ZipFile)) {
    Write-Error "❌ Zip file not found: $ZipFile"
    Write-Info "💡 Make sure you've created the zip file in the backend directory"
    exit 1
}

Write-Info "🚀 Starting Azure Deployment..."
Write-Info "   Zip File: $ZipFile"
Write-Info "   Target: $appUrl"
Write-Host ""

# Create Basic Auth header
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{
    Authorization = "Basic $base64Auth"
    ContentType = "application/zip"
}

# Deploy
try {
    Write-Info "📤 Uploading zip file to Azure..."
    $response = Invoke-RestMethod -Uri $publishUrl -Method Post -Headers $headers -InFile $ZipFile -ErrorAction Stop
    
    Write-Success "✅ Deployment initiated successfully!"
    Write-Host "   Deployment ID: $($response.id)" -ForegroundColor Gray
    Write-Host ""
    
    # Wait for deployment to process
    Write-Warning "⏳ Waiting for deployment to process (30 seconds)..."
    Start-Sleep -Seconds 30
    
    # Check deployment status
    Write-Info "🔍 Checking deployment status..."
    $statusUrl = "https://nms1-cchfa0g8czbkf0a7.scm.canadacentral-01.azurewebsites.net/api/deployments"
    $statusHeaders = @{Authorization = "Basic $base64Auth"}
    $deployments = Invoke-RestMethod -Uri $statusUrl -Method Get -Headers $statusHeaders
    $latest = $deployments[0]
    
    $statusText = switch ($latest.status) {
        4 { "✅ Success" }
        3 { "⏳ In Progress" }
        2 { "❌ Failed" }
        default { "❓ Unknown ($($latest.status))" }
    }
    
    Write-Host "   Status: $statusText" -ForegroundColor $(if ($latest.status -eq 4) { "Green" } elseif ($latest.status -eq 3) { "Yellow" } else { "Red" })
    Write-Host "   Received: $($latest.received_time)" -ForegroundColor Gray
    Write-Host ""
    
    # Check application health
    Write-Info "🏥 Checking application health..."
    $maxRetries = 6
    $retryDelay = 10
    $healthy = $false
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            $health = Invoke-WebRequest -Uri $appUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
            Write-Success "✅ Application is running!"
            Write-Host "   HTTP Status: $($health.StatusCode)" -ForegroundColor Gray
            Write-Host "   Response Time: $($health.Headers.'X-Response-Time')" -ForegroundColor Gray -ErrorAction SilentlyContinue
            
            # Try to parse JSON response
            try {
                $json = $health.Content | ConvertFrom-Json
                if ($json.status) {
                    Write-Host "   Status: $($json.status)" -ForegroundColor Gray
                    if ($json.uptime) {
                        Write-Host "   Uptime: $([math]::Round($json.uptime, 2)) seconds" -ForegroundColor Gray
                    }
                }
            } catch {
                # Not JSON, that's okay
            }
            
            $healthy = $true
            break
        } catch {
            if ($i -lt $maxRetries) {
                Write-Warning "   Attempt $i/$maxRetries: Application not ready yet, retrying in $retryDelay seconds..."
                Start-Sleep -Seconds $retryDelay
            } else {
                Write-Error "❌ Application not responding after $maxRetries attempts"
                Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
                Write-Info "💡 Check Azure Portal → App Service → Log stream for details"
            }
        }
    }
    
    Write-Host ""
    if ($healthy) {
        Write-Success "🎉 Deployment completed successfully!"
        Write-Info "   Application URL: $appUrl"
    } else {
        Write-Warning "⚠️  Deployment uploaded, but application may still be starting"
        Write-Info "   Check Azure Portal for deployment status and logs"
    }
    
} catch {
    Write-Error "❌ Deployment failed!"
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   HTTP Status: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 400) {
            Write-Host ""
            Write-Warning "💡 Common causes for 400 Bad Request:"
            Write-Host "   - Zip file structure is incorrect (package.json must be at root)"
            Write-Host "   - Zip file is corrupted"
            Write-Host "   - File size exceeds limits"
        }
    }
    
    exit 1
}

