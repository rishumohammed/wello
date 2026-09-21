// backend/database/migrations/20260921000017_production_hardening_and_indexes.cjs
/**
 * Migration 17: Production Hardening, Rate Limiting & Query Performance Indexes
 * - Creates rate_limits table for multi-node / single-node shared rate limiting
 * - Adds composite indexes for top 20 queries (work_sessions, projects, invoices, payments, events, audit_logs)
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. RATE LIMITS TABLE
  const hasRateLimits = await knex.schema.hasTable('rate_limits')
  if (!hasRateLimits) {
    await knex.schema.createTable('rate_limits', (table) => {
      table.string('key', 255).primary()
      table.integer('points').unsigned().notNullable().defaultTo(0)
      table.dateTime('expire_at', { precision: 3 }).notNullable()
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['expire_at'], 'idx_rate_limits_expire_at')
    })
  }

  // 1.1 USERS LOGO_URL
  const hasUsers = await knex.schema.hasTable('users')
  if (hasUsers) {
    const hasLogoUrl = await knex.schema.hasColumn('users', 'logo_url')
    if (!hasLogoUrl) {
      await knex.schema.alterTable('users', (table) => {
        table.text('logo_url').nullable()
      })
    }
  }

  // 2. QUERY PERFORMANCE INDEXES
  // A. work_sessions (user_id + start_time, user_id + status)
  const hasWorkSessions = await knex.schema.hasTable('work_sessions')
  if (hasWorkSessions) {
    try {
      await knex.schema.alterTable('work_sessions', (table) => {
        table.index(['user_id', 'start_time'], 'idx_ws_user_start_time')
      })
    } catch (e) {
      // index might already exist
    }
  }

  // B. projects (user_id + status)
  const hasProjects = await knex.schema.hasTable('projects')
  if (hasProjects) {
    try {
      await knex.schema.alterTable('projects', (table) => {
        table.index(['user_id', 'status'], 'idx_proj_user_status')
      })
    } catch (e) {
      // index might already exist
    }
  }

  // C. invoices (user_id + invoice_date, user_id + due_date)
  const hasInvoices = await knex.schema.hasTable('invoices')
  if (hasInvoices) {
    try {
      await knex.schema.alterTable('invoices', (table) => {
        table.index(['user_id', 'due_date'], 'idx_inv_user_due_date')
      })
    } catch (e) {
      // index might already exist
    }
  }

  // D. payments (user_id + paid_date)
  const hasPayments = await knex.schema.hasTable('payments')
  if (hasPayments) {
    try {
      await knex.schema.alterTable('payments', (table) => {
        table.index(['user_id', 'paid_date'], 'idx_pay_user_paid_date')
      })
    } catch (e) {
      // index might already exist
    }
  }

  // E. events (user_id + event_name + created_at)
  const hasEvents = await knex.schema.hasTable('events')
  if (hasEvents) {
    try {
      await knex.schema.alterTable('events', (table) => {
        table.index(['user_id', 'event_name', 'created_at'], 'idx_events_user_name_time')
      })
    } catch (e) {
      // index might already exist
    }
  }

  // F. audit_logs (hash + previous_hash)
  const hasAuditLogs = await knex.schema.hasTable('audit_logs')
  if (hasAuditLogs) {
    try {
      await knex.schema.alterTable('audit_logs', (table) => {
        table.index(['hash'], 'idx_audit_logs_hash')
        table.index(['previous_hash'], 'idx_audit_logs_prev_hash')
      })
    } catch (e) {
      // index might already exist
    }
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('rate_limits')
}
