// server/utils/emailEngine.ts
// Email Template Manager, Variable Interpolation & Resend Dispatch Engine for Wello

export interface EmailTemplate {
  id: string
  templateKey: string
  name: string
  subject: string
  bodyHtml: string
  bodyText?: string
  variables: string[]
  isActive: boolean
  updatedAt: string
}

export interface EmailLogEntry {
  id: string
  recipient: string
  templateKey?: string
  subject: string
  status: 'sent' | 'failed' | 'pending'
  providerMsgId?: string
  errorMessage?: string
  createdAt: string
}

const templatesStore = new Map<string, EmailTemplate>()
const emailLogsStore: EmailLogEntry[] = []

// Seed standard email templates
const defaultTemplates: EmailTemplate[] = [
  {
    id: 'tmpl_1',
    templateKey: 'welcome',
    name: 'Welcome to Wello',
    subject: 'Welcome to Wello, {{first_name}}!',
    bodyHtml: `<p>Hello <strong>{{first_name}}</strong>,</p><p>Welcome to Wello — your work value & income command center! We are excited to have you on board.</p>`,
    variables: ['first_name', 'email'],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_2',
    templateKey: 'email_verification',
    name: 'Email Verification OTP',
    subject: 'Your Wello Verification Code: {{otp_code}}',
    bodyHtml: `<p>Hello <strong>{{first_name}}</strong>,</p><p>Use the 6-digit code below to log in to Wello:</p><h2>{{otp_code}}</h2>`,
    variables: ['first_name', 'email', 'otp_code'],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_3',
    templateKey: 'category_request_approved',
    name: 'Category Request Approved',
    subject: 'Good news! Your category request for "{{category_name}}" was approved',
    bodyHtml: `<p>Hello <strong>{{first_name}}</strong>,</p><p>Great news! The category <strong>{{category_name}}</strong> you requested is now live on Wello.</p>`,
    variables: ['first_name', 'category_name'],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_4',
    templateKey: 'system_notification',
    name: 'Important System Announcement',
    subject: 'Wello Update: {{notification_title}}',
    bodyHtml: `<p>Hello <strong>{{first_name}}</strong>,</p><p>{{notification_message}}</p>`,
    variables: ['first_name', 'notification_title', 'notification_message'],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
]

defaultTemplates.forEach(t => templatesStore.set(t.templateKey, t))

export function getAllEmailTemplates(): EmailTemplate[] {
  return Array.from(templatesStore.values())
}

export function getEmailTemplate(key: string): EmailTemplate | null {
  return templatesStore.get(key) || null
}

export function updateEmailTemplate(key: string, payload: Partial<EmailTemplate>): EmailTemplate | null {
  const tmpl = templatesStore.get(key)
  if (!tmpl) return null
  if (payload.subject) tmpl.subject = payload.subject
  if (payload.bodyHtml) tmpl.bodyHtml = payload.bodyHtml
  if (payload.isActive !== undefined) tmpl.isActive = payload.isActive
  tmpl.updatedAt = new Date().toISOString()
  templatesStore.set(key, tmpl)
  return tmpl
}

export function renderEmailTemplate(templateKey: string, variables: Record<string, string>): { subject: string; html: string } {
  const tmpl = templatesStore.get(templateKey)
  if (!tmpl) {
    return { subject: 'Notification', html: '<p>System notification</p>' }
  }

  let subject = tmpl.subject
  let html = tmpl.bodyHtml

  Object.entries(variables).forEach(([k, v]) => {
    const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g')
    subject = subject.replace(regex, v || '')
    html = html.replace(regex, v || '')
  })

  return { subject, html }
}

export function logEmailDispatch(entry: Omit<EmailLogEntry, 'id' | 'createdAt'>): EmailLogEntry {
  const log: EmailLogEntry = {
    id: 'elog_' + Math.random().toString(36).slice(2, 9),
    createdAt: new Date().toISOString(),
    ...entry,
  }
  emailLogsStore.unshift(log)
  if (emailLogsStore.length > 2000) emailLogsStore.pop()
  return log
}

export function getAllEmailLogs(limit: number = 200): EmailLogEntry[] {
  return emailLogsStore.slice(0, limit)
}
