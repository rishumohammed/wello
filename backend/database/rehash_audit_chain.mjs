// backend/database/rehash_audit_chain.mjs
import crypto from 'node:crypto'
import knex from 'knex'
import knexConfig from '../knexfile.cjs'

const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || 'wello-audit-hmac-sha256-secret-key-production-2026'
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

function calculateAuditHash(entry, previousHash) {
  const payload = [
    previousHash || GENESIS_HASH,
    (entry.actor_email || entry.admin_email || '').trim().toLowerCase(),
    (entry.permission_used || '').trim(),
    (entry.action || '').trim().toUpperCase(),
    (entry.module || '').trim(),
    (entry.target || '').trim(),
    (entry.reason || '').trim(),
    (entry.ip_address || '').trim(),
    (entry.user_agent || '').trim(),
    entry.prev_value || '',
    entry.new_value || '',
    entry.created_at ? new Date(entry.created_at).toISOString() : '',
  ].join('|')

  return crypto.createHmac('sha256', AUDIT_HMAC_SECRET).update(payload, 'utf8').digest('hex')
}

async function rehashChain() {
  const db = knex(knexConfig)
  console.log('==> Re-hashing audit logs chain with HMAC-SHA256...')

  try {
    // 1. Temporarily drop triggers
    await db.raw('DROP TRIGGER IF EXISTS before_audit_logs_update')
    await db.raw('DROP TRIGGER IF EXISTS before_audit_logs_delete')

    // 2. Fetch all audit rows
    const rows = await db('audit_logs').orderBy('id', 'asc')
    console.log(`    Found ${rows.length} audit rows. Recomputing hashes...`)

    let prevHash = GENESIS_HASH
    for (const row of rows) {
      const computedHash = calculateAuditHash(row, prevHash)
      await db('audit_logs').where({ id: row.id }).update({
        previous_hash: prevHash,
        hash: computedHash,
      })
      prevHash = computedHash
    }

    // 3. Re-create append-only triggers
    await db.raw(`
      CREATE TRIGGER before_audit_logs_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Security Violation: audit_logs is append-only. Updates are prohibited.';
      END;
    `)

    await db.raw(`
      CREATE TRIGGER before_audit_logs_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Security Violation: audit_logs is append-only. Deletes are prohibited.';
      END;
    `)

    console.log(`==> [OK] Successfully re-hashed ${rows.length} rows. Head Hash: ${prevHash}`)
  } finally {
    await db.destroy()
  }
}

rehashChain().catch(err => {
  console.error('Re-hash failed:', err)
  process.exit(1)
})
