// server/utils/auditStore.ts
// Cryptographically Tamper-Evident, Append-Only Admin Audit Trail & Notification Store for Wello

import crypto from 'node:crypto'
import { getDb } from './db'

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

export interface AuditLogRecord {
  id: string | number
  adminEmail: string
  actorId?: number
  action: string
  module: string
  permissionUsed?: string
  target?: string
  reason?: string
  prevValue?: string
  newValue?: string
  diffJson?: any
  ipAddress?: string
  userAgent?: string
  previousHash: string
  hash: string
  createdAt: string
}

export interface AdminNotification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  metadata?: Record<string, any>
  createdAt: string
}

const auditLogs: AuditLogRecord[] = []
const adminNotifications: AdminNotification[] = []

/**
 * Computes canonical SHA-256 hash for an audit log record linking to previous hash
 */
export function calculateAuditHash(
  entry: {
    adminEmail?: string
    actorId?: number
    action?: string
    module?: string
    permissionUsed?: string
    target?: string
    reason?: string
    prevValue?: string
    newValue?: string
    ipAddress?: string
    userAgent?: string
    createdAt?: string
  },
  previousHash: string
): string {
  const payload = [
    previousHash || GENESIS_HASH,
    (entry.adminEmail || '').trim().toLowerCase(),
    (entry.permissionUsed || '').trim(),
    (entry.action || '').trim().toUpperCase(),
    (entry.module || '').trim(),
    (entry.target || '').trim(),
    (entry.reason || '').trim(),
    (entry.ipAddress || '').trim(),
    (entry.userAgent || '').trim(),
    entry.prevValue || '',
    entry.newValue || '',
    entry.createdAt ? new Date(entry.createdAt).toISOString() : '',
  ].join('|')

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
}

let hasBackfilled = false

/**
 * Ensures any legacy unhashed records in MySQL database are sequentially backfilled
 * from GENESIS_HASH into a valid cryptographic hash chain.
 */
export async function ensureAuditChainBackfilled(): Promise<void> {
  if (hasBackfilled) return
  try {
    const db = getDb()
    const unhashed = await db('audit_logs')
      .where('hash', GENESIS_HASH)
      .orWhereNull('hash')
      .orWhere('hash', '')
      .first()

    if (unhashed) {
      const allRows = await db('audit_logs').orderBy('id', 'asc')
      let prevHash = GENESIS_HASH
      for (const row of allRows) {
        const rowCreatedAt = row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
        const computedHash = calculateAuditHash(
          {
            adminEmail: row.actor_email || row.admin_email,
            actorId: row.actor_id,
            action: row.action,
            module: row.module,
            permissionUsed: row.permission_used,
            target: row.target,
            reason: row.reason,
            prevValue: row.prev_value,
            newValue: row.new_value,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            createdAt: rowCreatedAt,
          },
          prevHash
        )

        await db('audit_logs').where({ id: row.id }).update({
          previous_hash: prevHash,
          hash: computedHash,
        })
        prevHash = computedHash
      }
    }
    hasBackfilled = true
  } catch (err) {
    // Table may not exist during early boot
  }
}

/**
 * Returns the most recent audit hash in the chain (from DB or in-memory)
 */
export async function getLatestAuditHash(): Promise<string> {
  await ensureAuditChainBackfilled()
  try {
    const db = getDb()
    const lastRow = await db('audit_logs')
      .whereNotNull('hash')
      .where('hash', '!=', GENESIS_HASH)
      .orderBy('id', 'desc')
      .first()

    if (lastRow && lastRow.hash && lastRow.hash.length === 64) {
      return lastRow.hash
    }
  } catch (err) {
    // Database table might not be reachable or empty
  }

  if (auditLogs.length > 0) {
    return auditLogs[0].hash
  }

  return GENESIS_HASH
}

/**
 * Appends a tamper-evident audit log record to both MySQL DB and memory store.
 * STRICTLY INSERT ONLY — NO UPDATE OR DELETE GRANTED.
 */
export async function recordAuditLog(
  log: Omit<AuditLogRecord, 'id' | 'previousHash' | 'hash' | 'createdAt'> & { createdAt?: string }
): Promise<AuditLogRecord> {
  await ensureAuditChainBackfilled()
  const createdAt = log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString()
  const previousHash = await getLatestAuditHash()

  const hash = calculateAuditHash(
    {
      adminEmail: log.adminEmail,
      actorId: log.actorId,
      action: log.action,
      module: log.module,
      permissionUsed: log.permissionUsed,
      target: log.target,
      reason: log.reason,
      prevValue: log.prevValue,
      newValue: log.newValue,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt,
    },
    previousHash
  )

  let newDbId: number | null = null

  try {
    const db = getDb()
    const [insertedId] = await db('audit_logs').insert({
      admin_email: log.adminEmail || 'system@wello.local',
      actor_id: log.actorId || null,
      actor_email: log.adminEmail || 'system@wello.local',
      action: log.action,
      module: log.module,
      permission_used: log.permissionUsed || null,
      target: log.target || null,
      reason: log.reason || null,
      prev_value: log.prevValue || null,
      new_value: log.newValue || null,
      diff_json: log.diffJson ? JSON.stringify(log.diffJson) : null,
      ip_address: log.ipAddress || null,
      user_agent: log.userAgent || null,
      previous_hash: previousHash,
      hash,
      created_at: new Date(createdAt),
    })
    newDbId = insertedId
  } catch (err) {
    console.warn('[Audit Log DB Write Warning]:', err)
  }

  const record: AuditLogRecord = {
    id: newDbId || ('aud_' + Math.random().toString(36).slice(2, 9)),
    adminEmail: log.adminEmail || 'system@wello.local',
    actorId: log.actorId,
    action: log.action,
    module: log.module,
    permissionUsed: log.permissionUsed,
    target: log.target,
    reason: log.reason,
    prevValue: log.prevValue,
    newValue: log.newValue,
    diffJson: log.diffJson,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    previousHash,
    hash,
    createdAt,
  }

  auditLogs.unshift(record)
  if (auditLogs.length > 5000) auditLogs.pop()

  return record
}

