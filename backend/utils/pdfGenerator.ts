// backend/utils/pdfGenerator.ts
/**
 * High-performance, pure server-side vector PDF generator for Wello.
 * Implements standard PDF 1.4 specification with vector paths, text layout,
 * international currency precision (USD, EUR, JPY 0-dec, KWD 3-dec),
 * and 2 distinct professional design templates (modern_clean & classic_executive).
 */

export interface InvoicePdfData {
  invoiceNumber: string
  invoiceDate: string | Date
  dueDate: string | Date
  paymentTerms?: string
  status: string
  currency: string
  baseCurrency?: string
  fxRate?: number
  sellerName?: string
  sellerAddress?: string
  sellerEmail?: string
  sellerPhone?: string
  sellerTaxId?: string
  taxIdLabel?: string
  customerName: string
  customerAddress?: string
  customerEmail?: string
  customerContact?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    amount: number
    taxRate?: number
    taxName?: string
  }>
  subtotal: number
  discount: number
  taxes?: Array<{
    taxName: string
    taxPercent: number
    taxAmount: number
    isInclusive?: boolean
    isReverseCharge?: boolean
  }>
  taxPercent?: number
  taxAmount?: number
  total: number
  amountPaid?: number
  balanceDue?: number
  isReverseCharge?: boolean
  notes?: string
  template?: 'modern_clean' | 'classic_executive'
}

export interface QuotePdfData {
  quoteNumber?: string
  projectName: string
  quoteDate: string | Date
  validUntil?: string | Date
  currency: string
  quoteAmount: number
  estimatedHours?: number
  sellerName?: string
  sellerEmail?: string
  sellerAddress?: string
  customerName: string
  customerEmail?: string
  notes?: string
  items?: Array<{
    description: string
    quantity: number
    unitPrice: number
    amount: number
  }>
  template?: 'modern_clean' | 'classic_executive'
}

export interface ReportPdfData {
  userName: string
  userEmail?: string
  reportTitle: string
  rangeLabel: string
  periodDates: string
  currency: string
  targetHourlyRate: number
  hours: {
    paidHours: number
    unpaidClientHours: number
    intentionalUnpaidHours: number
    commuteHours: number
    totalAllHours: number
  }
  financials: {
    collectedRevenue: number
    earnedRevenue: number
    directExpenses: number
    allocatedOverhead: number
    collectedNetIncome: number
  }
  rates: {
    clientWorkRate: number
    allInRate: number
    targetDeltaPct: number
    isTargetMet: boolean
  }
  topLeakageReasons?: Array<{
    label: string
    category: string
    hours: number
    estimatedOpportunityCost: number
  }>
  clientRankings?: Array<{
    clientName: string
    hours: number
    netIncome: number
    effectiveHourlyRate: number
  }>
}

/**
 * Formats monetary amounts with strict ISO 4217 decimal precision.
 * JPY = 0 decimals, KWD = 3 decimals, standard = 2 decimals.
 */
export function formatPdfCurrency(amount: number, currencyCode: string = 'USD'): string {
  const code = (currencyCode || 'USD').toUpperCase().slice(0, 3)
  let decimals = 2
  if (['JPY', 'KRW', 'VND', 'CLP', 'HUF', 'TWD'].includes(code)) {
    decimals = 0
  } else if (['KWD', 'BHD', 'OMR', 'JOD'].includes(code)) {
    decimals = 3
  }

  const formattedNum = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'AU$',
    INR: '₹',
    AED: 'AED ',
    KWD: 'KD ',
    CHF: 'CHF ',
    SGD: 'SG$',
  }

  const sym = symbols[code] || `${code} `
  return `${sym}${formattedNum}`
}

function escapePdfText(text: string): string {
  if (!text) return ''
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' ') // sanitize to standard ASCII for Helvetica font
}

function formatDateStr(dateVal?: string | Date): string {
  if (!dateVal) return ''
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return String(dateVal)
    return d.toISOString().slice(0, 10)
  } catch {
    return String(dateVal)
  }
}

/**
 * Builds a raw PDF document buffer with standard PDF 1.4 syntax.
 */
