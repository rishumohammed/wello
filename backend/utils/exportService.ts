// backend/utils/exportService.ts
import zlib from 'zlib'
import { getDb } from './authService'

/**
 * Standard CSV line formatter escaping quotes and special characters according to RFC 4180.
 */
export function formatCsvRow(values: any[]): string {
  return values
    .map((val) => {
      if (val === null || val === undefined) return ''
      let str = typeof val === 'object' ? JSON.stringify(val) : String(val)
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    .join(',')
}

export function arrayToCsv(headers: string[], rows: any[][]): string {
  const headerLine = formatCsvRow(headers)
  const dataLines = rows.map((r) => formatCsvRow(r)).join('\r\n')
  return headerLine + (dataLines ? '\r\n' + dataLines : '')
}

/**
 * Pure Node.js standard-compliant ZIP archive generator using zlib.deflateRawSync and zlib.crc32.
 */
export function createZipArchive(files: { filename: string; content: Buffer | string }[]): Buffer {
  const localHeaders: Buffer[] = []
  const centralHeaders: Buffer[] = []
  let offset = 0

  const now = new Date()
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff
  const dosDate =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const file of files) {
    const uncompressed = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8')
    const compressed = zlib.deflateRawSync(uncompressed)
    const crc = typeof (zlib as any).crc32 === 'function'
      ? (zlib as any).crc32(uncompressed)
      : calculateCrc32(uncompressed)
    const filenameBuf = Buffer.from(file.filename, 'utf8')

    // Local Header
    const lh = Buffer.alloc(30 + filenameBuf.length)
    lh.writeUInt32LE(0x04034b50, 0) // Local file header signature
    lh.writeUInt16LE(20, 4) // Version needed to extract (2.0)
    lh.writeUInt16LE(0, 6) // General purpose bit flag
    lh.writeUInt16LE(8, 8) // Compression method: 8 = Deflate
    lh.writeUInt16LE(dosTime, 10)
    lh.writeUInt16LE(dosDate, 12)
    lh.writeUInt32LE(crc >>> 0, 14)
    lh.writeUInt32LE(compressed.length, 18)
    lh.writeUInt32LE(uncompressed.length, 22)
    lh.writeUInt16LE(filenameBuf.length, 26)
    lh.writeUInt16LE(0, 28) // Extra field length
    filenameBuf.copy(lh, 30)

    localHeaders.push(lh, compressed)

    // Central Directory Header
    const ch = Buffer.alloc(46 + filenameBuf.length)
    ch.writeUInt32LE(0x02014b50, 0) // Central directory file header signature
    ch.writeUInt16LE(20, 4) // Version made by
    ch.writeUInt16LE(20, 6) // Version needed to extract
    ch.writeUInt16LE(0, 8) // General purpose bit flag
    ch.writeUInt16LE(8, 10) // Compression method: 8 = Deflate
    ch.writeUInt16LE(dosTime, 12)
    ch.writeUInt16LE(dosDate, 14)
    ch.writeUInt32LE(crc >>> 0, 16)
    ch.writeUInt32LE(compressed.length, 20)
    ch.writeUInt32LE(uncompressed.length, 24)
    ch.writeUInt16LE(filenameBuf.length, 28)
    ch.writeUInt16LE(0, 30) // Extra field length
    ch.writeUInt16LE(0, 32) // File comment length
    ch.writeUInt16LE(0, 34) // Disk number start
    ch.writeUInt16LE(0, 36) // Internal file attributes
    ch.writeUInt32LE(0, 38) // External file attributes
    ch.writeUInt32LE(offset, 42) // Relative offset of local header
    filenameBuf.copy(ch, 46)

    centralHeaders.push(ch)

    offset += lh.length + compressed.length
  }

  const centralDirOffset = offset
  const centralDirBuf = Buffer.concat(centralHeaders)
  const centralDirSize = centralDirBuf.length

  // End of Central Directory Record
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // End of central dir signature
  eocd.writeUInt16LE(0, 4) // Number of this disk
  eocd.writeUInt16LE(0, 6) // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8) // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10) // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12) // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16) // Offset of start of central directory
  eocd.writeUInt16LE(0, 20) // Comment length

  return Buffer.concat([...localHeaders, centralDirBuf, eocd])
}

function calculateCrc32(buf: Buffer): number {
  let crc = -1
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320)
    }
  }
  return (crc ^ -1) >>> 0
}

