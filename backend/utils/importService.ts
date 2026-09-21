// backend/utils/importService.ts
import { getDb } from './authService'

export interface CsvParsedRow {
  [key: string]: string
}

/**
 * Robust RFC 4180 compliant CSV parser supporting quotes, commas, escaped quotes, and newlines.
 */
export function parseCsv(csvText: string): { headers: string[]; rows: CsvParsedRow[] } {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim() // Strip BOM if present
  if (!cleanText) return { headers: [], rows: [] }

  const lines: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < cleanText.length) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentField.trim())
        currentField = ''
        i++
        continue
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField.trim())
        lines.push(currentRow)
        currentRow = []
        currentField = ''
        i += 2
        continue
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField.trim())
        lines.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    lines.push(currentRow)
  }

  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0].map((h) => h.trim())
  const rows: CsvParsedRow[] = []

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r]
    if (line.length === 1 && line[0] === '') continue // Skip empty trailing lines
    const rowObj: CsvParsedRow = {}
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = line[c] !== undefined ? line[c] : ''
    }
    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * Detects import format preset and proposes initial column mappings.
 */
export function detectPresetAndMapping(headers: string[]): {
  preset: 'toggl' | 'clockify' | 'wello' | 'generic'
  entityType: 'sessions' | 'payments' | 'clients'
  mapping: Record<string, string>
} {
  const hLower = headers.map((h) => h.toLowerCase())

  // 1. Clockify Detection (specific duration format headers)
  if (
    hLower.some((h) => h.includes('duration (h)') || h.includes('duration (decimal)') || h.includes('duration (h:m:s)') || h.includes('billable rate'))
  ) {
    const mapping: Record<string, string> = {}
    headers.forEach((h) => {
      const l = h.toLowerCase()
      if (l === 'project') mapping[h] = 'project_name'
      else if (l === 'client') mapping[h] = 'client_name'
      else if (l === 'description') mapping[h] = 'description'
      else if (l === 'task') mapping[h] = 'task'
      else if (l === 'start date') mapping[h] = 'start_date'
      else if (l === 'start time') mapping[h] = 'start_time'
      else if (l === 'end date') mapping[h] = 'end_date'
      else if (l === 'end time') mapping[h] = 'end_time'
      else if (l === 'duration (h)' || l === 'duration (h:m:s)' || l === 'duration') mapping[h] = 'duration_minutes'
      else if (l === 'duration (decimal)') mapping[h] = 'duration_hours'
      else if (l === 'billable') mapping[h] = 'payment_type'
    })
    return { preset: 'clockify', entityType: 'sessions', mapping }
  }

  // 2. Toggl Track Detection
  if (
    hLower.includes('user') &&
    (hLower.includes('start date') || hLower.includes('start time')) &&
    (hLower.includes('duration') || hLower.includes('tags'))
  ) {
    const mapping: Record<string, string> = {}
    headers.forEach((h) => {
      const l = h.toLowerCase()
      if (l === 'project') mapping[h] = 'project_name'
      else if (l === 'client') mapping[h] = 'client_name'
      else if (l === 'description') mapping[h] = 'description'
      else if (l === 'task') mapping[h] = 'task'
      else if (l === 'start date') mapping[h] = 'start_date'
      else if (l === 'start time') mapping[h] = 'start_time'
      else if (l === 'end date') mapping[h] = 'end_date'
      else if (l === 'end time') mapping[h] = 'end_time'
      else if (l === 'duration') mapping[h] = 'duration_minutes'
      else if (l === 'billable') mapping[h] = 'payment_type'
    })
    return { preset: 'toggl', entityType: 'sessions', mapping }
  }

  // 3. Wello Standard Detection
  if (hLower.includes('duration (minutes)') || hLower.includes('duration (hours)')) {
    const mapping: Record<string, string> = {}
    headers.forEach((h) => {
      const l = h.toLowerCase()
      if (l === 'client') mapping[h] = 'client_name'
      else if (l === 'project') mapping[h] = 'project_name'
      else if (l === 'start time') mapping[h] = 'start_time'
      else if (l === 'end time') mapping[h] = 'end_time'
      else if (l.includes('duration (minutes)')) mapping[h] = 'duration_minutes'
      else if (l.includes('duration (hours)')) mapping[h] = 'duration_hours'
      else if (l === 'payment type') mapping[h] = 'payment_type'
      else if (l === 'is unpaid') mapping[h] = 'is_unpaid'
      else if (l === 'unpaid reason') mapping[h] = 'unpaid_reason'
      else if (l.includes('notes') || l.includes('description')) mapping[h] = 'description'
    })
    return { preset: 'wello', entityType: 'sessions', mapping }
  }

  if (hLower.includes('amount') && (hLower.includes('paid date') || hLower.includes('currency'))) {
    const mapping: Record<string, string> = {}
    headers.forEach((h) => {
      const l = h.toLowerCase()
      if (l === 'client') mapping[h] = 'client_name'
      else if (l === 'project') mapping[h] = 'project_name'
      else if (l === 'amount') mapping[h] = 'amount'
      else if (l === 'currency') mapping[h] = 'currency'
      else if (l === 'paid date' || l === 'date') mapping[h] = 'paid_date'
      else if (l === 'status') mapping[h] = 'status'
      else if (l === 'notes') mapping[h] = 'notes'
    })
    return { preset: 'wello', entityType: 'payments', mapping }
  }

  if (hLower.includes('company') || (hLower.includes('name') && hLower.includes('email'))) {
    const mapping: Record<string, string> = {}
    headers.forEach((h) => {
      const l = h.toLowerCase()
      if (l === 'name') mapping[h] = 'name'
      else if (l === 'email') mapping[h] = 'email'
      else if (l === 'company') mapping[h] = 'company'
      else if (l === 'currency') mapping[h] = 'currency'
      else if (l === 'notes') mapping[h] = 'notes'
    })
    return { preset: 'wello', entityType: 'clients', mapping }
  }

  // Generic fallback
  const mapping: Record<string, string> = {}
  headers.forEach((h) => {
    const l = h.toLowerCase()
    if (l.includes('client')) mapping[h] = 'client_name'
    else if (l.includes('project')) mapping[h] = 'project_name'
    else if (l.includes('desc') || l.includes('note') || l.includes('task')) mapping[h] = 'description'
    else if (l.includes('duration') || l.includes('hour') || l.includes('time')) mapping[h] = 'duration_minutes'
    else if (l.includes('date') || l.includes('start')) mapping[h] = 'start_time'
    else if (l.includes('amount') || l.includes('price') || l.includes('total')) mapping[h] = 'amount'
    else if (l.includes('name')) mapping[h] = 'name'
    else if (l.includes('email')) mapping[h] = 'email'
  })

  return { preset: 'generic', entityType: 'sessions', mapping }
}

