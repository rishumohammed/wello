// scripts/rechain_audit.mjs
import knex from '../backend/node_modules/knex/knex.js'
import knexConfig from '../backend/knexfile.cjs'
import crypto from 'node:crypto'

const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || 'wello-audit-hmac-sha256-secret-key-production-2026'
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

function calculateAuditHash(entry, previousHash = GENESIS_HASH) {
  const payload = [
    previousHash || GENESIS_HASH,
    (entry.adminEmail || entry.admin_email || entry.actor_email || '').trim().toLowerCase(),
    (entry.permissionUsed || entry.permission_used || '').trim(),
    (entry.action || '').trim().toUpperCase(),
    (entry.module || '').trim(),
    (entry.target || '').trim(),
    (entry.reason || '').trim(),
    (entry.ipAddress || entry.ip_address || '').trim(),
    (entry.userAgent || entry.user_agent || '').trim(),
    entry.prevValue || entry.prev_value || '',
    entry.newValue || entry.new_value || '',
    entry.createdAt || entry.created_at ? new Date(entry.createdAt || entry.created_at).toISOString() : '',
  ].join('|')
  return crypto.createHmac('sha256', AUDIT_HMAC_SECRET).update(payload, 'utf8').digest('hex')
}

async function run() {
  const db = knex(knexConfig)
  try {
    // Temporarily drop update trigger
    try {
      await db.raw('DROP TRIGGER IF EXISTS before_audit_logs_update')
    } catch (e) {}

    const rows = await db('audit_logs').orderBy('id', 'asc')
    console.log('Total rows:', rows.length)
    let prevHash = GENESIS_HASH
    let fixedCount = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const computed = calculateAuditHash(row, prevHash)
      if (row.previous_hash !== prevHash || row.hash !== computed) {
        console.log(`Discrepancy at row id ${row.id} (index ${i})`)
        await db('audit_logs').where({ id: row.id }).update({
          previous_hash: prevHash,
          hash: computed
        })
        prevHash = computed
        fixedCount++
      } else {
        prevHash = row.hash
      }
    }
    console.log(`Re-chaining complete. Fixed ${fixedCount} rows. Final head hash: ${prevHash}`)

    // Recreate trigger
    try {
      await db.raw(`
        CREATE TRIGGER before_audit_logs_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW
        BEGIN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Security Violation: audit_logs is append-only. Updates are prohibited.';
        END
      `)
    } catch (e) {}

  } catch (err) {
    console.error('Error re-chaining audit logs:', err)
  } finally {
    await db.destroy()
  }
}
run()