/**
 * Collects full structured data for a user across all tracking entities.
 */
export async function collectFullUserData(userId: number): Promise<Record<string, any>> {
  const db = getDb()

  const user = await db('users').where({ id: userId }).first()
  if (!user) throw new Error('User not found')

  const clients = await db('clients').where({ user_id: userId, deleted_at: null })
  const projects = await db('projects').where({ user_id: userId, deleted_at: null })
  const workSessions = await db('work_sessions').where({ user_id: userId, deleted_at: null })
  const payments = await db('payments').where({ user_id: userId, deleted_at: null })
  const expenses = await db('project_expenses').where({ user_id: userId, deleted_at: null })
  const invoices = await db('invoices').where({ user_id: userId, deleted_at: null })
  const invoiceItems = await db('invoice_items')
    .whereIn('invoice_id', invoices.map((i: any) => i.id))
  const creditNotes = await db('credit_notes').where({ user_id: userId })
  const incomeSources = await db('income_sources').where({ user_id: userId, deleted_at: null })
  const overheadExpenses = await db('overhead_expenses').where({ user_id: userId, deleted_at: null })
  const userAddons = await db('user_addons').where({ user_id: userId })

  // Clean user record of sensitive secrets
  const sanitizedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    baseCurrency: user.base_currency,
    timezone: user.timezone,
    country: user.country,
    earningPersona: user.earning_persona,
    targetHourlyRate: user.target_hourly,
    targetMonthlyIncome: user.target_monthly_income,
    analyticsConsent: user.analytics_consent,
    createdAt: user.created_at,
  }

  return {
    exportVersion: '1.0.0',
    exportTimestamp: new Date().toISOString(),
    user: sanitizedUser,
    clients,
    projects,
    workSessions,
    payments,
    expenses,
    invoices,
    invoiceItems,
    creditNotes,
    incomeSources,
    overheadExpenses,
    userAddons,
  }
}

/**
 * Exports a specific entity as a formatted CSV string.
 */
