// backend/database/migrations/20260921000015_analytics_admin_tools.cjs

/**
 * Migration for Admin Analytics Tools & Webhook Enhancements:
 * - Creates analytics_saved_views table for custom admin filter configurations
 * - Creates analytics_scheduled_reports table for automated email digests
 * - Extends email_logs with delivered_at, opened_at, bounced_at, complained_at
 * - Adds security & audit indexes
 */
exports.up = async function (knex) {
  // 1. CREATE analytics_saved_views TABLE
  const hasSavedViews = await knex.schema.hasTable('analytics_saved_views')
  if (!hasSavedViews) {
    await knex.schema.createTable('analytics_saved_views', (table) => {
      table.increments('id').primary()
      table.integer('admin_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 150).notNullable()
      table.string('section_key', 50).notNullable().defaultTo('overview')
      table.json('filters_json').notNullable()
      table.boolean('is_default').notNullable().defaultTo(false)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['admin_user_id', 'section_key'], 'idx_asv_admin_section')
    })
  }

  // 2. CREATE analytics_scheduled_reports TABLE
  const hasSchedReports = await knex.schema.hasTable('analytics_scheduled_reports')
  if (!hasSchedReports) {
    await knex.schema.createTable('analytics_scheduled_reports', (table) => {
      table.increments('id').primary()
      table.integer('admin_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('report_name', 150).notNullable()
      table.enu('frequency', ['daily', 'weekly', 'monthly']).notNullable().defaultTo('weekly')
      table.json('recipient_emails').notNullable()
      table.json('sections_json').notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.dateTime('last_sent_at', { precision: 3 }).nullable()
      table.dateTime('next_run_at', { precision: 3 }).nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['is_active', 'next_run_at'], 'idx_asr_active_next')
      table.index(['admin_user_id'], 'idx_asr_admin')
    })
  }

  // 3. EXTEND email_logs with Resend Webhook timestamps
  const hasEmailLogs = await knex.schema.hasTable('email_logs')
  if (hasEmailLogs) {
    const hasDelivered = await knex.schema.hasColumn('email_logs', 'delivered_at')
    const hasOpened = await knex.schema.hasColumn('email_logs', 'opened_at')
    const hasBounced = await knex.schema.hasColumn('email_logs', 'bounced_at')
    const hasComplained = await knex.schema.hasColumn('email_logs', 'complained_at')
    const hasMetadata = await knex.schema.hasColumn('email_logs', 'metadata')

    await knex.schema.alterTable('email_logs', (table) => {
      if (!hasDelivered) table.dateTime('delivered_at', { precision: 3 }).nullable()
      if (!hasOpened) table.dateTime('opened_at', { precision: 3 }).nullable()
      if (!hasBounced) table.dateTime('bounced_at', { precision: 3 }).nullable()
      if (!hasComplained) table.dateTime('complained_at', { precision: 3 }).nullable()
      if (!hasMetadata) table.json('metadata').nullable()
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('analytics_scheduled_reports')
  await knex.schema.dropTableIfExists('analytics_saved_views')
}
