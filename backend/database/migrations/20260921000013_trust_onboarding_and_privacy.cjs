// backend/database/migrations/20260921000013_trust_onboarding_and_privacy.cjs

/**
 * Migration for Trust, Privacy, Onboarding, Import/Export, Account Deletion, and Support Feedback.
 */
exports.up = async function (knex) {
  // 1. Extend users table
  await knex.raw('ALTER TABLE users MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT "ACTIVE"')
  const hasScheduledDeletion = await knex.schema.hasColumn('users', 'scheduled_deletion_at')
  if (!hasScheduledDeletion) {
    await knex.schema.alterTable('users', (table) => {
      table.dateTime('scheduled_deletion_at').nullable()
      table.integer('deletion_grace_period_days').defaultTo(14)
      table.boolean('analytics_consent').defaultTo(true)
      table.string('cookie_consent', 32).nullable() // 'accepted', 'essential_only', 'custom', 'rejected'
      table.dateTime('onboarding_completed_at').nullable()
      table.decimal('target_monthly_income', 15, 2).nullable()
    })
  }

  // 2. Create user_feedback table
  const hasUserFeedback = await knex.schema.hasTable('user_feedback')
  if (!hasUserFeedback) {
    await knex.schema.createTable('user_feedback', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.string('user_email', 255).notNullable()
      table.string('category', 64).notNullable().defaultTo('general') // 'bug', 'feature', 'question', 'support', 'general'
      table.string('subject', 255).nullable()
      table.text('message').notNullable()
      table.string('status', 32).notNullable().defaultTo('open') // 'open', 'in_review', 'resolved'
      table.text('admin_response').nullable()
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())

      table.index(['user_id'], 'idx_user_feedback_user')
      table.index(['status'], 'idx_user_feedback_status')
    })
  }

  // 3. Create data_retention_policies table
  const hasRetention = await knex.schema.hasTable('data_retention_policies')
  if (!hasRetention) {
    await knex.schema.createTable('data_retention_policies', (table) => {
      table.increments('id').primary()
      table.string('policy_key', 64).unique().notNullable()
      table.string('name', 255).notNullable()
      table.integer('retention_days').notNullable()
      table.boolean('is_active').defaultTo(true)
      table.text('description').nullable()
      table.dateTime('last_run_at').nullable()
      table.integer('records_purged_total').defaultTo(0)
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())
    })

    // Seed default retention policies
    await knex('data_retention_policies').insert([
      {
        policy_key: 'expired_otps',
        name: 'Expired OTP Codes Purge',
        retention_days: 1,
        is_active: true,
        description: 'Permanently removes single-use login OTP codes older than 24 hours.',
      },
      {
        policy_key: 'revoked_sessions',
        name: 'Revoked Auth Sessions Cleanup',
        retention_days: 30,
        is_active: true,
        description: 'Purges revoked or expired authentication tokens and refresh tokens.',
      },
      {
        policy_key: 'raw_analytics_events',
        name: 'Raw Analytics Telemetry Pruning',
        retention_days: 90,
        is_active: true,
        description: 'Prunes raw granular analytics events older than 90 days (daily aggregated rollups preserved).',
      },
      {
        policy_key: 'email_logs',
        name: 'Outbound Email Logs Pruning',
        retention_days: 90,
        is_active: true,
        description: 'Purges delivery and dispatch logs for outbound notifications older than 90 days.',
      },
      {
        policy_key: 'fair_use_logs',
        name: 'Fair-Use Audit Logs Pruning',
        retention_days: 30,
        is_active: true,
        description: 'Cleans up rate limiting and abuse prevention sliding window event logs older than 30 days.',
      },
      {
        policy_key: 'expired_account_deletions',
        name: 'Expired Account Deletions Full Erasure',
        retention_days: 14,
        is_active: true,
        description: 'Executes permanent, irreversible erasure across all tables for accounts whose 14-day deletion grace period has elapsed.',
      },
    ])
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('data_retention_policies')
  await knex.schema.dropTableIfExists('user_feedback')
  const hasScheduledDeletion = await knex.schema.hasColumn('users', 'scheduled_deletion_at')
  if (hasScheduledDeletion) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('scheduled_deletion_at')
      table.dropColumn('deletion_grace_period_days')
      table.dropColumn('analytics_consent')
      table.dropColumn('cookie_consent')
      table.dropColumn('onboarding_completed_at')
      table.dropColumn('target_monthly_income')
    })
  }
}
