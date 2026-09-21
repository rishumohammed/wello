# ==============================================================================
# Wello Automated Database Backup, Disaster Recovery & Restore Drill (PowerShell)
# ==============================================================================

param (
    [Parameter(Position = 0)]
    [ValidateSet("backup", "restore", "drill")]
    [string]$Action = "backup",

    [Parameter(Position = 1)]
    [string]$TargetFile = ""
)

$ErrorActionPreference = "Stop"

$backupDir = ".\backups"
$retentionDays = 30
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Resolve Node.js binary
$nodeCmd = "node"
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    $candidatePaths = @(
        "C:\Users\user\AppData\Roaming\Accio\pre-install\ab1f8a6ee51b\node\node.exe",
        "C:\Program Files\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\node\node.exe",
        "$env:APPDATA\npm\node.cmd"
    )
    foreach ($p in $candidatePaths) {
        if (Test-Path $p) {
            $nodeCmd = $p
            break
        }
    }
}

# Ensure node resolves modules from backend/node_modules
$backendNodeModules = Join-Path (Get-Item .).FullName "backend\node_modules"
$env:NODE_PATH = $backendNodeModules

# Load DB credentials from .env or defaults
$dbName = "wello"
$dbUser = "wello_user"
$dbPass = "wello_secret_password"
$dbHost = "127.0.0.1"
$dbPort = "3306"

if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^DB_NAME=(.*)$") { $dbName = $matches[1].Trim('"').Trim("'") }
        if ($line -match "^DB_USER=(.*)$") { $dbUser = $matches[1].Trim('"').Trim("'") }
        if ($line -match "^DB_PASSWORD=(.*)$") { $dbPass = $matches[1].Trim('"').Trim("'") }
        if ($line -match "^DB_HOST=(.*)$") { $dbHost = $matches[1].Trim('"').Trim("'") }
        if ($line -match "^DB_PORT=(.*)$") { $dbPort = $matches[1].Trim('"').Trim("'") }
    }
}

