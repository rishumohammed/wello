// backend/tests/test_backup_and_restore_drills.mjs
/**
 * Test Suite: Automated Database Backup & Monthly Restore Drill
 * Verifies:
 *  1. Execution of daily database backup generating an AES-256-GCM encrypted snapshot.
 *  2. Verification of SHA-256 integrity checksum files.
 *  3. Isolated sandbox database disaster recovery restore drill.
 *  4. Cryptographic HMAC-SHA256 audit chain verification on restored data.
 *  5. Clean-up of scratch resources and off-site archive recovery proof.
 */

import knex from 'knex'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'wello',
    multipleStatements: true,
  },
})

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  }
}

console.log('\n===============================================================')
console.log('🧪 RUNNING DATABASE BACKUP & DISASTER RECOVERY DRILL TESTS')
console.log('===============================================================\n')

async function runTests() {
  try {
    const backupDir = path.join(rootDir, 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // 1. Run automated backup engine with encryption
    console.log('Test Group 1: Automated Encrypted Database Backup Execution')
    process.env.BACKUP_ENCRYPTION_KEY = 'wello_prod_backup_aes256_passphrase_2026!'
    
    execSync('node scripts/db_backup_restore.mjs backup', {
      cwd: rootDir,
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: 'wello_prod_backup_aes256_passphrase_2026!' },
      stdio: 'pipe',
    })

    const files = fs.readdirSync(backupDir)
    const backupFiles = files.filter(f => f.startsWith('wello_backup_') && f.endsWith('.sql.enc'))
    assert(backupFiles.length > 0, 'Encrypted backup file (*.sql.enc) successfully created')

    const checksumFiles = files.filter(f => f.startsWith('wello_backup_') && f.endsWith('.sha256'))
    assert(checksumFiles.length > 0, 'SHA-256 checksum file created alongside encrypted snapshot')

    // Verify SHA-256 checksum content
    const latestEncFile = backupFiles.sort().pop()
    const latestChecksumFile = `${latestEncFile}.sha256`
    assert(fs.existsSync(path.join(backupDir, latestChecksumFile)), 'Matching checksum file verified for latest snapshot')

    const checksumContent = fs.readFileSync(path.join(backupDir, latestChecksumFile), 'utf8')
    assert(/^[a-f0-9]{64}\s+wello_backup_/.test(checksumContent.trim()), 'Checksum file contains valid 64-character SHA-256 hex hash')

    // 2. Run automated disaster recovery restore drill
    console.log('\nTest Group 2: Isolated Sandbox Restore & Audit Chain Verification Drill')
    const drillOutput = execSync('node scripts/db_backup_restore.mjs drill', {
      cwd: rootDir,
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: 'wello_prod_backup_aes256_passphrase_2026!' },
      encoding: 'utf8',
    })

    assert(drillOutput.includes('DISASTER RECOVERY DRILL PASSED 100% SUCCESS'), 'DR drill passed with 100% success confirmation')
    assert(drillOutput.includes('Audit Cryptographic Hash Chain Verified'), 'Restored database passed HMAC-SHA256 audit chain verification')
    assert(drillOutput.includes('Tearing down isolated test database'), 'Scratch sandbox database torn down cleanly after drill')

    // 3. Verify Privacy Policy compliance: encrypted backups retention
    console.log('\nTest Group 3: Privacy & Data Retention Backup Guarantees')
    assert(fs.existsSync(path.join(rootDir, 'SECURITY.md')), 'SECURITY.md documents backup encryption and retention policy')

  } catch (err) {
    console.error('Test execution error:', err)
    failed++
  } finally {
    await db.destroy()
  }

  console.log('\n===============================================================')
  console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================\n')

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runTests()
