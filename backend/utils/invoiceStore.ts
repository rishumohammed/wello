// server/utils/invoiceStore.ts
// Basic Invoicing Addon Store & Management Module for Wello

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface InvoiceRecord {
  id: string
  userId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  customerName: string
  customerContact: string
  customerAddress: string
  serviceDescription: string
  projectId?: string
  currencyCode?: string
  sellerName?: string
  sellerLogo?: string
  sellerAddress?: string
  sellerEmail?: string
  sellerPhone?: string
  sellerTaxId?: string
  items: InvoiceItem[]
  discount: number
  taxPercent: number
  taxAmount: number
  subtotal: number
  total: number
  notes: string
  status: InvoiceStatus
  createdAt: string
  updatedAt: string
}

// In-memory persistent invoice store
const invoiceStore = new Map<string, InvoiceRecord>()
let invoiceCounter = 1001

// Seed initial demo invoices for realistic platform usage
const initialInvoices: InvoiceRecord[] = [
  {
    id: 'inv_1001',
    userId: 'u1',
    invoiceNumber: 'INV-2025-001',
    invoiceDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    customerName: 'Acme Corporation',
    customerContact: 'billing@acme.com · +1 415 555 2671',
    customerAddress: 'Suite 402, Trade Tower, San Francisco, CA 94105, USA',
    serviceDescription: 'Full-stack Web Application & API Integration Services',
    projectId: 'p1',
    currencyCode: 'USD',
    items: [
      { id: 'item_1', description: 'Web Application Frontend Development', quantity: 25, rate: 800, amount: 20000 },
      { id: 'item_2', description: 'RESTful API & Database Integration', quantity: 10, rate: 800, amount: 8000 }
    ],
    discount: 1000,
    taxPercent: 18,
    taxAmount: 4860,
    subtotal: 28000,
    total: 31860,
    notes: 'Thank you for choosing Wello services. Payment due within 15 days of invoice date.',
    status: 'PAID',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'inv_1002',
    userId: 'u1',
    invoiceNumber: 'INV-2025-002',
    invoiceDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
    customerName: 'TechVision Global',
    customerContact: 'finance@techvision.io',
    customerAddress: '12th Floor, Cyber Plaza, London, EC1A 1BB, UK',
    serviceDescription: 'UI/UX Mobile Design System & Component Library',
    projectId: 'p2',
    currencyCode: 'USD',
    items: [
      { id: 'item_3', description: 'Mobile Design System & Component Specs', quantity: 18, rate: 750, amount: 13500 },
      { id: 'item_4', description: 'Interactive Design Workshop & Handoff', quantity: 4, rate: 750, amount: 3000 }
    ],
    discount: 500,
    taxPercent: 18,
    taxAmount: 2880,
    subtotal: 16500,
    total: 18880,
    notes: 'Please remit payment via bank transfer.',
    status: 'SENT',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  }
]

initialInvoices.forEach(inv => invoiceStore.set(inv.id, inv))
invoiceCounter = 1003

export function getInvoicesForUser(userId: string, statusFilter?: string, searchQuery?: string): InvoiceRecord[] {
  let list = Array.from(invoiceStore.values()).filter(inv => inv.userId === userId || userId === 'admin' || userId === 'u_admin')

  if (statusFilter && statusFilter !== 'ALL') {
    list = list.filter(inv => inv.status === statusFilter)
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    list = list.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.serviceDescription.toLowerCase().includes(q)
    )
  }

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getInvoiceById(id: string): InvoiceRecord | null {
  return invoiceStore.get(id) || null
}

export function createInvoice(data: Partial<InvoiceRecord> & { userId: string }): InvoiceRecord {
  const now = new Date().toISOString()
  const id = 'inv_' + Math.random().toString(36).slice(2, 9)
  const num = data.invoiceNumber || `INV-2025-${String(invoiceCounter++).padStart(3, '0')}`

  const items: InvoiceItem[] = (data.items || []).map((it, idx) => ({
    id: it.id || `item_${idx + 1}`,
    description: it.description || 'Service Line Item',
    quantity: Number(it.quantity) || 1,
    rate: Number(it.rate) || 0,
    amount: Math.round(((Number(it.quantity) || 1) * (Number(it.rate) || 0)) * 10000) / 10000,
  }))

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const discount = Number(data.discount) || 0
  const afterDiscount = Math.max(0, subtotal - discount)
  const taxPercent = Number(data.taxPercent) || 0
  const taxAmount = (afterDiscount * taxPercent) / 100
  const total = afterDiscount + taxAmount

  const record: InvoiceRecord = {
    id,
    userId: data.userId,
    invoiceNumber: num,
    invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: data.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    customerName: data.customerName || 'Client Name',
    customerContact: data.customerContact || '',
    customerAddress: data.customerAddress || '',
    serviceDescription: data.serviceDescription || 'Professional Services',
    projectId: data.projectId,
    currencyCode: (data.currencyCode || 'USD').toUpperCase().trim().slice(0, 3),
    sellerName: data.sellerName || 'Wello Consulting',
    sellerLogo: data.sellerLogo || '',
    sellerAddress: data.sellerAddress || '100 Innovation Way, Suite 400, San Francisco, CA 94105, USA',
    sellerEmail: data.sellerEmail || 'consulting@wello.app',
    sellerPhone: data.sellerPhone || '+14155552671',
    sellerTaxId: data.sellerTaxId || 'Tax ID: US987654321',
    items,
    discount,
    taxPercent,
    taxAmount,
    subtotal,
    total,
    notes: data.notes || 'Payment due upon receipt.',
    status: data.status || 'DRAFT',
    createdAt: now,
    updatedAt: now,
  }

  invoiceStore.set(id, record)
  recordAddonUsage(data.userId, 'basic-invoicing')
  return record
}

