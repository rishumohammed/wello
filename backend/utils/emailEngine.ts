// server/utils/emailEngine.ts
// Email Template Manager, Variable Interpolation & Resend Dispatch Engine for Wello
// Hardened with HTML Escaping, Template Sanitization, and Live Previews

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

/**
 * Escapes user-supplied strings before HTML interpolation to prevent XSS.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Sanitizes admin-edited template HTML by stripping script tags, event handlers, and dangerous protocols.
 */
export function sanitizeTemplateHtml(html: string): string {
  if (!html) return ''
  return html
    // Strip <script>...</script>
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip <iframe>...</iframe>
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Strip inline javascript event handlers (e.g. onclick=, onerror=)
    .replace(/\s+on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    // Strip javascript: URLs
    .replace(/href\s*=\s*(["'])\s*javascript:[^"']*\1/gi, 'href="#"')
    // Strip data: URLs inside href (except images in src)
    .replace(/href\s*=\s*(["'])\s*data:[^"']*\1/gi, 'href="#"')
}

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
    bodyHtml: `<p>Hello <strong>{{first_name}}</strong>,</p><p>Use the 6-digit code below to log in to Wello:</p><h2 style="letter-spacing: 4px; color: #6366F1;">{{otp_code}}</h2>`,
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
  {
    id: 'tmpl_5',
    templateKey: 'invoice_dispatch',
    name: 'New Invoice Issued',
    subject: 'Invoice {{invoice_number}} from {{seller_name}}',
    bodyHtml: `<p>Hello <strong>{{customer_name}}</strong>,</p><p>Please find attached Invoice <strong>{{invoice_number}}</strong> for <strong>{{total_amount}}</strong> due on <strong>{{due_date}}</strong>.</p><p><a href="{{view_link}}" style="display:inline-block;background:#6366F1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">View & Pay Invoice</a></p><p>Thank you for your business!</p>`,
    variables: ['customer_name', 'seller_name', 'invoice_number', 'total_amount', 'due_date', 'view_link'],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_6',
    templateKey: 'invoice_reminder',
    name: 'Invoice Payment Reminder',
    subject: 'Friendly Reminder: Invoice {{invoice_number}} is {{due_status}}',
    bodyHtml: `<p>Hello <strong>{{customer_name}}</strong>,</p><p>This is a friendly reminder regarding Invoice <strong>{{invoice_number}}</strong> for <strong>{{balance_due}}</strong>, which was due on <strong>{{due_date}}</strong>.</p><p><a href="{{view_link}}" style="display:inline-block;background:#6366F1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Pay Balance Online</a></p>`,
    variables: ['customer_name', 'invoice_number', 'balance_due', 'due_date', 'due_status', 'view_link'],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_7',
    templateKey: 'quote_dispatch',
    name: 'Project Proposal & Quote',
    subject: 'Project Proposal: {{project_name}} from {{seller_name}}',
    bodyHtml: `<p>Hello <strong>{{customer_name}}</strong>,</p><p>{{seller_name}} has prepared a project proposal for <strong>{{project_name}}</strong> with total valuation <strong>{{quote_amount}}</strong>.</p><p><a href="{{view_link}}" style="display:inline-block;background:#6366F1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Review & Accept Proposal</a></p>`,
    variables: ['customer_name', 'seller_name', 'project_name', 'quote_amount', 'view_link'],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_8',
    templateKey: 'weekly_digest',
    name: 'Weekly Value & Hourly Rate Digest',
    subject: 'Your Weekly Value Digest: {{all_in_rate}}/hr ({{range_label}})',
    bodyHtml: `<p>Hello <strong>{{first_name}}</strong>,</p><p>Here is your weekly performance summary for <strong>{{range_label}}</strong>:</p><ul><li>All-In Real Rate: <strong>{{all_in_rate}}/h</strong> (Target: {{target_rate}}/h)</li><li>Net Income Collected: <strong>{{collected_net}}</strong></li><li>Total Hours: <strong>{{total_hours}} hrs</strong></li></ul><p><a href="{{report_link}}" style="display:inline-block;background:#6366F1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">View Interactive Report</a></p><p style="font-size:11px;color:#999;">To unsubscribe from digests, <a href="{{unsubscribe_link}}">click here</a>.</p>`,
    variables: ['first_name', 'range_label', 'all_in_rate', 'target_rate', 'collected_net', 'total_hours', 'report_link', 'unsubscribe_link'],
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
  if (payload.subject) tmpl.subject = payload.subject.trim()
  if (payload.bodyHtml) tmpl.bodyHtml = sanitizeTemplateHtml(payload.bodyHtml)
  if (payload.isActive !== undefined) tmpl.isActive = payload.isActive
  tmpl.updatedAt = new Date().toISOString()
  templatesStore.set(key, tmpl)
  return tmpl
}

/**
 * Renders an email template by safely escaping user-supplied variable values.
 */
export function renderEmailTemplate(
  templateKey: string,
  variables: Record<string, string>
): { subject: string; html: string } {
  const tmpl = templatesStore.get(templateKey)
  if (!tmpl) {
    return { subject: 'Notification', html: '<p>System notification</p>' }
  }

  let subject = tmpl.subject
  let html = tmpl.bodyHtml

  Object.entries(variables).forEach(([k, v]) => {
    const rawVal = v || ''
    // URLs can remain unescaped inside quotes but must avoid javascript:
    const isUrl = k.endsWith('_link') || k.endsWith('_url')
    const safeHtmlVal = isUrl ? rawVal.replace(/^javascript:/i, '') : escapeHtml(rawVal)
    const safeSubjectVal = rawVal.replace(/[\r\n]+/g, ' ')

    const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g')
    subject = subject.replace(regex, safeSubjectVal)
    html = html.replace(regex, safeHtmlVal)
  })

  return { subject, html }
}

/**
 * Standard sample data for previewing email templates
 */
export const templateSampleData: Record<string, Record<string, string>> = {
  welcome: {
    first_name: 'Alex',
    email: 'alex@example.com',
  },
  email_verification: {
    first_name: 'Alex',
    email: 'alex@example.com',
    otp_code: '482910',
  },
  category_request_approved: {
    first_name: 'Alex',
    category_name: 'AI Engineering & LLM Architecture',
  },
  system_notification: {
    first_name: 'Alex',
    notification_title: 'Scheduled Maintenance Complete',
    notification_message: 'All system optimizations and database indexing passes have been applied successfully.',
  },
  invoice_dispatch: {
    customer_name: 'Acme Corp',
    seller_name: 'Alex Dev Studio',
    invoice_number: 'INV-2026-0042',
    total_amount: '$4,500.00 USD',
    due_date: 'Oct 15, 2026',
    view_link: 'https://wello.app/invoices/public/tok_sample123',
  },
  invoice_reminder: {
    customer_name: 'Acme Corp',
    invoice_number: 'INV-2026-0042',
    balance_due: '$2,250.00 USD',
    due_date: 'Oct 15, 2026',
    due_status: 'Overdue by 3 days',
    view_link: 'https://wello.app/invoices/public/tok_sample123',
  },
  quote_dispatch: {
    customer_name: 'Acme Corp',
    seller_name: 'Alex Dev Studio',
    project_name: 'Full-Stack Modernization & Analytics Platform',
    quote_amount: '$12,000.00 USD',
    view_link: 'https://wello.app/quotes/public/tok_quote123',
  },
  weekly_digest: {
    first_name: 'Alex',
    range_label: 'Sep 14 – Sep 20, 2026',
    all_in_rate: '$142.50',
    target_rate: '$120.00',
    collected_net: '$5,700.00',
    total_hours: '40.0',
    report_link: 'https://wello.app/analytics/digest',
    unsubscribe_link: 'https://wello.app/settings/notifications',
  },
}

/**
 * Generates a preview of a template with sample or custom test data
 */
export function previewEmailTemplate(
  key: string,
  customVariables?: Record<string, string>
): { subject: string; html: string; sampleData: Record<string, string> } | null {
  const tmpl = templatesStore.get(key)
  if (!tmpl) return null

  const defaultSample = templateSampleData[key] || {}
  const variables = { ...defaultSample, ...(customVariables || {}) }
  const rendered = renderEmailTemplate(key, variables)

  return {
    subject: rendered.subject,
    html: rendered.html,
    sampleData: variables,
  }
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

export async function dispatchEmailWithLog(options: {
  to: string
  subject: string
  html: string
  templateKey?: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { sendEmailViaResend: authSendEmailViaResend } = await import('./authConfig')
    const res = await authSendEmailViaResend(options)
    logEmailDispatch({
      recipient: options.to,
      templateKey: options.templateKey,
      subject: options.subject,
      status: res.success ? 'sent' : 'failed',
      providerMsgId: res.data?.id,
      errorMessage: res.error,
    })
    return res
  } catch (err: any) {
    logEmailDispatch({
      recipient: options.to,
      templateKey: options.templateKey,
      subject: options.subject,
      status: 'failed',
      errorMessage: err?.message,
    })
    return { success: false, error: err?.message }
  }
}