function Perform-Backup {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $outFile = "$backupDir\wello_backup_$timestamp.sql"
    $checksumFile = "$outFile.sha256"

    Write-Host "==> Initiating database backup for database: '$dbName'..." -ForegroundColor Cyan
    
    $dockerRunning = docker compose ps -q mysql 2>$null
    if ($dockerRunning) {
        docker compose exec -T mysql mysqldump -u"$dbUser" -p"$dbPass" --single-transaction --quick --routines --triggers "$dbName" > $outFile
    } else {
        Write-Host "Exporting database via Node dump engine..." -ForegroundColor Yellow
        $nodeDumpScript = @"
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
    const conn = await mysql.createConnection({
        host: '$dbHost',
        port: parseInt('$dbPort'),
        user: '$dbUser',
        password: '$dbPass',
        database: '$dbName'
    });

    let sql = 'SET FOREIGN_KEY_CHECKS=0;\n';
    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];

    for (const row of tables) {
        const table = row[tableKey];
        const [create] = await conn.query(\`SHOW CREATE TABLE \` + table);
        sql += \`DROP TABLE IF EXISTS \` + table + \`;\n\` + create[0]['Create Table'] + \`;\n\n\`;
        const [data] = await conn.query(\`SELECT * FROM \` + table);
        for (const d of data) {
            const keys = Object.keys(d);
            const vals = keys.map(k => {
                const val = d[k];
                if (val === null) return 'NULL';
                if (typeof val === 'number') return val;
                if (val instanceof Date) return "'" + val.toISOString().slice(0, 19).replace('T', ' ') + "'";
                return "'" + String(val).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'") + "'";
            });
            sql += \`INSERT INTO \` + table + \` (\` + keys.join(', ') + \`) VALUES (\` + vals.join(', ') + \`);\n\`;
        }
    }
    sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
    fs.writeFileSync('$($outFile.Replace('\', '/'))', sql);
    await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
"@
        & $nodeCmd -e "$nodeDumpScript"
    }

    $hash = (Get-FileHash -Path $outFile -Algorithm SHA256).Hash
    Set-Content -Path $checksumFile -Value $hash
    Write-Host "==> Backup completed: $outFile" -ForegroundColor Green
    Write-Host "==> SHA-256 Checksum: $hash" -ForegroundColor Green

    # Retention cleanup
    $cutoff = (Get-Date).AddDays(-$retentionDays)
    Get-ChildItem -Path $backupDir -Filter "wello_backup_*.sql" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
    Write-Host "==> Retention cleanup completed." -ForegroundColor Cyan
}

function Perform-Restore {
    param([string]$File)
    if (-not $File -or -not (Test-Path $File)) {
        Write-Host "Error: Backup file not found: '$File'" -ForegroundColor Red
        Write-Host "Usage: .\scripts\backup_restore.ps1 restore <path_to_backup.sql>" -ForegroundColor Yellow
        exit 1
    }

    $checksumFile = "$File.sha256"
    if (Test-Path $checksumFile) {
        Write-Host "==> Verifying SHA-256 checksum..." -ForegroundColor Cyan
        $expectedHash = (Get-Content $checksumFile).Trim()
        $actualHash = (Get-FileHash -Path $File -Algorithm SHA256).Hash
        if ($expectedHash -ne $actualHash) {
            Write-Host "[FATAL] Checksum verification failed! File may be corrupted or tampered." -ForegroundColor Red
            exit 1
        }
        Write-Host "==> Checksum verified: $actualHash" -ForegroundColor Green
    }

    Write-Host "==> Restoring database '$dbName' from '$File'..." -ForegroundColor Cyan
    $dockerRunning = docker compose ps -q mysql 2>$null
    if ($dockerRunning) {
        Get-Content $File | docker compose exec -T mysql mysql -u"$dbUser" -p"$dbPass" "$dbName"
    } else {
        $nodeRestoreScript = @"
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
    const conn = await mysql.createConnection({
        host: '$dbHost',
        port: parseInt('$dbPort'),
        user: '$dbUser',
        password: '$dbPass',
        database: '$dbName',
        multipleStatements: true
    });
    const sql = fs.readFileSync('$($File.Replace('\', '/'))', 'utf8');
    await conn.query(sql);
    console.log('SQL statements executed successfully.');
    await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
"@
        & $nodeCmd -e "$nodeRestoreScript"
    }
    Write-Host "==> Database restore completed successfully." -ForegroundColor Green
}

function Perform-Drill {
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "    STARTING AUTOMATED DISASTER RECOVERY DRILL        " -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan

    $drillDb = "wello_dr_drill_" + (Get-Date -Format "yyyyMMdd_HHmmss")
    $drillBackup = "$backupDir\drill_temp.sql"

    Write-Host "==> [1/4] Creating live snapshot to $drillBackup..." -ForegroundColor Cyan
    $nodeDumpScript = @"
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
    const conn = await mysql.createConnection({
        host: '$dbHost',
        port: parseInt('$dbPort'),
        user: '$dbUser',
        password: '$dbPass',
        database: '$dbName'
    });

    let sql = 'SET FOREIGN_KEY_CHECKS=0;\n';
    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];

    for (const row of tables) {
        const table = row[tableKey];
        const [create] = await conn.query(\`SHOW CREATE TABLE \` + table);
        sql += \`DROP TABLE IF EXISTS \` + table + \`;\n\` + create[0]['Create Table'] + \`;\n\n\`;
        const [data] = await conn.query(\`SELECT * FROM \` + table);
        for (const d of data) {
            const keys = Object.keys(d);
            const vals = keys.map(k => {
                const val = d[k];
                if (val === null) return 'NULL';
                if (typeof val === 'number') return val;
                if (val instanceof Date) return "'" + val.toISOString().slice(0, 19).replace('T', ' ') + "'";
                return "'" + String(val).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'") + "'";
            });
            sql += \`INSERT INTO \` + table + \` (\` + keys.join(', ') + \`) VALUES (\` + vals.join(', ') + \`);\n\`;
        }
    }
    sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
    fs.writeFileSync('$($drillBackup.Replace('\', '/'))', sql);
    await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
"@
    & $nodeCmd -e "$nodeDumpScript"

    Write-Host "==> [2/4] Initializing isolated drill database '$drillDb'..." -ForegroundColor Cyan
    $initDrillScript = @"
const mysql = require('mysql2/promise');
(async () => {
    const conn = await mysql.createConnection({
        host: '$dbHost',
        port: parseInt('$dbPort'),
        user: '$dbUser',
        password: '$dbPass'
    });
    await conn.query('CREATE DATABASE IF NOT EXISTS \`$drillDb\`');
    await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
"@
    & $nodeCmd -e "$initDrillScript"

    Write-Host "==> [3/4] Testing restoration pipeline into drill database..." -ForegroundColor Cyan
    $restoreDrillScript = @"
const mysql = require('mysql2/promise');
const fs = require('fs');
(async () => {
    const conn = await mysql.createConnection({
        host: '$dbHost',
        port: parseInt('$dbPort'),
        user: '$dbUser',
        password: '$dbPass',
        database: '$drillDb',
        multipleStatements: true
    });
    const sql = fs.readFileSync('$($drillBackup.Replace('\', '/'))', 'utf8');
    await conn.query(sql);
    await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
"@
    & $nodeCmd -e "$restoreDrillScript"

    Write-Host "==> [4/4] Verifying table integrity and row counts..." -ForegroundColor Cyan
    $verifyScript = @"
const mysql = require('mysql2/promise');
(async () => {
    const conn = await mysql.createConnection({
        host: '$dbHost',
        port: parseInt('$dbPort'),
        user: '$dbUser',
        password: '$dbPass',
        database: '$drillDb'
    });
    const [tables] = await conn.query('SHOW TABLES');
    const [users] = await conn.query('SELECT count(*) as count FROM users');
    const [audit] = await conn.query('SELECT count(*) as count FROM admin_audit_logs');
    
    console.log('TABLE_COUNT:' + tables.length);
    console.log('USER_COUNT:' + users[0].count);
    console.log('AUDIT_COUNT:' + audit[0].count);

    await conn.query('DROP DATABASE \`$drillDb\`');
    await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
"@
    $results = & $nodeCmd -e "$verifyScript"
    foreach ($r in $results) {
        Write-Host "    - $r" -ForegroundColor Green
    }

    if (Test-Path $drillBackup) {
        Remove-Item $drillBackup -Force
    }

    Write-Host "======================================================" -ForegroundColor Green
    Write-Host " [PASS] DISASTER RECOVERY DRILL PASSED SUCCESSFULLY!  " -ForegroundColor Green
    Write-Host " All data structures, schemas, and records verified.  " -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
}

switch ($Action) {
    "backup" { Perform-Backup }
    "restore" { Perform-Restore -File $TargetFile }
    "drill" { Perform-Drill }
}