/**
 * Parses duration strings into minutes (supports '01:30:00', '1.5', '90m', '90', etc.)
 */
export function parseDurationToMinutes(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val > 0 ? val : 0

  const str = String(val).trim()
  // Format HH:MM:SS or HH:MM
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => parseFloat(p) || 0)
    if (parts.length === 3) {
      return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60)
    } else if (parts.length === 2) {
      return Math.round(parts[0] * 60 + parts[1])
    }
  }

  const num = parseFloat(str)
  if (isNaN(num)) return 0
  // If the header was duration (hours) or contains decimal
  if (str.includes('.') && num < 24) {
    return Math.round(num * 60)
  }
  return Math.round(num)
}

/**
 * Parses dates into valid ISO date strings.
 */
export function parseDateToIso(dateVal: any, timeVal?: any): string | null {
  if (!dateVal) return null
  try {
    let combined = String(dateVal).trim()
    if (timeVal && String(timeVal).trim()) {
      combined = `${combined} ${String(timeVal).trim()}`
    }
    const d = new Date(combined)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

/**
 * Previews import data, applies proposed mapping, and validates fields.
 */
export function generateImportPreview(
  csvText: string,
  targetEntity?: 'sessions' | 'payments' | 'clients',
  customMapping?: Record<string, string>
) {
  const { headers, rows } = parseCsv(csvText)
  const detected = detectPresetAndMapping(headers)
  const entity = targetEntity || detected.entityType
  const mapping = customMapping || detected.mapping

  const previewRows: any[] = []
  const validationErrors: string[] = []

  const sampleLimit = Math.min(rows.length, 10)
  for (let i = 0; i < sampleLimit; i++) {
    const raw = rows[i]
    const mapped: Record<string, any> = {}

    for (const [csvHeader, targetField] of Object.entries(mapping)) {
      if (targetField && raw[csvHeader] !== undefined) {
        const val = raw[csvHeader]
        if (val !== '' || mapped[targetField] === undefined) {
          mapped[targetField] = val
        }
      }
    }

    if (entity === 'sessions') {
      let durationMinutes = parseDurationToMinutes(mapped.duration_minutes || mapped.duration_hours)
      if (mapped.duration_hours && !mapped.duration_minutes) {
        durationMinutes = Math.round(parseFloat(mapped.duration_hours) * 60) || 0
      }
      const startTime = parseDateToIso(
        mapped.start_date || mapped.start_time,
        mapped.start_date && mapped.start_time ? mapped.start_time : undefined
      )
      const endTime = parseDateToIso(
        mapped.end_date || mapped.end_time,
        mapped.end_date && mapped.end_time ? mapped.end_time : undefined
      )

      mapped.parsed_duration_minutes = durationMinutes
      mapped.parsed_start_time = startTime
      mapped.parsed_end_time = endTime
      mapped.parsed_payment_type =
        String(mapped.payment_type).toLowerCase() === 'no' || String(mapped.payment_type).toLowerCase() === 'unpaid' || mapped.is_unpaid === 'true'
          ? 'unpaid'
          : 'paid'

      if (durationMinutes <= 0 && (!startTime || !endTime)) {
        validationErrors.push(`Row ${i + 1}: Missing valid duration or start/end timestamp.`)
      }
    } else if (entity === 'payments') {
      const amt = parseFloat(mapped.amount) || 0
      const paidDate = parseDateToIso(mapped.paid_date || mapped.date)
      mapped.parsed_amount = amt
      mapped.parsed_paid_date = paidDate
      mapped.parsed_currency = (mapped.currency || 'USD').toUpperCase().slice(0, 3)

      if (amt <= 0) {
        validationErrors.push(`Row ${i + 1}: Payment amount must be a positive number.`)
      }
    } else if (entity === 'clients') {
      if (!mapped.name && !mapped.company) {
        validationErrors.push(`Row ${i + 1}: Client must have a name or company.`)
      }
    }

    previewRows.push({ raw, mapped })
  }

  return {
    headers,
    totalRows: rows.length,
    preset: detected.preset,
    entityType: entity,
    mapping,
    detectedMapping: mapping,
    previewRows,
    validationErrors,
    isValid: validationErrors.length === 0,
  }
}

/**
 * Executes atomic transactional batch import of CSV rows into the database.
 */
export async function executeImport(
  userId: number,
  csvText: string,
  entityType: 'sessions' | 'payments' | 'clients',
  mapping: Record<string, string>
): Promise<{ importedCount: number; skippedCount: number; errors: string[] }> {
  const db = getDb()
  const { rows } = parseCsv(csvText)

  let importedCount = 0
  let skippedCount = 0
  const errors: string[] = []

  // Pre-load existing clients and projects for the user for fast in-memory resolution
  const existingClients = await db('clients').where({ user_id: userId, deleted_at: null })
  const clientMap = new Map<string, any>()
  existingClients.forEach((c: any) => clientMap.set(c.name.toLowerCase().trim(), c))

  const existingProjects = await db('projects').where({ user_id: userId, deleted_at: null })
  const projectMap = new Map<string, any>()
  existingProjects.forEach((p: any) => projectMap.set(p.name.toLowerCase().trim(), p))

  await db.transaction(async (trx) => {
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]
      const mapped: Record<string, any> = {}

      for (const [csvHeader, targetField] of Object.entries(mapping)) {
        if (targetField && raw[csvHeader] !== undefined) {
          const val = raw[csvHeader]
          if (val !== '' || mapped[targetField] === undefined) {
            mapped[targetField] = val
          }
        }
      }

      try {
        if (entityType === 'sessions') {
          let durationMinutes = parseDurationToMinutes(mapped.duration_minutes || mapped.duration_hours)
          if (mapped.duration_hours && !mapped.duration_minutes) {
            durationMinutes = Math.round(parseFloat(mapped.duration_hours) * 60) || 0
          }

          let startTime = parseDateToIso(
            mapped.start_date || mapped.start_time,
            mapped.start_date && mapped.start_time ? mapped.start_time : undefined
          )
          let endTime = parseDateToIso(
            mapped.end_date || mapped.end_time,
            mapped.end_date && mapped.end_time ? mapped.end_time : undefined
          )

          if (!startTime) {
            startTime = new Date().toISOString()
          }
          if (!endTime && durationMinutes > 0) {
            endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString()
          }
          if (durationMinutes <= 0 && startTime && endTime) {
            durationMinutes = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000))
          }

          if (durationMinutes <= 0) {
            skippedCount++
            errors.push(`Row ${i + 1}: Skipped due to zero duration`)
            continue
          }

          // Resolve Client
          let clientId: number | null = null
          const clientName = (mapped.client_name || '').trim()
          if (clientName) {
            let client = clientMap.get(clientName.toLowerCase())
            if (!client) {
              const [newId] = await trx('clients').insert({
                user_id: userId,
                name: clientName,
                created_at: new Date(),
                updated_at: new Date(),
              })
              client = { id: newId, name: clientName }
              clientMap.set(clientName.toLowerCase(), client)
            }
            clientId = client.id
          }

          // Resolve Project (satisfies notNullable foreign key)
          let projectId: number | null = null
          const projectName = (mapped.project_name || 'General Work').trim()
          let project = projectMap.get(projectName.toLowerCase())
          if (!project) {
            const [newId] = await trx('projects').insert({
              user_id: userId,
              client_id: clientId,
              name: projectName,
              service_category: 'General',
              status: 'in_progress',
              is_job: 1,
              currency: 'USD',
              created_at: new Date(),
              updated_at: new Date(),
            })
            project = { id: newId, name: projectName, client_id: clientId }
            projectMap.set(projectName.toLowerCase(), project)
          }
          projectId = project.id

          const isUnpaid =
            String(mapped.payment_type).toLowerCase() === 'no' ||
            String(mapped.payment_type).toLowerCase() === 'unpaid' ||
            mapped.is_unpaid === 'true'

          const startDt = new Date(startTime)
          const endDt = endTime ? new Date(endTime) : new Date(startDt.getTime() + durationMinutes * 60000)
          const sessionTitle = (
            mapped.description ||
            mapped.task ||
            mapped.notes ||
            (mapped.project_name ? `${mapped.project_name} session` : 'Imported session')
          ).trim()

          await trx('work_sessions').insert({
            user_id: userId,
            project_id: projectId,
            title: sessionTitle.slice(0, 255),
            type: 'production',
            payment_type: isUnpaid ? 'unpaid' : 'paid',
            unpaid_reason: isUnpaid ? (mapped.unpaid_reason || 'client_work') : null,
            notes: mapped.notes || mapped.description || null,
            started_at: startDt,
            ended_at: endDt,
            duration_seconds: durationMinutes * 60,
            paused_seconds: 0,
            created_at: new Date(),
            updated_at: new Date(),
          })

          importedCount++
        } else if (entityType === 'payments') {
          const amount = parseFloat(mapped.amount) || 0
          if (amount <= 0) {
            skippedCount++
            errors.push(`Row ${i + 1}: Skipped due to invalid amount`)
            continue
          }

          const paidDate = parseDateToIso(mapped.paid_date || mapped.date) || new Date().toISOString()
          const currency = (mapped.currency || 'USD').toUpperCase().slice(0, 3)

          // Resolve Client
          let clientId: number | null = null
          const clientName = (mapped.client_name || '').trim()
          if (clientName) {
            let client = clientMap.get(clientName.toLowerCase())
            if (!client) {
              const [newId] = await trx('clients').insert({
                user_id: userId,
                name: clientName,
                created_at: new Date(),
                updated_at: new Date(),
              })
              client = { id: newId, name: clientName }
              clientMap.set(clientName.toLowerCase(), client)
            }
            clientId = client.id
          }

          // Resolve Project
          let projectId: number | null = null
          const projectName = (mapped.project_name || 'General Work').trim()
          let project = projectMap.get(projectName.toLowerCase())
          if (!project) {
            const [newId] = await trx('projects').insert({
              user_id: userId,
              client_id: clientId,
              name: projectName,
              currency,
              status: 'in_progress',
              is_job: 1,
              created_at: new Date(),
              updated_at: new Date(),
            })
            project = { id: newId, name: projectName, client_id: clientId }
            projectMap.set(projectName.toLowerCase(), project)
          }
          projectId = project.id

          const paidDtStr = new Date(paidDate).toISOString().slice(0, 10)

          await trx('payments').insert({
            user_id: userId,
            project_id: projectId,
            client_id: clientId,
            amount,
            currency,
            paid_date: paidDtStr,
            notes: mapped.notes || null,
            created_at: new Date(),
            updated_at: new Date(),
          })

          importedCount++
        } else if (entityType === 'clients') {
          const name = (mapped.name || mapped.company || '').trim()
          if (!name) {
            skippedCount++
            errors.push(`Row ${i + 1}: Skipped due to missing client name`)
            continue
          }

          const existing = clientMap.get(name.toLowerCase())
          if (existing) {
            skippedCount++
            continue // Skip duplicates cleanly
          }

          const [newId] = await trx('clients').insert({
            user_id: userId,
            name,
            email: mapped.email || null,
            company: mapped.company || null,
            country: mapped.country || null,
            notes: mapped.notes || null,
            created_at: new Date(),
            updated_at: new Date(),
          })

          clientMap.set(name.toLowerCase(), { id: newId, name })
          importedCount++
        }
      } catch (err: any) {
        skippedCount++
        errors.push(`Row ${i + 1}: ${err?.message || 'Error inserting record'}`)
      }
    }
  })

  return { importedCount, skippedCount, errors }
}