export function generateInvoicePdf(data: InvoicePdfData): Buffer {
  const template = data.template || 'modern_clean'
  const isClassic = template === 'classic_executive'

  const currency = (data.currency || 'USD').toUpperCase().slice(0, 3)
  const invNumber = data.invoiceNumber || 'INV-0001'
  const invDate = formatDateStr(data.invoiceDate)
  const dueDate = formatDateStr(data.dueDate)
  const sellerName = data.sellerName || 'Wello Verified Professional'
  const sellerEmail = data.sellerEmail || ''
  const sellerAddress = data.sellerAddress || ''
  const sellerTaxId = data.sellerTaxId ? `${data.taxIdLabel || 'Tax ID'}: ${data.sellerTaxId}` : ''
  const customerName = data.customerName || 'Valued Client'
  const customerEmail = data.customerEmail || ''
  const customerAddress = data.customerAddress || ''

  const subtotalFormatted = formatPdfCurrency(data.subtotal, currency)
  const discountFormatted = formatPdfCurrency(data.discount, currency)
  const totalFormatted = formatPdfCurrency(data.total, currency)
  const paidFormatted = formatPdfCurrency(data.amountPaid || 0, currency)
  const balanceFormatted = formatPdfCurrency(data.balanceDue !== undefined ? data.balanceDue : data.total, currency)

  // Stream operations buffer
  const stream: string[] = []

  // Page setup (A4: 595.28 x 841.89 points)
  const pageWidth = 595
  const pageHeight = 842

  if (!isClassic) {
    // ─── MODERN CLEAN TEMPLATE ───
    // Top Purple Accent Bar
    stream.push(`0.388 0.400 0.945 rg`) // #6366F1
    stream.push(`0 832 595 10 re f`)

    // Background Top Banner Box
    stream.push(`0.976 0.980 0.988 rg`) // #F8FAFC
    stream.push(`30 730 535 90 re f`)

    // Header Title
    stream.push(`BT`)
    stream.push(`/F1 22 Tf`)
    stream.push(`0.09 0.11 0.15 rg`) // #171C26
    stream.push(`45 780 Td`)
    stream.push(`(${escapePdfText(sellerName)}) Tj`)
    stream.push(`ET`)

    stream.push(`BT`)
    stream.push(`/F1 9 Tf`)
    stream.push(`0.4 0.44 0.52 rg`)
    stream.push(`45 765 Td`)
    stream.push(`(${escapePdfText(sellerEmail)}${sellerTaxId ? '  |  ' + escapePdfText(sellerTaxId) : ''}) Tj`)
    stream.push(`ET`)

    // Right Header: INVOICE & Number
    stream.push(`BT`)
    stream.push(`/F1 20 Tf`)
    stream.push(`0.388 0.400 0.945 rg`)
    stream.push(`410 780 Td`)
    stream.push(`(INVOICE) Tj`)
    stream.push(`ET`)

    stream.push(`BT`)
    stream.push(`/F1 10 Tf`)
    stream.push(`0.2 0.22 0.28 rg`)
    stream.push(`410 762 Td`)
    stream.push(`(${escapePdfText(invNumber)}) Tj`)
    stream.push(`ET`)

    // 2-Column Info Boxes: Billed To (Left) & Invoice Meta (Right)
    // Left Box: Billed To
    stream.push(`0.98 0.98 0.99 rg`)
    stream.push(`30 635 255 80 re f`)
    stream.push(`0.88 0.90 0.94 RG 1 w`)
    stream.push(`30 635 255 80 re S`)

    stream.push(`BT`)
    stream.push(`/F1 8 Tf`)
    stream.push(`0.45 0.48 0.55 rg`)
    stream.push(`42 698 Td`)
    stream.push(`(BILLED TO) Tj`)
    stream.push(`ET`)

    stream.push(`BT`)
    stream.push(`/F1 11 Tf`)
    stream.push(`0.09 0.11 0.15 rg`)
    stream.push(`42 682 Td`)
    stream.push(`(${escapePdfText(customerName)}) Tj`)
    stream.push(`ET`)

    if (customerEmail || customerAddress) {
      stream.push(`BT`)
      stream.push(`/F1 8 Tf`)
      stream.push(`0.4 0.44 0.52 rg`)
      stream.push(`42 666 Td`)
      stream.push(`(${escapePdfText(customerEmail || customerAddress)}) Tj`)
      stream.push(`ET`)
    }

    // Right Box: Dates & Terms
    stream.push(`0.98 0.98 0.99 rg`)
    stream.push(`310 635 255 80 re f`)
    stream.push(`0.88 0.90 0.94 RG 1 w`)
    stream.push(`310 635 255 80 re S`)

    stream.push(`BT`)
    stream.push(`/F1 8 Tf`)
    stream.push(`0.45 0.48 0.55 rg`)
    stream.push(`322 698 Td`)
    stream.push(`(INVOICE DETAILS) Tj`)
    stream.push(`ET`)

    stream.push(`BT`)
    stream.push(`/F1 8 Tf`)
    stream.push(`0.15 0.18 0.22 rg`)
    stream.push(`322 680 Td`)
    stream.push(`(Invoice Date: ${escapePdfText(invDate)}    Due Date: ${escapePdfText(dueDate)}) Tj`)
    stream.push(`ET`)

    stream.push(`BT`)
    stream.push(`/F1 8 Tf`)
    stream.push(`0.15 0.18 0.22 rg`)
    stream.push(`322 664 Td`)
    stream.push(`(Payment Terms: ${escapePdfText(data.paymentTerms || 'Net 14')}    Status: ${escapePdfText((data.status || 'DRAFT').toUpperCase())}) Tj`)
    stream.push(`ET`)

  } else {
    // ─── CLASSIC EXECUTIVE TEMPLATE ───
    // Double Border
    stream.push(`0.2 0.2 0.2 RG 1.5 w`)
    stream.push(`20 20 555 802 re S`)
    stream.push(`0.5 0.5 0.5 RG 0.5 w`)
    stream.push(`24 24 547 794 re S`)

    // Centered Corporate Header
    stream.push(`BT`)
    stream.push(`/F1 22 Tf`)
    stream.push(`0.1 0.1 0.1 rg`)
    stream.push(`50 785 Td`)
    stream.push(`(${escapePdfText(sellerName.toUpperCase())}) Tj`)
    stream.push(`ET`)

    stream.push(`BT`)
    stream.push(`/F1 8 Tf`)
    stream.push(`0.3 0.3 0.3 rg`)
    stream.push(`50 770 Td`)
    stream.push(`(${escapePdfText(sellerAddress)}  |  ${escapePdfText(sellerEmail)}  |  ${escapePdfText(sellerTaxId)}) Tj`)
    stream.push(`ET`)

    // Divider Line
    stream.push(`0.2 0.2 0.2 RG 1 w`)
    stream.push(`50 755 m 545 755 l S`)

    // Document Title
    stream.push(`BT`)
    stream.push(`/F1 16 Tf`)
    stream.push(`0.1 0.1 0.1 rg`)
    stream.push(`50 730 Td`)
    stream.push(`(STATEMENT OF INVOICE: ${escapePdfText(invNumber)}) Tj`)
    stream.push(`ET`)

    // Meta columns
    stream.push(`BT`)
    stream.push(`/F1 9 Tf`)
    stream.push(`0.2 0.2 0.2 rg`)
    stream.push(`50 705 Td`)
    stream.push(`(Client: ${escapePdfText(customerName)}    |    Date: ${escapePdfText(invDate)}    |    Due: ${escapePdfText(dueDate)}) Tj`)
    stream.push(`ET`)
  }

  // ─── ITEMS TABLE ───
  const tableTop = isClassic ? 675 : 610
  const colX = { desc: 40, qty: 340, rate: 410, amount: 490 }

  // Table Header Background
  stream.push(`0.92 0.94 0.97 rg`)
  stream.push(`30 ${tableTop - 22} 535 22 re f`)
  stream.push(`0.80 0.83 0.88 RG 1 w`)
  stream.push(`30 ${tableTop - 22} 535 22 re S`)

  // Table Header Text
  stream.push(`BT`)
  stream.push(`/F1 9 Tf`)
  stream.push(`0.15 0.18 0.25 rg`)
  stream.push(`${colX.desc} ${tableTop - 15} Td (DESCRIPTION) Tj`)
  stream.push(`${colX.qty - colX.desc} 0 Td (QTY / HRS) Tj`)
  stream.push(`${colX.rate - colX.qty} 0 Td (RATE) Tj`)
  stream.push(`${colX.amount - colX.rate} 0 Td (AMOUNT) Tj`)
  stream.push(`ET`)

  // Table Rows
  let curY = tableTop - 42
  const items = data.items && data.items.length > 0 ? data.items : [
    { description: 'Professional Services', quantity: 1, unitPrice: data.subtotal || data.total, amount: data.subtotal || data.total }
  ]

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const rowBg = i % 2 === 0 ? `1 1 1 rg` : `0.98 0.99 1.0 rg`
    stream.push(`${rowBg}`)
    stream.push(`30 ${curY - 6} 535 20 re f`)
    stream.push(`0.90 0.92 0.95 RG 0.5 w`)
    stream.push(`30 ${curY - 6} 535 20 re S`)

    const itemAmtStr = formatPdfCurrency(it.amount, currency)
    const itemRateStr = formatPdfCurrency(it.unitPrice, currency)

    stream.push(`BT`)
    stream.push(`/F1 8 Tf`)
    stream.push(`0.15 0.18 0.22 rg`)
    stream.push(`${colX.desc} ${curY} Td (${escapePdfText(it.description)}) Tj`)
    stream.push(`${colX.qty - colX.desc} 0 Td (${it.quantity}) Tj`)
    stream.push(`${colX.rate - colX.qty} 0 Td (${escapePdfText(itemRateStr)}) Tj`)
    stream.push(`${colX.amount - colX.rate} 0 Td (${escapePdfText(itemAmtStr)}) Tj`)
    stream.push(`ET`)

    curY -= 22
  }

  // ─── SUMMARY BLOCK ───
  const summaryTop = Math.max(curY - 10, 240)
  const sumBoxX = 330
  const sumBoxWidth = 235

  stream.push(`0.96 0.97 0.99 rg`)
  stream.push(`${sumBoxX} ${summaryTop - 110} ${sumBoxWidth} 115 re f`)
  stream.push(`0.85 0.88 0.93 RG 1 w`)
  stream.push(`${sumBoxX} ${summaryTop - 110} ${sumBoxWidth} 115 re S`)

  let sumY = summaryTop - 18
  const labelX = sumBoxX + 12
  const valX = sumBoxX + sumBoxWidth - 12

  // Subtotal
  stream.push(`BT /F1 8 Tf 0.35 0.38 0.45 rg ${labelX} ${sumY} Td (Subtotal:) Tj ET`)
  stream.push(`BT /F1 8 Tf 0.1 0.12 0.15 rg ${valX - 60} ${sumY} Td (${escapePdfText(subtotalFormatted)}) Tj ET`)
  sumY -= 16

  // Discount (if any)
  if (data.discount > 0) {
    stream.push(`BT /F1 8 Tf 0.35 0.38 0.45 rg ${labelX} ${sumY} Td (Discount:) Tj ET`)
    stream.push(`BT /F1 8 Tf 0.7 0.2 0.2 rg ${valX - 60} ${sumY} Td (-${escapePdfText(discountFormatted)}) Tj ET`)
    sumY -= 16
  }

  // Taxes breakdown
  if (data.taxes && data.taxes.length > 0) {
    for (const t of data.taxes) {
      const taxAmtStr = formatPdfCurrency(t.taxAmount, currency)
      stream.push(`BT /F1 8 Tf 0.35 0.38 0.45 rg ${labelX} ${sumY} Td (${escapePdfText(t.taxName)} \\(${t.taxPercent}%\\):) Tj ET`)
      stream.push(`BT /F1 8 Tf 0.1 0.12 0.15 rg ${valX - 60} ${sumY} Td (${escapePdfText(taxAmtStr)}) Tj ET`)
      sumY -= 16
    }
  } else if ((data.taxAmount || 0) > 0 || (data.taxPercent || 0) > 0) {
    const taxAmtStr = formatPdfCurrency(data.taxAmount || 0, currency)
    stream.push(`BT /F1 8 Tf 0.35 0.38 0.45 rg ${labelX} ${sumY} Td (Tax \\(${data.taxPercent || 0}%\\):) Tj ET`)
    stream.push(`BT /F1 8 Tf 0.1 0.12 0.15 rg ${valX - 60} ${sumY} Td (${escapePdfText(taxAmtStr)}) Tj ET`)
    sumY -= 16
  }

  // Reverse Charge Notice
  if (data.isReverseCharge) {
    stream.push(`BT /F1 7 Tf 0.4 0.4 0.6 rg ${labelX} ${sumY} Td (Reverse Charge Applicable) Tj ET`)
    sumY -= 14
  }

  // Total Divider & Total Line
  stream.push(`0.388 0.400 0.945 rg`)
  stream.push(`${sumBoxX + 6} ${sumY - 4} ${sumBoxWidth - 12} 22 re f`)

  stream.push(`BT /F1 10 Tf 1 1 1 rg ${labelX} ${sumY + 2} Td (TOTAL DUE:) Tj ET`)
  stream.push(`BT /F1 10 Tf 1 1 1 rg ${valX - 70} ${sumY + 2} Td (${escapePdfText(balanceFormatted)}) Tj ET`)
  sumY -= 30

  // ─── NOTES & FOOTER ───
  if (data.notes) {
    stream.push(`BT /F1 8 Tf 0.4 0.44 0.5 rg 40 ${summaryTop - 20} Td (Notes & Instructions:) Tj ET`)
    stream.push(`BT /F1 8 Tf 0.2 0.22 0.28 rg 40 ${summaryTop - 36} Td (${escapePdfText(data.notes.slice(0, 100))}) Tj ET`)
  }

  // Remittance Slip / Footer
  stream.push(`0.85 0.88 0.92 RG 0.5 w`)
  stream.push(`30 65 m 565 65 l S`)

  stream.push(`BT /F1 7 Tf 0.5 0.55 0.62 rg 40 48 Td (Generated securely via Wello Invoicing. Thank you for your prompt payment.) Tj ET`)

  const contentStream = stream.join('\n')
  return buildPdfDocument(contentStream, pageWidth, pageHeight)
}

