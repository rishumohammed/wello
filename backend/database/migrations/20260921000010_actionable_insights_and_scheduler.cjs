// backend/database/migrations/20260921000010_actionable_insights_and_scheduler.cjs
/**
 * Migration: Actionable Insights, Distributed Scheduler, Reports, Email Digests, and Web Push Hooks
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. SCHEDULER LOCKS TABLE (Distributed lock leases)
  const hasSchedulerLocks = await knex.schema.hasTable('scheduler_locks')
  if (!hasSchedulerLocks) {
    await knex.schema.createTable('scheduler_locks', (table) => {
      table.string('lock_name', 50).primary()
      table.string('locked_by', 100).notNullable()
      table.dateTime('locked_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('lease_expires_at', { precision: 3 }).notNullable()
      table.index(['lease_expires_at'], 'idx_scheduler_lease_expires')
    })
  }

  // 2. SCHEDULED JOBS LOG (Idempotent job execution tracker)
  const hasScheduledJobsLog = await knex.schema.hasTable('scheduled_jobs_log')
  if (!hasScheduledJobsLog) {
    await knex.schema.createTable('scheduled_jobs_log', (table) => {
      table.increments('id').primary()
      table.string('job_key', 120).notNullable().unique('uq_scheduled_job_key')
      table.string('job_name', 60).notNullable()
      table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('CASCADE')
      table.enu('status', ['success', 'failed', 'skipped']).notNullable().defaultTo('success')
      table.text('result_summary').nullable()
      table.dateTime('executed_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['job_name', 'executed_at'], 'idx_scheduled_job_name_time')
      table.index(['user_id', 'job_name'], 'idx_scheduled_user_job')
    })
  }

  // 3. WEB PUSH SUBSCRIPTIONS
  const hasWebPush = await knex.schema.hasTable('web_push_subscriptions')
  if (!hasWebPush) {
    await knex.schema.createTable('web_push_subscriptions', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('endpoint').notNullable()
      table.text('p256dh').notNullable()
      table.string('auth', 255).notNullable()
      table.text('user_agent').nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['user_id'], 'idx_web_push_user')
    })
  }

  // 4. USERS TABLE DIGEST & UNSUBSCRIBE PREFERENCES
  const hasDigestFreq = await knex.schema.hasColumn('users', 'digest_frequency')
  if (!hasDigestFreq) {
    await knex.schema.alterTable('users', (table) => {
      table.string('digest_frequency', 20).notNullable().defaultTo('weekly')
      table.integer('digest_day_of_week').notNullable().defaultTo(1) // 1 = Monday
      table.integer('digest_hour_utc').notNullable().defaultTo(9)     // 09:00 UTC default
      table.dateTime('email_unsubscribed_at', { precision: 3 }).nullable()
      table.string('unsubscribe_token', 64).nullable()
      table.index(['unsubscribe_token'], 'idx_users_unsub_token')
    })
  }

  // 5. ENHANCE NOTIFICATIONS TABLE WITH ACTION URL & ACTOR
  const hasActionUrl = await knex.schema.hasColumn('notifications', 'action_url')
  if (!hasActionUrl) {
    await knex.schema.alterTable('notifications', (table) => {
      table.string('action_url', 255).nullable()
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasActionUrl = await knex.schema.hasColumn('notifications', 'action_url')
  if (hasActionUrl) {
    await knex.schema.alterTable('notifications', (table) => {
      table.dropColumn('action_url')
    })
  }

  const hasDigestFreq = await knex.schema.hasColumn('users', 'digest_frequency')
  if (hasDigestFreq) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('digest_frequency')
      table.dropColumn('digest_day_of_week')
      table.dropColumn('digest_hour_utc')
      table.dropColumn('email_unsubscribed_at')
      table.dropColumn('unsubscribe_token')
    })
  }

  await knex.schema.dropTableIfExists('web_push_subscriptions')
  await knex.schema.dropTableIfExists('scheduled_jobs_log')
  await knex.schema.dropTableIfExists('scheduler_locks')
}