export async function exportEntityCsv(userId: number, entity: string): Promise<string> {
  const db = getDb()

  switch (entity.toLowerCase()) {
    case 'sessions':
    case 'work_sessions': {
      const rows = await db('work_sessions')
        .leftJoin('projects', 'work_sessions.project_id', 'projects.id')
        .leftJoin('clients', 'projects.client_id', 'clients.id')
        .where('work_sessions.user_id', userId)
        .whereNull('work_sessions.deleted_at')
        .select(
          'work_sessions.id',
          'clients.name as client_name',
          'projects.name as project_name',
          'work_sessions.title',
          'work_sessions.type',
          'work_sessions.started_at',
          'work_sessions.ended_at',
          'work_sessions.duration_seconds',
          'work_sessions.payment_type',
          'work_sessions.unpaid_reason',
          'work_sessions.notes',
          'work_sessions.created_at'
        )
        .orderBy('work_sessions.started_at', 'desc')

      const headers = [
        'ID',
        'Client',
        'Project',
        'Title',
        'Type',
        'Started At',
        'Ended At',
        'Duration (Seconds)',
        'Duration (Minutes)',
        'Duration (Hours)',
        'Payment Type',
        'Unpaid Reason',
        'Notes',
        'Created At',
      ]

      const data = rows.map((r: any) => [
        r.id,
        r.client_name || '',
        r.project_name || '',
        r.title || 'Work session',
        r.type || 'other',
        r.started_at ? new Date(r.started_at).toISOString() : '',
        r.ended_at ? new Date(r.ended_at).toISOString() : '',
        r.duration_seconds || 0,
        Math.round((r.duration_seconds || 0) / 60),
        (Number(r.duration_seconds || 0) / 3600).toFixed(2),
        r.payment_type || 'unpaid',
        r.unpaid_reason || '',
        r.notes || '',
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])

      return arrayToCsv(headers, data)
    }

    case 'payments': {
      const rows = await db('payments')
        .leftJoin('projects', 'payments.project_id', 'projects.id')
        .leftJoin('clients', 'payments.client_id', 'clients.id')
        .where('payments.user_id', userId)
        .whereNull('payments.deleted_at')
        .select(
          'payments.id',
          'clients.name as client_name',
          'projects.name as project_name',
          'payments.amount',
          'payments.currency',
          'payments.paid_date',
          'payments.notes',
          'payments.created_at'
        )
        .orderBy('payments.paid_date', 'desc')

      const headers = [
        'ID',
        'Client',
        'Project',
        'Amount',
        'Currency',
        'Paid Date',
        'Notes',
        'Created At',
      ]

      const data = rows.map((r: any) => [
        r.id,
        r.client_name || '',
        r.project_name || '',
        r.amount,
        r.currency || 'USD',
        r.paid_date ? new Date(r.paid_date).toISOString() : '',
        r.notes || '',
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])

      return arrayToCsv(headers, data)
    }

    case 'expenses':
    case 'project_expenses': {
      const rows = await db('project_expenses')
        .leftJoin('projects', 'project_expenses.project_id', 'projects.id')
        .where('project_expenses.user_id', userId)
        .whereNull('project_expenses.deleted_at')
        .select(
          'project_expenses.id',
          'projects.name as project_name',
          'project_expenses.description',
          'project_expenses.amount',
          'project_expenses.currency',
          'project_expenses.expense_date',
          'project_expenses.category',
          'project_expenses.created_at'
        )
        .orderBy('project_expenses.expense_date', 'desc')

      const headers = [
        'ID',
        'Project',
        'Description',
        'Amount',
        'Currency',
        'Expense Date',
        'Category',
        'Created At',
      ]

      const data = rows.map((r: any) => [
        r.id,
        r.project_name || '',
        r.description || '',
        r.amount,
        r.currency || 'USD',
        r.expense_date ? new Date(r.expense_date).toISOString() : '',
        r.category || 'General',
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])

      return arrayToCsv(headers, data)
    }

    case 'invoices': {
      const rows = await db('invoices')
        .where({ user_id: userId, deleted_at: null })
        .orderBy('invoice_date', 'desc')

      const headers = [
        'ID',
        'Invoice Number',
        'Customer Name',
        'Customer Email',
        'Invoice Date',
        'Due Date',
        'Currency',
        'Subtotal',
        'Discount',
        'Tax Amount',
        'Total',
        'Amount Paid',
        'Balance Due',
        'Status',
        'Created At',
      ]

      const data = rows.map((r: any) => [
        r.id,
        r.invoice_number,
        r.customer_name,
        r.customer_email || '',
        r.invoice_date ? new Date(r.invoice_date).toISOString() : '',
        r.due_date ? new Date(r.due_date).toISOString() : '',
        r.currency || 'USD',
        r.subtotal,
        r.discount || 0,
        r.tax_amount || 0,
        r.total,
        r.amount_paid || 0,
        r.balance_due || 0,
        r.status,
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])

      return arrayToCsv(headers, data)
    }

    case 'clients': {
      const rows = await db('clients')
        .where({ user_id: userId, deleted_at: null })
        .orderBy('name', 'asc')

      const headers = ['ID', 'Name', 'Email', 'Company', 'Country', 'Notes', 'Created At']

      const data = rows.map((r: any) => [
        r.id,
        r.name,
        r.email || '',
        r.company || '',
        r.country || '',
        r.notes || '',
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])

      return arrayToCsv(headers, data)
    }

    case 'projects': {
      const rows = await db('projects')
        .leftJoin('clients', 'projects.client_id', 'clients.id')
        .where('projects.user_id', userId)
        .whereNull('projects.deleted_at')
        .select(
          'projects.id',
          'clients.name as client_name',
          'projects.name',
          'projects.service_category',
          'projects.status',
          'projects.currency',
          'projects.quote_amount',
          'projects.quote_est_hours',
          'projects.created_at'
        )
        .orderBy('projects.name', 'asc')

      const headers = [
        'ID',
        'Client',
        'Project Name',
        'Service Category',
        'Status',
        'Currency',
        'Quote Amount',
        'Quote Estimated Hours',
        'Created At',
      ]

      const data = rows.map((r: any) => [
        r.id,
        r.client_name || '',
        r.name,
        r.service_category || '',
        r.status || 'in_progress',
        r.currency || 'USD',
        r.quote_amount || 0,
        r.quote_est_hours || 0,
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])

      return arrayToCsv(headers, data)
    }

    case 'income_sources': {
      const rows = await db('income_sources')
        .where({ user_id: userId, deleted_at: null })
        .orderBy('name', 'asc')

      const headers = ['ID', 'Name', 'Type', 'Amount', 'Currency', 'Frequency', 'Active', 'Notes', 'Created At']
      const data = rows.map((r: any) => [
        r.id,
        r.name,
        r.type,
        r.amount,
        r.currency,
        r.frequency,
        r.is_active ? 'true' : 'false',
        r.notes || '',
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])
      return arrayToCsv(headers, data)
    }

    case 'overhead_expenses': {
      const rows = await db('overhead_expenses')
        .where({ user_id: userId, deleted_at: null })
        .orderBy('created_at', 'desc')

      const headers = ['ID', 'Description', 'Category', 'Amount', 'Currency', 'Expense Date', 'Recurring', 'Period', 'Notes', 'Created At']
      const data = rows.map((r: any) => [
        r.id,
        r.description,
        r.category,
        r.amount,
        r.currency,
        r.expense_date ? new Date(r.expense_date).toISOString() : '',
        r.is_recurring ? 'true' : 'false',
        r.recurring_period || '',
        r.notes || '',
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ])
      return arrayToCsv(headers, data)
    }

    default:
      throw new Error(`Unknown export entity: ${entity}`)
  }
}

