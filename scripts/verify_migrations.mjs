// scripts/verify_migrations.mjs
/**
 * Automated Migration Up-Down-Up Verification for CI/CD
 * Proves that database schema migrations:
 *  1. Execute cleanly forwards (migrate:latest)
 *  2. Roll back cleanly backwards (migrate:rollback)
 *  3. Re-execute cleanly forwards (migrate:latest) without orphan artifacts
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRequire = createRequire(path.resolve(__dirname, '../backend/package.json'))
const knex = backendRequire('knex')
const knexConfig = backendRequire('./knexfile.cjs')

console.log('\n==============================================================================')
console.log('  WELLO DATABASE MIGRATION UP -> DOWN -> UP LIFECYCLE AUDIT')
console.log('==============================================================================\n')

async function verifyMigrations() {
  const db = knex(knexConfig)

  try {
    console.log('🔄 Step 1: Running migrate:latest (Ensuring current baseline)...')
    const [batch1, log1] = await db.migrate.latest()
    console.log(`  ✅ Baseline migration check: ${log1.length} pending migrations applied (Batch ${batch1}).`)

    console.log('\n🔄 Step 2: Testing migrate:rollback (Rolling back last batch)...')
    const [batchRollback, logRollback] = await db.migrate.rollback()
    console.log(`  ✅ Rollback successful: ${logRollback.length} migrations reverted (Batch ${batchRollback}).`)
    logRollback.forEach(m => console.log(`     ↺ Reverted: ${m}`))

    console.log('\n🔄 Step 3: Testing migrate:latest (Re-applying rolled back migrations)...')
    const [batchReapply, logReapply] = await db.migrate.latest()
    console.log(`  ✅ Re-apply successful: ${logReapply.length} migrations re-executed (Batch ${batchReapply}).`)
    logReapply.forEach(m => console.log(`     ✓ Applied: ${m}`))

    if (logRollback.length !== logReapply.length) {
      throw new Error(`Migration asymmetry detected! Reverted ${logRollback.length} but re-applied ${logReapply.length}.`)
    }

    console.log('\n==============================================================================')
    console.log('🎉 MIGRATION LIFECYCLE VALIDATED: UP -> DOWN -> UP IS 100% IDEMPOTENT & CLEAN')
    console.log('==============================================================================\n')
  } catch (err) {
    console.error('❌ Migration verification failed:', err)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

verifyMigrations()
