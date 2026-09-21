# ==============================================================================
# Wello Manual Server Deployment Script (Windows PowerShell)
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "       WELLO PRODUCTION MANUAL DEPLOYMENT PIPELINE    " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Step 1: Check Environment File
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found in current directory!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure production secrets before deploying." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] .env file found." -ForegroundColor Green

# Step 2: Git Pull Latest Changes
Write-Host "`n[1/6] Pulling latest updates from Git..." -ForegroundColor Cyan
try {
    $currentBranch = git rev-parse --abbrev-ref HEAD
    git pull origin $currentBranch
} catch {
    Write-Host "[WARN] Git pull encountered a warning: $_" -ForegroundColor Yellow
}

# Step 3: Pre-Deployment Database Snapshot
Write-Host "`n[2/6] Performing pre-deployment database backup..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$mysqlRunning = docker compose ps -q mysql 2>$null
if ($mysqlRunning) {
    $backupFile = "$backupDir\pre_deploy_backup_$timestamp.sql"
    Write-Host "Creating snapshot: $backupFile ..." -ForegroundColor Yellow
    
    # Extract DB credentials
    $envContent = Get-Content ".env"
    $dbName = "wello"
    $dbUser = "wello_user"
    $dbPass = ""
    
    foreach ($line in $envContent) {
        if ($line -match "^DB_NAME=(.*)$") { $dbName = $matches[1].Trim('"').Trim("'") }
        if ($line -match "^DB_USER=(.*)$") { $dbUser = $matches[1].Trim('"').Trim("'") }
        if ($line -match "^DB_PASSWORD=(.*)$") { $dbPass = $matches[1].Trim('"').Trim("'") }
    }
    
    docker compose exec -T mysql mysqldump -u"$dbUser" -p"$dbPass" --single-transaction --routines --triggers "$dbName" > $backupFile
    Write-Host "[OK] Pre-deployment database backup created at $backupFile" -ForegroundColor Green
} else {
    Write-Host "[SKIP] MySQL container is not running yet. Skipping pre-deploy DB snapshot." -ForegroundColor Yellow
}

# Step 4: Build and Restart Docker Containers
Write-Host "`n[3/6] Building and starting updated containers..." -ForegroundColor Cyan
docker compose up -d --build --remove-orphans

# Step 5: Execute Database Migrations
Write-Host "`n[4/6] Running Knex database migrations..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
docker compose exec -T backend npx knex migrate:latest --knexfile knexfile.cjs
Write-Host "[OK] Database migrations completed successfully." -ForegroundColor Green

# Step 6: Healthcheck Verification & Probe
Write-Host "`n[5/6] Probing backend and system health endpoints..." -ForegroundColor Cyan
$maxRetries = 12
$healthy = $false

for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $healthy = $true
                break
            }
        } catch {}
    }
    Write-Host "Waiting for application healthcheck (Attempt $i/$maxRetries)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}

if ($healthy) {
    Write-Host "[SUCCESS] Health check passed (HTTP 200)." -ForegroundColor Green
    Write-Host "`n[6/6] Deployment finished successfully!" -ForegroundColor Cyan
    Write-Host "Wello is live and serving traffic at http://localhost" -ForegroundColor Green
} else {
    Write-Host "[FATAL] Health check failed after $maxRetries attempts!" -ForegroundColor Red
    Write-Host "Check container logs: docker compose logs backend" -ForegroundColor Yellow
    exit 1
}
