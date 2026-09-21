// server/api/admin/jobs/moderate.post.ts
import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3'
import { requirePermission, extractClientIp } from '../../../utils/authGuard'
import { getDb } from '../../../utils/db'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'jobs.manage')
  const body = await readBody(event)

  const jobId = Number(body?.jobId)
  const action = (body?.action || '').trim().toUpperCase()

  if (!jobId || isNaN(jobId)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid job ID is required.' })
  }

  const db = getDb()
  const job = await db('projects').where({ id: jobId }).whereNull('deleted_at').first()
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Job listing not found.' })
  }

  let updatePayload: Record<string, any> = {
    updated_at: db.fn.now(3),
  }
  let auditAction = 'JOB_MODERATED'
  let auditNewValue = ''

  if (action === 'FLAG') {
    const reason = (body?.flagReason || 'Flagged for moderation by administrator').trim()
    updatePayload.is_flagged = true
    updatePayload.flag_reason = reason
    updatePayload.flagged_at = db.fn.now(3)
    auditAction = 'JOB_FLAGGED'
    auditNewValue = `Flagged listing: "${reason}"`
  } else if (action === 'DISMISS_FLAG' || action === 'RESOLVE_FLAG') {
    updatePayload.is_flagged = false
    updatePayload.flag_reason = null
    updatePayload.moderated_at = db.fn.now(3)
    updatePayload.moderator_email = admin.email
    auditAction = 'JOB_FLAG_RESOLVED'
    auditNewValue = `Flag cleared and approved by ${admin.email}`
  } else if (action === 'UPDATE_STATUS') {
    const newStatus = (body?.status || '').toLowerCase().trim()
    const allowed = ['potential', 'quoted', 'approved', 'in_progress', 'completed', 'lost', 'suspended']
    if (!allowed.includes(newStatus)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid job status: ${newStatus}` })
    }
    updatePayload.status = newStatus
    updatePayload.moderated_at = db.fn.now(3)
    updatePayload.moderator_email = admin.email
    auditAction = 'JOB_STATUS_MODERATED'
    auditNewValue = `Status changed from ${job.status} to ${newStatus}`
  } else {
    throw createError({ statusCode: 400, statusMessage: `Unknown moderation action: ${action}` })
  }

  await db('projects').where({ id: jobId }).update(updatePayload)

  // Record audit log
  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: auditAction,
    module: 'Jobs',
    permissionUsed: 'jobs.manage',
    target: `Job #${jobId}: "${job.name}"`,
    ipAddress: extractClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent') || 'Admin UI',
    prevValue: `Status: ${job.status}, Flagged: ${Boolean(job.is_flagged)}`,
    newValue: auditNewValue,
  })

  return {
    success: true,
    message: `Job moderation updated: ${auditAction}`,
    jobId,
    action,
  }
})