/**
 * Generates a Quote Proposal PDF document.
 */
export function generateQuotePdf(data: QuotePdfData): Buffer {
  const currency = (data.currency || 'USD').toUpperCase().slice(0, 3)
  const amountFormatted = formatPdfCurrency(data.quoteAmount, currency)
  const quoteDate = formatDateStr(data.quoteDate)
  const validUntil = formatDateStr(data.validUntil)

  const stream: string[] = []
  const pageWidth = 595
  const pageHeight = 842

  // Purple Top Bar
  stream.push(`0.388 0.400 0.945 rg`)
  stream.push(`0 832 595 10 re f`)

  // Banner
  stream.push(`0.976 0.980 0.988 rg`)
  stream.push(`30 730 535 90 re f`)

  // Header Title
  stream.push(`BT /F1 22 Tf 0.09 0.11 0.15 rg 45 780 Td (${escapePdfText(data.sellerName || 'Wello Provider')}) Tj ET`)
  stream.push(`BT /F1 9 Tf 0.4 0.44 0.52 rg 45 765 Td (${escapePdfText(data.sellerEmail || '')}) Tj ET`)

  stream.push(`BT /F1 20 Tf 0.388 0.400 0.945 rg 420 780 Td (QUOTE) Tj ET`)
  stream.push(`BT /F1 10 Tf 0.2 0.22 0.28 rg 420 762 Td (${escapePdfText(data.quoteNumber || 'Q-PROPOSAL')}) Tj ET`)

  // Project Info Card
  stream.push(`0.98 0.98 0.99 rg 30 635 535 80 re f`)
  stream.push(`0.88 0.90 0.94 RG 1 w 30 635 535 80 re S`)

  stream.push(`BT /F1 8 Tf 0.45 0.48 0.55 rg 45 698 Td (PROPOSAL FOR: ${escapePdfText(data.customerName)}) Tj ET`)
  stream.push(`BT /F1 13 Tf 0.09 0.11 0.15 rg 45 680 Td (${escapePdfText(data.projectName)}) Tj ET`)
  stream.push(`BT /F1 8 Tf 0.3 0.35 0.4 rg 45 660 Td (Quote Date: ${escapePdfText(quoteDate)}    Valid Until: ${escapePdfText(validUntil || '30 days')}${data.estimatedHours ? '    Estimated Effort: ' + data.estimatedHours + ' hrs' : ''}) Tj ET`)

  // Total Valuation Box
  stream.push(`0.388 0.400 0.945 rg 30 530 535 80 re f`)
  stream.push(`BT /F1 12 Tf 1 1 1 rg 50 580 Td (TOTAL ESTIMATED VALUATION:) Tj ET`)
  stream.push(`BT /F1 24 Tf 1 1 1 rg 50 548 Td (${escapePdfText(amountFormatted)}) Tj ET`)

  // Notes
  if (data.notes) {
    stream.push(`BT /F1 9 Tf 0.3 0.35 0.4 rg 45 480 Td (Scope & Terms of Proposal:) Tj ET`)
    stream.push(`BT /F1 9 Tf 0.15 0.18 0.22 rg 45 460 Td (${escapePdfText(data.notes.slice(0, 150))}) Tj ET`)
  }

  stream.push(`0.85 0.88 0.92 RG 0.5 w 30 65 m 565 65 l S`)
  stream.push(`BT /F1 7 Tf 0.5 0.55 0.62 rg 40 48 Td (Please review and accept online via the secure Wello Proposal link.) Tj ET`)

  const contentStream = stream.join('\n')
  return buildPdfDocument(contentStream, pageWidth, pageHeight)
}