/**
 * Builds a complete ZIP package containing full JSON and all individual entity CSV files.
 */
export async function exportAllUserDataZip(userId: number): Promise<Buffer> {
  const fullData = await collectFullUserData(userId)
  const jsonContent = JSON.stringify(fullData, null, 2)

  const [
    sessionsCsv,
    paymentsCsv,
    expensesCsv,
    invoicesCsv,
    clientsCsv,
    projectsCsv,
    incomeSourcesCsv,
    overheadsCsv,
  ] = await Promise.all([
    exportEntityCsv(userId, 'sessions').catch(() => ''),
    exportEntityCsv(userId, 'payments').catch(() => ''),
    exportEntityCsv(userId, 'expenses').catch(() => ''),
    exportEntityCsv(userId, 'invoices').catch(() => ''),
    exportEntityCsv(userId, 'clients').catch(() => ''),
    exportEntityCsv(userId, 'projects').catch(() => ''),
    exportEntityCsv(userId, 'income_sources').catch(() => ''),
    exportEntityCsv(userId, 'overhead_expenses').catch(() => ''),
  ])

  const files = [
    { filename: 'wello_export.json', content: jsonContent },
    { filename: 'work_sessions.csv', content: sessionsCsv },
    { filename: 'payments.csv', content: paymentsCsv },
    { filename: 'expenses.csv', content: expensesCsv },
    { filename: 'invoices.csv', content: invoicesCsv },
    { filename: 'clients.csv', content: clientsCsv },
    { filename: 'projects.csv', content: projectsCsv },
    { filename: 'income_sources.csv', content: incomeSourcesCsv },
    { filename: 'overhead_expenses.csv', content: overheadsCsv },
  ]

  return createZipArchive(files)
}