/**
 * Fetches audit logs from database (or in-memory fallback)
 */
export async function getAuditLogs(limit: number = 200, moduleFilter?: string): Promise<AuditLogRecord[]> {
  try {
    const db = getDb()
    let query = db('audit_logs').orderBy('id', 'desc').limit(limit)

    if (moduleFilter && moduleFilter !== 'all') {
      query = query.whereRaw('LOWER(module) = ?', [moduleFilter.toLowerCase()])
    }

    const rows = await query
    if (rows && rows.length > 0) {
      return rows.map((r: any) => ({
        id: r.id,
        adminEmail: r.actor_email || r.admin_email,
        actorId: r.actor_id,
        action: r.action,
        module: r.module,
        permissionUsed: r.permission_used,
        target: r.target,
        reason: r.reason,
        prevValue: r.prev_value,
        newValue: r.new_value,
        diffJson: typeof r.diff_json === 'string' ? JSON.parse(r.diff_json) : r.diff_json,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        previousHash: r.previous_hash || GENESIS_HASH,
        hash: r.hash || '',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }))
    }
  } catch (err) {
    // Fallback to in-memory
  }

  if (moduleFilter && moduleFilter !== 'all') {
    return auditLogs.filter(a => a.module.toLowerCase() === moduleFilter.toLowerCase()).slice(0, limit)
  }
  return auditLogs.slice(0, limit)
}

/**
 * Cryptographically verifies the entire audit log chain integrity from genesis to tip.
 * Returns verification status and flags any tampering.
 */
export async function verifyAuditLogChain(): Promise<{
  valid: boolean
  totalEntries: number
  verifiedAt: string
  corruptedAtId?: string | number
  expectedHash?: string
  actualHash?: string
  reason?: string
}> {
  await ensureAuditChainBackfilled()
  let records: AuditLogRecord[] = []

  try {
    const db = getDb()
    const rows = await db('audit_logs').orderBy('id', 'asc')
    if (rows && rows.length > 0) {
      records = rows.map((r: any) => ({
        id: r.id,
        adminEmail: r.actor_email || r.admin_email,
        actorId: r.actor_id,
        action: r.action,
        module: r.module,
        permissionUsed: r.permission_used,
        target: r.target,
        reason: r.reason,
        prevValue: r.prev_value,
        newValue: r.new_value,
        diffJson: r.diff_json,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        previousHash: r.previous_hash || GENESIS_HASH,
        hash: r.hash,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      }))
    }
  } catch (err) {
    // Fallback to in-memory (chronological order)
    records = [...auditLogs].reverse()
  }

  if (records.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      verifiedAt: new Date().toISOString(),
    }
  }

  let expectedPrevHash = GENESIS_HASH

  for (let i = 0; i < records.length; i++) {
    const row = records[i]

    // 1. Verify link to previous row
    if (row.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: records.length,
        corruptedAtId: row.id,
        expectedHash: expectedPrevHash,
        actualHash: row.previousHash,
        reason: `Broken chain link at log entry #${row.id}. Expected previous_hash ${expectedPrevHash}, but found ${row.previousHash}.`,
        verifiedAt: new Date().toISOString(),
      }
    }

    // 2. Recompute SHA-256 hash
    const recomputedHash = calculateAuditHash(
      {
        adminEmail: row.adminEmail,
        actorId: row.actorId,
        action: row.action,
        module: row.module,
        permissionUsed: row.permissionUsed,
        target: row.target,
        reason: row.reason,
        prevValue: row.prevValue,
        newValue: row.newValue,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
      },
      row.previousHash
    )

    if (recomputedHash !== row.hash) {
      return {
        valid: false,
        totalEntries: records.length,
        corruptedAtId: row.id,
        expectedHash: recomputedHash,
        actualHash: row.hash,
        reason: `Tampering detected at log entry #${row.id}. Payload does not match cryptographic signature.`,
        verifiedAt: new Date().toISOString(),
      }
    }

    expectedPrevHash = row.hash
  }

  return {
    valid: true,
    totalEntries: records.length,
    verifiedAt: new Date().toISOString(),
  }
}

// ─── Admin Notifications ─────────────────────────────────────────────────────

export function pushAdminNotification(
  notif: Omit<AdminNotification, 'id' | 'isRead' | 'createdAt'>
): AdminNotification {
  const record: AdminNotification = {
    id: 'notif_' + Math.random().toString(36).slice(2, 9),
    isRead: false,
    createdAt: new Date().toISOString(),
    ...notif,
  }
  adminNotifications.unshift(record)
  return record
}

export function getAdminNotifications(): AdminNotification[] {
  return [...adminNotifications]
}

export function markNotificationRead(id: string): void {
  const n = adminNotifications.find(x => x.id === id)
  if (n) n.isRead = true
}