export function updateInvoice(id: string, updates: Partial<InvoiceRecord>): InvoiceRecord | null {
  const existing = invoiceStore.get(id)
  if (!existing) return null

  const items: InvoiceItem[] = (updates.items || existing.items).map((it, idx) => ({
    id: it.id || `item_${idx + 1}`,
    description: it.description || 'Service Line Item',
    quantity: Number(it.quantity) || 1,
    rate: Number(it.rate) || 0,
    amount: (Number(it.quantity) || 1) * (Number(it.rate) || 0),
  }))

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const discount = updates.discount !== undefined ? Number(updates.discount) : existing.discount
  const afterDiscount = Math.max(0, subtotal - discount)
  const taxPercent = updates.taxPercent !== undefined ? Number(updates.taxPercent) : existing.taxPercent
  const taxAmount = (afterDiscount * taxPercent) / 100
  const total = afterDiscount + taxAmount

  const updated: InvoiceRecord = {
    ...existing,
    ...updates,
    items,
    subtotal,
    discount,
    taxPercent,
    taxAmount,
    total,
    updatedAt: new Date().toISOString(),
  }

  invoiceStore.set(id, updated)
  return updated
}

export function updateInvoiceStatus(id: string, status: InvoiceStatus): InvoiceRecord | null {
  const existing = invoiceStore.get(id)
  if (!existing) return null

  existing.status = status
  existing.updatedAt = new Date().toISOString()
  invoiceStore.set(id, existing)
  return { ...existing }
}

export function deleteInvoice(id: string): boolean {
  return invoiceStore.delete(id)
}

// Generate Invoice directly from completed Wello Job/Project
export function createInvoiceFromJob(jobData: {
  id: string
  name: string
  description?: string
  clientName?: string
  clientContact?: string
  quoteAmount?: number
  hoursWorked?: number
  rate?: number
}, userId: string): InvoiceRecord {
  const rate = jobData.rate || 500
  const hours = jobData.hoursWorked || 1
  const subtotal = jobData.quoteAmount || (hours * rate)

  return createInvoice({
    userId,
    customerName: jobData.clientName || 'Valued Client',
    customerContact: jobData.clientContact || '',
    serviceDescription: `Invoice for ${jobData.name}`,
    projectId: jobData.id,
    items: [
      {
        id: 'item_job_1',
        description: `${jobData.name} - Completed Contract Work`,
        quantity: hours,
        rate: jobData.quoteAmount ? Math.round(jobData.quoteAmount / (hours || 1)) : rate,
        amount: subtotal,
      }
    ],
    notes: `Generated from completed Wello job: ${jobData.name}. Thank you for your business!`,
    status: 'DRAFT',
  })
}

export function getInvoiceAnalytics() {
  const all = Array.from(invoiceStore.values())
  const draft = all.filter(i => i.status === 'DRAFT')
  const sent = all.filter(i => i.status === 'SENT')
  const paid = all.filter(i => i.status === 'PAID')
  const overdue = all.filter(i => i.status === 'OVERDUE')
  const cancelled = all.filter(i => i.status === 'CANCELLED')

  const totalBilled = paid.reduce((sum, i) => sum + i.total, 0)
  const totalOutstanding = (sent.reduce((sum, i) => sum + i.total, 0)) + (overdue.reduce((sum, i) => sum + i.total, 0))

  return {
    totalInvoices: all.length,
    draftCount: draft.length,
    sentCount: sent.length,
    paidCount: paid.length,
    overdueCount: overdue.length,
    cancelledCount: cancelled.length,
    totalBilled,
    totalOutstanding,
  }
}