/**
 * Generates an executive Performance & Valuation Report PDF document.
 */
export function generateReportPdf(data: ReportPdfData): Buffer {
  const currency = (data.currency || 'USD').toUpperCase().slice(0, 3)
  const clientWorkRateFormatted = formatPdfCurrency(data.rates.clientWorkRate, currency)
  const allInRateFormatted = formatPdfCurrency(data.rates.allInRate, currency)
  const targetRateFormatted = formatPdfCurrency(data.targetHourlyRate, currency)
  const collectedNetFormatted = formatPdfCurrency(data.financials.collectedNetIncome, currency)
  const collectedRevFormatted = formatPdfCurrency(data.financials.collectedRevenue, currency)
  const expensesFormatted = formatPdfCurrency(data.financials.directExpenses, currency)
  const overheadFormatted = formatPdfCurrency(data.financials.allocatedOverhead, currency)

  const stream: string[] = []
  const pageWidth = 595
  const pageHeight = 842

  // Top Indigo Accent Bar
  stream.push(`0.388 0.400 0.945 rg`)
  stream.push(`0 832 595 10 re f`)

  // Banner Background
  stream.push(`0.976 0.980 0.988 rg`)
  stream.push(`30 735 535 85 re f`)

  // Header Title & Metadata
  stream.push(`BT /F1 18 Tf 0.09 0.11 0.15 rg 45 785 Td (WELLO PERFORMANCE & VALUATION REPORT) Tj ET`)
  stream.push(`BT /F1 10 Tf 0.35 0.38 0.45 rg 45 768 Td (${escapePdfText(data.reportTitle)}  |  Period: ${escapePdfText(data.periodDates)}) Tj ET`)
  stream.push(`BT /F1 9 Tf 0.4 0.44 0.52 rg 45 750 Td (Prepared for: ${escapePdfText(data.userName)}${data.userEmail ? ' (' + escapePdfText(data.userEmail) + ')' : ''}) Tj ET`)

  // 4 Top Metric Cards (Y: 630 to 715)
  // Card 1: All-In Rate
  const isTargetMet = data.rates.isTargetMet
  stream.push(`0.98 0.98 0.99 rg 30 635 125 80 re f`)
  stream.push(`0.88 0.90 0.94 RG 0.5 w 30 635 125 80 re S`)
  stream.push(`BT /F1 8 Tf 0.45 0.48 0.55 rg 40 698 Td (ALL-IN REAL RATE) Tj ET`)
  stream.push(`BT /F1 15 Tf 0.09 0.11 0.15 rg 40 675 Td (${escapePdfText(allInRateFormatted)}/h) Tj ET`)
  stream.push(`BT /F1 7.5 Tf ${isTargetMet ? '0.05 0.6 0.25' : '0.8 0.3 0.2'} rg 40 650 Td (Target: ${escapePdfText(targetRateFormatted)}/h) Tj ET`)

  // Card 2: Client Work Rate
  stream.push(`0.98 0.98 0.99 rg 165 635 125 80 re f`)
  stream.push(`0.88 0.90 0.94 RG 0.5 w 165 635 125 80 re S`)
  stream.push(`BT /F1 8 Tf 0.45 0.48 0.55 rg 175 698 Td (CLIENT-WORK RATE) Tj ET`)
  stream.push(`BT /F1 15 Tf 0.09 0.11 0.15 rg 175 675 Td (${escapePdfText(clientWorkRateFormatted)}/h) Tj ET`)
  stream.push(`BT /F1 7.5 Tf 0.4 0.45 0.5 rg 175 650 Td (Direct Client Hours) Tj ET`)

  // Card 3: Total Hours
  stream.push(`0.98 0.98 0.99 rg 300 635 125 80 re f`)
  stream.push(`0.88 0.90 0.94 RG 0.5 w 300 635 125 80 re S`)
  stream.push(`BT /F1 8 Tf 0.45 0.48 0.55 rg 310 698 Td (TOTAL TIME SPENT) Tj ET`)
  stream.push(`BT /F1 15 Tf 0.09 0.11 0.15 rg 310 675 Td (${data.hours.totalAllHours} hrs) Tj ET`)
  stream.push(`BT /F1 7.5 Tf 0.4 0.45 0.5 rg 310 650 Td (Paid: ${data.hours.paidHours}h | Unpaid: ${data.hours.unpaidClientHours}h) Tj ET`)

  // Card 4: Net Collected
  stream.push(`0.98 0.98 0.99 rg 435 635 130 80 re f`)
  stream.push(`0.88 0.90 0.94 RG 0.5 w 435 635 130 80 re S`)
  stream.push(`BT /F1 8 Tf 0.45 0.48 0.55 rg 445 698 Td (NET INCOME COLLECTED) Tj ET`)
  stream.push(`BT /F1 15 Tf 0.1 0.55 0.25 rg 445 675 Td (${escapePdfText(collectedNetFormatted)}) Tj ET`)
  stream.push(`BT /F1 7.5 Tf 0.4 0.45 0.5 rg 445 650 Td (Gross: ${escapePdfText(collectedRevFormatted)}) Tj ET`)

  // Section 1: Financial & Hours Distribution (Y: 480 to 615)
  stream.push(`BT /F1 11 Tf 0.09 0.11 0.15 rg 30 610 Td (FINANCIAL & TIME SUMMARY) Tj ET`)
  stream.push(`0.92 0.94 0.97 rg 30 520 535 75 re f`)

  stream.push(`BT /F1 8.5 Tf 0.2 0.25 0.3 rg 45 575 Td (Collected Revenue: ${escapePdfText(collectedRevFormatted)}) Tj ET`)
  stream.push(`BT /F1 8.5 Tf 0.2 0.25 0.3 rg 45 555 Td (Direct Expenses: -${escapePdfText(expensesFormatted)}) Tj ET`)
  stream.push(`BT /F1 8.5 Tf 0.2 0.25 0.3 rg 45 535 Td (Allocated Overhead: -${escapePdfText(overheadFormatted)}) Tj ET`)

  stream.push(`BT /F1 8.5 Tf 0.2 0.25 0.3 rg 300 575 Td (Paid Work Hours: ${data.hours.paidHours} hrs) Tj ET`)
  stream.push(`BT /F1 8.5 Tf 0.2 0.25 0.3 rg 300 555 Td (Unpaid Client Time: ${data.hours.unpaidClientHours} hrs) Tj ET`)
  stream.push(`BT /F1 8.5 Tf 0.2 0.25 0.3 rg 300 535 Td (Intentional Non-Client: ${data.hours.intentionalUnpaidHours} hrs) Tj ET`)

  // Section 2: Top Unpaid Leakage Breakdown (Y: 340 to 495)
  stream.push(`BT /F1 11 Tf 0.09 0.11 0.15 rg 30 495 Td (TOP UNPAID TIME LEAKAGE) Tj ET`)
  let leakY = 475
  const leakageItems = (data.topLeakageReasons || []).slice(0, 5)
  if (leakageItems.length === 0) {
    stream.push(`BT /F1 8.5 Tf 0.4 0.45 0.5 rg 45 ${leakY} Td (No unpaid leakage recorded for this period.) Tj ET`)
  } else {
    for (const leak of leakageItems) {
      const oppCost = formatPdfCurrency(leak.estimatedOpportunityCost, currency)
      stream.push(`0.96 0.97 0.99 rg 30 ${leakY - 5} 535 18 re f`)
      stream.push(`BT /F1 8 Tf 0.15 0.18 0.22 rg 40 ${leakY} Td (${escapePdfText(leak.label)} [${escapePdfText(leak.category)}]) Tj ET`)
      stream.push(`BT /F1 8 Tf 0.3 0.35 0.4 rg 320 ${leakY} Td (${leak.hours} hrs) Tj ET`)
      stream.push(`BT /F1 8 Tf 0.7 0.2 0.2 rg 450 ${leakY} Td (Opp. Cost: ${escapePdfText(oppCost)}) Tj ET`)
      leakY -= 22
    }
  }

  // Section 3: Client Profitability Matrix (Y: 180 to 320)
  stream.push(`BT /F1 11 Tf 0.09 0.11 0.15 rg 30 ${leakY - 15} Td (CLIENT & EMPLOYER YIELD RANKINGS) Tj ET`)
  let clientY = leakY - 35
  const clients = (data.clientRankings || []).slice(0, 4)
  if (clients.length === 0) {
    stream.push(`BT /F1 8.5 Tf 0.4 0.45 0.5 rg 45 ${clientY} Td (No client data recorded for this period.) Tj ET`)
  } else {
    for (const cl of clients) {
      const clRate = formatPdfCurrency(cl.effectiveHourlyRate, currency)
      const clNet = formatPdfCurrency(cl.netIncome, currency)
      stream.push(`0.96 0.97 0.99 rg 30 ${clientY - 5} 535 18 re f`)
      stream.push(`BT /F1 8 Tf 0.15 0.18 0.22 rg 40 ${clientY} Td (${escapePdfText(cl.clientName)}) Tj ET`)
      stream.push(`BT /F1 8 Tf 0.3 0.35 0.4 rg 260 ${clientY} Td (${cl.hours} hrs) Tj ET`)
      stream.push(`BT /F1 8 Tf 0.1 0.5 0.2 rg 360 ${clientY} Td (Net: ${escapePdfText(clNet)}) Tj ET`)
      stream.push(`BT /F1 8 Tf 0.388 0.4 0.945 rg 470 ${clientY} Td (${escapePdfText(clRate)}/h) Tj ET`)
      clientY -= 22
    }
  }

  // Footer
  stream.push(`0.85 0.88 0.92 RG 0.5 w 30 65 m 565 65 l S`)
  stream.push(`BT /F1 7.5 Tf 0.5 0.55 0.62 rg 40 48 Td (Generated securely via Wello Analytics Engine. Keep track of your true hourly value.) Tj ET`)

  const contentStream = stream.join('\n')
  return buildPdfDocument(contentStream, pageWidth, pageHeight)
}

