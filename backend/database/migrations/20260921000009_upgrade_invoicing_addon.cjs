// backend/database/migrations/20260921000009_upgrade_invoicing_addon.cjs
const crypto = require('crypto')

/**
 * Migration for Upgrading the Basic Invoicing Addon:
 * - Enhances invoices table (multi-currency, status lifecycle, partial payments, immutability, public tokens)
 * - Adds invoice_taxes, credit_notes, credit_note_items, recurring_invoice_profiles
 * - Adds format_pattern to invoice_sequences
 * - Links payments to invoices
 * - Adds public_token, accepted_at, rejected_at to project_quotes
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Invoices Table Enhancements
  const hasInvoices = await knex.schema.hasTable('invoices')
  if (hasInvoices) {
    // Check and add columns safely
    const hasPaymentTerms = await knex.schema.hasColumn('invoices', 'payment_terms')
    const hasAmountPaid = await knex.schema.hasColumn('invoices', 'amount_paid')
    const hasBalanceDue = await knex.schema.hasColumn('invoices', 'balance_due')
    const hasBaseCurrency = await knex.schema.hasColumn('invoices', 'base_currency')
    const hasFxRate = await knex.schema.hasColumn('invoices', 'fx_rate')
    const hasBaseTotal = await knex.schema.hasColumn('invoices', 'base_total')
    const hasTaxMode = await knex.schema.hasColumn('invoices', 'tax_mode')
    const hasReverseCharge = await knex.schema.hasColumn('invoices', 'is_reverse_charge')
    const hasTaxIdLabel = await knex.schema.hasColumn('invoices', 'tax_id_label')
    const hasPublicToken = await knex.schema.hasColumn('invoices', 'public_token')
    const hasPdfTemplate = await knex.schema.hasColumn('invoices', 'pdf_template')
    const hasSentAt = await knex.schema.hasColumn('invoices', 'sent_at')
    const hasViewedAt = await knex.schema.hasColumn('invoices', 'viewed_at')
    const hasLastReminder = await knex.schema.hasColumn('invoices', 'last_reminder_sent_at')
    const hasRemindersEnabled = await knex.schema.hasColumn('invoices', 'reminders_enabled')
    const hasPaymentLinkUrl = await knex.schema.hasColumn('invoices', 'payment_link_url')
    const hasPaymentLinkProvider = await knex.schema.hasColumn('invoices', 'payment_link_provider')
    const hasRecurringProfileId = await knex.schema.hasColumn('invoices', 'recurring_profile_id')
    const hasIsImmutable = await knex.schema.hasColumn('invoices', 'is_immutable')

    await knex.schema.alterTable('invoices', (table) => {
      if (!hasPaymentTerms) table.string('payment_terms', 50).notNullable().defaultTo('net_14')
      if (!hasAmountPaid) table.decimal('amount_paid', 19, 4).notNullable().defaultTo(0.0000)
      if (!hasBalanceDue) table.decimal('balance_due', 19, 4).notNullable().defaultTo(0.0000)
      if (!hasBaseCurrency) table.string('base_currency', 3).notNullable().defaultTo('USD')
      if (!hasFxRate) table.decimal('fx_rate', 19, 6).notNullable().defaultTo(1.000000)
      if (!hasBaseTotal) table.decimal('base_total', 19, 4).notNullable().defaultTo(0.0000)
      if (!hasTaxMode) table.string('tax_mode', 20).notNullable().defaultTo('exclusive')
      if (!hasReverseCharge) table.boolean('is_reverse_charge').notNullable().defaultTo(false)
      if (!hasTaxIdLabel) table.string('tax_id_label', 50).nullable().defaultTo('Tax ID / VAT Reg')
      if (!hasPublicToken) table.string('public_token', 64).nullable()
      if (!hasPdfTemplate) table.string('pdf_template', 50).notNullable().defaultTo('modern_clean')
      if (!hasSentAt) table.dateTime('sent_at', { precision: 3 }).nullable()
      if (!hasViewedAt) table.dateTime('viewed_at', { precision: 3 }).nullable()
      if (!hasLastReminder) table.dateTime('last_reminder_sent_at', { precision: 3 }).nullable()
      if (!hasRemindersEnabled) table.boolean('reminders_enabled').notNullable().defaultTo(true)
      if (!hasPaymentLinkUrl) table.string('payment_link_url', 500).nullable()
      if (!hasPaymentLinkProvider) table.string('payment_link_provider', 50).nullable()
      if (!hasRecurringProfileId) table.integer('recurring_profile_id').unsigned().nullable()
      if (!hasIsImmutable) table.boolean('is_immutable').notNullable().defaultTo(false)
    })

    // Modify status column to support all 8 lowercase statuses
    try {
      await knex.raw(`
        ALTER TABLE invoices
        MODIFY COLUMN status ENUM('draft','sent','viewed','partially_paid','paid','overdue','cancelled','void','DRAFT','SENT','PAID','OVERDUE','CANCELLED')
        NOT NULL DEFAULT 'draft'
      `)
      // Normalize any existing uppercase statuses to lowercase
      await knex.raw(`UPDATE invoices SET status = LOWER(status) WHERE status IN ('DRAFT','SENT','PAID','OVERDUE','CANCELLED')`)
      await knex.raw(`
        ALTER TABLE invoices
        MODIFY COLUMN status ENUM('draft','sent','viewed','partially_paid','paid','overdue','cancelled','void')
        NOT NULL DEFAULT 'draft'
      `)
    } catch (e) {
      console.warn('Status column alter notice:', e.message)
    }

    // Populate public_token and balance_due for any existing records
    const existingInvoices = await knex('invoices').select('id', 'total', 'amount_paid', 'public_token')
    for (const inv of existingInvoices) {
      const updates = {}
      if (!inv.public_token) {
        updates.public_token = crypto.randomBytes(32).toString('hex')
      }
      const paid = Number(inv.amount_paid) || 0
      const total = Number(inv.total) || 0
      updates.balance_due = Math.max(0, total - paid)
      updates.base_total = total
      if (Object.keys(updates).length > 0) {
        await knex('invoices').where({ id: inv.id }).update(updates)
      }
    }

    // Add unique index on public_token if not present
    try {
      await knex.schema.alterTable('invoices', (table) => {
        table.unique(['public_token'], 'uq_invoices_public_token')
      })
    } catch (e) {
      // index may already exist
    }
  }

  // 2. Invoice Items Enhancements (Tax per-line)
  const hasInvoiceItems = await knex.schema.hasTable('invoice_items')
  if (hasInvoiceItems) {
    const hasTaxRate = await knex.schema.hasColumn('invoice_items', 'tax_rate')
    const hasTaxName = await knex.schema.hasColumn('invoice_items', 'tax_name')
    const hasTaxAmount = await knex.schema.hasColumn('invoice_items', 'tax_amount')

    await knex.schema.alterTable('invoice_items', (table) => {
      if (!hasTaxRate) table.decimal('tax_rate', 5, 2).nullable().defaultTo(null)
      if (!hasTaxName) table.string('tax_name', 50).nullable().defaultTo(null)
      if (!hasTaxAmount) table.decimal('tax_amount', 19, 4).notNullable().defaultTo(0.0000)
    })
  }

  // 3. Invoice Taxes Table
  const hasInvoiceTaxes = await knex.schema.hasTable('invoice_taxes')
  if (!hasInvoiceTaxes) {
    await knex.schema.createTable('invoice_taxes', (table) => {
      table.increments('id').primary()
      table.integer('invoice_id').unsigned().notNullable()
      table.string('tax_name', 50).notNullable()
      table.decimal('tax_percent', 5, 2).notNullable()
      table.decimal('tax_amount', 19, 4).notNullable().defaultTo(0.0000)
      table.boolean('is_inclusive').notNullable().defaultTo(false)
      table.boolean('is_reverse_charge').notNullable().defaultTo(false)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.foreign('invoice_id').references('id').inTable('invoices').onDelete('CASCADE')
      table.index(['invoice_id'], 'idx_taxes_invoice')
    })
  } else {
    const hasInclusive = await knex.schema.hasColumn('invoice_taxes', 'is_inclusive')
    const hasRevCharge = await knex.schema.hasColumn('invoice_taxes', 'is_reverse_charge')
    await knex.schema.alterTable('invoice_taxes', (table) => {
      if (!hasInclusive) table.boolean('is_inclusive').notNullable().defaultTo(false)
      if (!hasRevCharge) table.boolean('is_reverse_charge').notNullable().defaultTo(false)
    })
  }

  // 4. Invoice Sequences Table Enhancement
  const hasInvoiceSequences = await knex.schema.hasTable('invoice_sequences')
  if (hasInvoiceSequences) {
    const hasFormatPattern = await knex.schema.hasColumn('invoice_sequences', 'format_pattern')
    if (!hasFormatPattern) {
      await knex.schema.alterTable('invoice_sequences', (table) => {
        table.string('format_pattern', 50).notNullable().defaultTo('{{prefix}}-{{year}}-{{seq:4}}')
      })
    }
  }

  // 5. Credit Notes Table
  const hasCreditNotes = await knex.schema.hasTable('credit_notes')
  if (!hasCreditNotes) {
    await knex.schema.createTable('credit_notes', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()
      table.integer('invoice_id').unsigned().notNullable()
      table.string('credit_note_number', 100).notNullable()
      table.date('credit_note_date').notNullable()
      table.string('currency', 3).notNullable().defaultTo('USD')
      table.decimal('subtotal', 19, 4).notNullable().defaultTo(0.0000)
      table.decimal('tax_amount', 19, 4).notNullable().defaultTo(0.0000)
      table.decimal('total', 19, 4).notNullable().defaultTo(0.0000)
      table.string('reason', 255).notNullable().defaultTo('Invoice Adjustment / Cancellation')
      table.text('notes').nullable()
      table.string('public_token', 64).notNullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('deleted_at', { precision: 3 }).nullable().defaultTo(null)

      table.foreign('user_id').references('id').inTable('users')
      table.foreign('invoice_id').references('id').inTable('invoices').onDelete('CASCADE')
      table.unique(['user_id', 'credit_note_number'], 'uq_user_credit_note_number')
      table.unique(['public_token'], 'uq_credit_notes_public_token')
      table.index(['user_id'], 'idx_credit_notes_user_id')
      table.index(['invoice_id'], 'idx_credit_notes_invoice_id')
    })
  }

  // 6. Credit Note Items Table
  const hasCreditNoteItems = await knex.schema.hasTable('credit_note_items')
  if (!hasCreditNoteItems) {
    await knex.schema.createTable('credit_note_items', (table) => {
      table.increments('id').primary()
      table.integer('credit_note_id').unsigned().notNullable()
      table.string('description', 255).notNullable()
      table.decimal('quantity', 10, 2).notNullable().defaultTo(1.00)
      table.decimal('unit_price', 19, 4).notNullable().defaultTo(0.0000)
      table.decimal('amount', 19, 4).notNullable().defaultTo(0.0000)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.foreign('credit_note_id').references('id').inTable('credit_notes').onDelete('CASCADE')
      table.index(['credit_note_id'], 'idx_credit_note_items')
    })
  }

  // 7. Recurring Invoice Profiles Table
  const hasRecurringProfiles = await knex.schema.hasTable('recurring_invoice_profiles')
  if (!hasRecurringProfiles) {
    await knex.schema.createTable('recurring_invoice_profiles', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()
      table.integer('client_id').unsigned().nullable()
      table.integer('project_id').unsigned().nullable()
      table.integer('income_source_id').unsigned().nullable()
      table.string('title', 200).notNullable()
      table.string('frequency', 50).notNullable().defaultTo('monthly') // weekly, biweekly, monthly, quarterly, annual, custom_days
      table.integer('interval_days').nullable().defaultTo(null)
      table.date('next_issue_date').notNullable()
      table.string('payment_terms', 50).notNullable().defaultTo('net_14')
      table.string('currency', 3).notNullable().defaultTo('USD')
      table.decimal('subtotal', 19, 4).notNullable().defaultTo(0.0000)
      table.decimal('tax_amount', 19, 4).notNullable().defaultTo(0.0000)
      table.decimal('total', 19, 4).notNullable().defaultTo(0.0000)
      table.boolean('auto_send').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.json('template_data').notNullable() // items, taxes, notes
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('deleted_at', { precision: 3 }).nullable().defaultTo(null)

      table.foreign('user_id').references('id').inTable('users')
      table.foreign('client_id').references('id').inTable('clients').onDelete('SET NULL')
      table.foreign('project_id').references('id').inTable('projects').onDelete('SET NULL')
      table.foreign('income_source_id').references('id').inTable('income_sources').onDelete('SET NULL')
      table.index(['user_id'], 'idx_recurring_profiles_user')
      table.index(['user_id', 'is_active', 'next_issue_date'], 'idx_recurring_profiles_active')
    })
  }

  // 8. Project Quotes Enhancements
  const hasProjectQuotes = await knex.schema.hasTable('project_quotes')
  if (hasProjectQuotes) {
    const hasQuoteToken = await knex.schema.hasColumn('project_quotes', 'public_token')
    const hasAcceptedAt = await knex.schema.hasColumn('project_quotes', 'accepted_at')
    const hasRejectedAt = await knex.schema.hasColumn('project_quotes', 'rejected_at')
    const hasQuotePdfTpl = await knex.schema.hasColumn('project_quotes', 'pdf_template')

    await knex.schema.alterTable('project_quotes', (table) => {
      if (!hasQuoteToken) table.string('public_token', 64).nullable()
      if (!hasAcceptedAt) table.dateTime('accepted_at', { precision: 3 }).nullable()
      if (!hasRejectedAt) table.dateTime('rejected_at', { precision: 3 }).nullable()
      if (!hasQuotePdfTpl) table.string('pdf_template', 50).notNullable().defaultTo('modern_clean')
    })

    const existingQuotes = await knex('project_quotes').select('id', 'public_token')
    for (const q of existingQuotes) {
      if (!q.public_token) {
        await knex('project_quotes').where({ id: q.id }).update({
          public_token: crypto.randomBytes(32).toString('hex'),
        })
      }
    }

    try {
      await knex.schema.alterTable('project_quotes', (table) => {
        table.unique(['public_token'], 'uq_quotes_public_token')
      })
    } catch (e) {
      // ignore if already unique
    }
  }

  // 9. Link Payments to Invoices
  const hasPayments = await knex.schema.hasTable('payments')
  if (hasPayments) {
    const hasInvoiceId = await knex.schema.hasColumn('payments', 'invoice_id')
    if (!hasInvoiceId) {
      await knex.schema.alterTable('payments', (table) => {
        table.integer('invoice_id').unsigned().nullable().references('id').inTable('invoices').onDelete('SET NULL')
        table.index(['user_id', 'invoice_id'], 'idx_payments_invoice')
      })
    }
  }
}

exports.down = async function(knex) {
  // Safe rollback
}
