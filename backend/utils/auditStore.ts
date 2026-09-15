// server/utils/auditStore.ts
// Immutable Admin Audit Trail & Notification Store for Wello

export interface AuditLogRecord {
  id: string
  adminEmail: string
  action: string
  module: string
  target?: string
  prevValue?: string
  newValue?: string
  ipAddress?: string
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

// Seed initial audit log entries
auditLogs.push(
  {
    id: 'aud_1',
    adminEmail: 'admin@wello.com',
    action: 'SYSTEM_INITIALIZED',
    module: 'System',
    target: 'Wello Platform',
    newValue: 'Admin Panel & Data Architecture Seeded',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'aud_2',
    adminEmail: 'admin@wello.com',
    action: 'RESEND_CONFIG_UPDATED',
    module: 'Communications',
    target: 'Resend API Integration',
    newValue: 'Sender onboarding@resend.dev configured',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  }
)

export function recordAuditLog(log: Omit<AuditLogRecord, 'id' | 'createdAt'>): AuditLogRecord {
  const record: AuditLogRecord = {
    id: 'aud_' + Math.random().toString(36).slice(2, 9),
    createdAt: new Date().toISOString(),
    ...log,
  }
  auditLogs.unshift(record)
  if (auditLogs.length > 5000) auditLogs.pop()
  return record
}

export function getAuditLogs(limit: number = 200, moduleFilter?: string): AuditLogRecord[] {
  if (moduleFilter && moduleFilter !== 'all') {
    return auditLogs.filter(a => a.module.toLowerCase() === moduleFilter.toLowerCase()).slice(0, limit)
  }
  return auditLogs.slice(0, limit)
}

// Notifications
export function pushAdminNotification(notif: Omit<AdminNotification, 'id' | 'isRead' | 'createdAt'>): AdminNotification {
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