/**
 * Assembles valid PDF 1.4 binary structure with objects, cross-reference table, and trailer.
 */
function buildPdfDocument(contentStream: string, width: number, height: number): Buffer {
  const streamBuf = Buffer.from(contentStream, 'utf-8')
  const streamLen = streamBuf.length

  const objects: Buffer[] = []
  const xrefOffsets: number[] = []

  let currentOffset = 0
  const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'utf-8')
  currentOffset += header.length

  function addObject(content: string): number {
    xrefOffsets.push(currentOffset)
    const objHeader = Buffer.from(`${objects.length + 1} 0 obj\n`, 'utf-8')
    const objBody = Buffer.from(content, 'utf-8')
    const objFooter = Buffer.from('\nendobj\n', 'utf-8')
    const objBuf = Buffer.concat([objHeader, objBody, objFooter])
    objects.push(objBuf)
    currentOffset += objBuf.length
    return objects.length
  }

  // Obj 1: Catalog
  addObject(`<< /Type /Catalog /Pages 2 0 R >>`)

  // Obj 2: Pages
  addObject(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`)

  // Obj 3: Page
  addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`)

  // Obj 4: Standard Font (Helvetica)
  addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)

  // Obj 5: Content Stream
  xrefOffsets.push(currentOffset)
  const sHead = Buffer.from(`5 0 obj\n<< /Length ${streamLen} >>\nstream\n`, 'utf-8')
  const sFoot = Buffer.from('\nendstream\nendobj\n', 'utf-8')
  const sBuf = Buffer.concat([sHead, streamBuf, sFoot])
  objects.push(sBuf)
  currentOffset += sBuf.length

  // XRef Table
  const xrefStart = currentOffset
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of xrefOffsets) {
    xrefStr += `${String(off).padStart(10, '0')} 00000 n \n`
  }

  const trailerStr = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  const xrefBuf = Buffer.from(xrefStr + trailerStr, 'utf-8')
  return Buffer.concat([header, ...objects, xrefBuf])
}
