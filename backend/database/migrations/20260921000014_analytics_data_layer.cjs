// backend/database/migrations/20260921000014_analytics_data_layer.cjs

/**
 * Migration for Analytics Data Layer:
 * - Extends analytics_events with rich context, anonymous IDs, device/geo metadata
 * - Creates analytics_anonymous_mappings for guest-to-user linking
 * - Creates analytics_funnel_definitions & analytics_funnel_steps for configurable funnels
 * - Redesigns analytics_daily_rollups for dimensional aggregation
 * - Creates analytics_cohorts for retention matrices
 * - Creates analytics_user_summaries for per-user activation/churn lifecycle metrics
 */
exports.up = async function (knex) {
  // 1. EXTEND analytics_events TABLE
  const hasEventsTable = await knex.schema.hasTable('analytics_events')
  if (hasEventsTable) {
    const hasName = await knex.schema.hasColumn('analytics_events', 'name')
    const hasTimestamp = await knex.schema.hasColumn('analytics_events', 'timestamp')
    const hasAnonId = await knex.schema.hasColumn('analytics_events', 'anonymous_id')
    const hasSessionId = await knex.schema.hasColumn('analytics_events', 'session_id')
    const hasProperties = await knex.schema.hasColumn('analytics_events', 'properties')
    const hasCountry = await knex.schema.hasColumn('analytics_events', 'country')
    const hasTimezone = await knex.schema.hasColumn('analytics_events', 'timezone')
    const hasDeviceType = await knex.schema.hasColumn('analytics_events', 'device_type')
    const hasOs = await knex.schema.hasColumn('analytics_events', 'os')
    const hasBrowser = await knex.schema.hasColumn('analytics_events', 'browser')
    const hasAppVersion = await knex.schema.hasColumn('analytics_events', 'app_version')
    const hasIsPwa = await knex.schema.hasColumn('analytics_events', 'is_pwa')
    const hasReferrer = await knex.schema.hasColumn('analytics_events', 'referrer')
    const hasUtmSource = await knex.schema.hasColumn('analytics_events', 'utm_source')
    const hasUtmMedium = await knex.schema.hasColumn('analytics_events', 'utm_medium')
    const hasUtmCampaign = await knex.schema.hasColumn('analytics_events', 'utm_campaign')
    const hasIsBot = await knex.schema.hasColumn('analytics_events', 'is_bot')
    const hasIsInternal = await knex.schema.hasColumn('analytics_events', 'is_internal')

    await knex.schema.alterTable('analytics_events', (table) => {
      if (!hasName) table.string('name', 100).nullable()
      if (!hasTimestamp) table.dateTime('timestamp', { precision: 3 }).nullable()
      if (!hasAnonId) table.string('anonymous_id', 100).nullable()
      if (!hasSessionId) table.string('session_id', 100).nullable()
      if (!hasProperties) table.json('properties').nullable()
      if (!hasCountry) table.string('country', 3).nullable()
      if (!hasTimezone) table.string('timezone', 50).nullable()
      if (!hasDeviceType) table.string('device_type', 30).nullable()
      if (!hasOs) table.string('os', 50).nullable()
      if (!hasBrowser) table.string('browser', 50).nullable()
      if (!hasAppVersion) table.string('app_version', 20).nullable()
      if (!hasIsPwa) table.boolean('is_pwa').notNullable().defaultTo(false)
      if (!hasReferrer) table.string('referrer', 255).nullable()
      if (!hasUtmSource) table.string('utm_source', 100).nullable()
      if (!hasUtmMedium) table.string('utm_medium', 100).nullable()
      if (!hasUtmCampaign) table.string('utm_campaign', 100).nullable()
      if (!hasIsBot) table.boolean('is_bot').notNullable().defaultTo(false)
      if (!hasIsInternal) table.boolean('is_internal').notNullable().defaultTo(false)
    })

    // Populate name from event_name and timestamp from created_at for existing rows
    await knex.raw('UPDATE analytics_events SET `name` = `event_name` WHERE `name` IS NULL')
    await knex.raw('UPDATE analytics_events SET `timestamp` = `created_at` WHERE `timestamp` IS NULL')
    await knex.raw('UPDATE analytics_events SET `properties` = `metadata` WHERE `properties` IS NULL AND `metadata` IS NOT NULL')

    // Add indexes if not present
    try {
      await knex.schema.alterTable('analytics_events', (table) => {
        table.index(['timestamp', 'name'], 'idx_ae_ts_name')
        table.index(['user_id', 'timestamp'], 'idx_ae_user_ts')
        table.index(['anonymous_id'], 'idx_ae_anon')
        table.index(['country', 'timestamp'], 'idx_ae_country_ts')
      })
    } catch {
      // Indexes may already exist
    }
  }

  // 2. CREATE analytics_anonymous_mappings TABLE
  const hasAnonMap = await knex.schema.hasTable('analytics_anonymous_mappings')
  if (!hasAnonMap) {
    await knex.schema.createTable('analytics_anonymous_mappings', (table) => {
      table.increments('id').primary()
      table.string('anonymous_id', 100).notNullable()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.dateTime('merged_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.unique(['anonymous_id', 'user_id'], 'uq_anon_user_merge')
      table.index(['anonymous_id'], 'idx_anon_map_anon_id')
      table.index(['user_id'], 'idx_anon_map_user_id')
    })
  }

  // 3. CREATE analytics_funnel_definitions & analytics_funnel_steps TABLES
  const hasFunnelDefs = await knex.schema.hasTable('analytics_funnel_definitions')
  if (!hasFunnelDefs) {
    await knex.schema.createTable('analytics_funnel_definitions', (table) => {
      table.increments('id').primary()
      table.string('slug', 100).unique().notNullable()
      table.string('name', 150).notNullable()
      table.text('description').nullable()
      table.boolean('is_default').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('window_days').notNullable().defaultTo(30)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['slug'], 'idx_funnel_slug')
      table.index(['is_default'], 'idx_funnel_default')
    })
  }

  const hasFunnelSteps = await knex.schema.hasTable('analytics_funnel_steps')
  if (!hasFunnelSteps) {
    await knex.schema.createTable('analytics_funnel_steps', (table) => {
      table.increments('id').primary()
      table.integer('funnel_id').unsigned().notNullable().references('id').inTable('analytics_funnel_definitions').onDelete('CASCADE')
      table.integer('step_order').notNullable()
      table.string('step_key', 100).notNullable()
      table.string('step_name', 150).notNullable()
      table.json('event_names').notNullable()
      table.boolean('is_required').notNullable().defaultTo(true)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.unique(['funnel_id', 'step_order'], 'uq_funnel_step_order')
      table.index(['funnel_id'], 'idx_funnel_steps_funnel')
    })

    // Seed default activation funnel
    const now = new Date()
    const [funnelId] = await knex('analytics_funnel_definitions').insert({
      slug: 'default_activation_funnel',
      name: 'Default Activation Funnel',
      description: 'Core user activation journey from acquisition to invoice payment & retention',
      is_default: true,
      is_active: true,
      window_days: 30,
      created_at: now,
      updated_at: now,
    })

    const defaultSteps = [
      {
        funnel_id: funnelId,
        step_order: 1,
        step_key: 'registration_started',
        step_name: 'Registration Started',
        event_names: JSON.stringify(['registration_started', 'landing_viewed']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 2,
        step_key: 'otp_verified',
        step_name: 'OTP Verified',
        event_names: JSON.stringify(['otp_verified']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 3,
        step_key: 'profile_completed',
        step_name: 'Profile Completed',
        event_names: JSON.stringify(['profile_completed', 'registration_completed', 'onboarding_step_completed']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 4,
        step_key: 'first_entity',
        step_name: 'First Client, Project, or Income Source',
        event_names: JSON.stringify(['client_created', 'project_created', 'income_source_created']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 5,
        step_key: 'first_timer_or_session',
        step_name: 'First Timer or Work Session',
        event_names: JSON.stringify(['timer_started', 'session_logged']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 6,
        step_key: 'first_payment',
        step_name: 'First Payment Logged',
        event_names: JSON.stringify(['payment_logged']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 7,
        step_key: 'rate_viewed',
        step_name: 'Rate / Insights Viewed',
        event_names: JSON.stringify(['rate_viewed', 'insights_viewed']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 8,
        step_key: 'first_invoice',
        step_name: 'First Invoice Created',
        event_names: JSON.stringify(['invoice_created']),
        is_required: true,
        created_at: now,
      },
      {
        funnel_id: funnelId,
        step_order: 9,
        step_key: 'returned_within_7d',
        step_name: 'Returned Within 7 Days',
        event_names: JSON.stringify(['returned_within_7d']),
        is_required: true,
        created_at: now,
      },
    ]

    await knex('analytics_funnel_steps').insert(defaultSteps)
  }

  // 4. RECREATE / REDESIGN analytics_daily_rollups TABLE
  await knex.schema.dropTableIfExists('analytics_daily_rollups')
  await knex.schema.createTable('analytics_daily_rollups', (table) => {
    table.bigIncrements('id').primary()
    table.date('rollup_date').notNullable()
    table.string('country', 3).notNullable().defaultTo('ALL')
    table.string('category', 50).notNullable().defaultTo('ALL')
    table.string('platform', 20).notNullable().defaultTo('ALL') // 'pwa', 'browser', 'mobile', 'ALL'
    table.integer('total_users').notNullable().defaultTo(0)
    table.integer('active_users').notNullable().defaultTo(0) // DAU
    table.integer('new_signups').notNullable().defaultTo(0)
    table.integer('events_count').notNullable().defaultTo(0)
    table.decimal('hours_tracked', 12, 2).notNullable().defaultTo(0)
    table.decimal('revenue_tracked_usd', 15, 2).notNullable().defaultTo(0)
    table.integer('unpaid_sessions_count').notNullable().defaultTo(0)
    table.decimal('unpaid_hours_tracked', 12, 2).notNullable().defaultTo(0)
    table.decimal('unpaid_share_percent', 5, 2).notNullable().defaultTo(0)
    table.integer('invoices_created_count').notNullable().defaultTo(0)
    table.integer('invoices_paid_count').notNullable().defaultTo(0)
    table.integer('invoices_overdue_count').notNullable().defaultTo(0)
    table.decimal('invoices_paid_amount_usd', 15, 2).notNullable().defaultTo(0)
    table.json('invoices_by_status').nullable()
    table.integer('emails_sent').notNullable().defaultTo(0)
    table.integer('emails_delivered').notNullable().defaultTo(0)
    table.integer('emails_opened').notNullable().defaultTo(0)
    table.integer('emails_failed').notNullable().defaultTo(0)
    table.integer('errors_count').notNullable().defaultTo(0)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.unique(['rollup_date', 'country', 'category', 'platform'], 'uq_daily_rollup_dims')
    table.index(['rollup_date'], 'idx_rollups_date')
    table.index(['country'], 'idx_rollups_country')
    table.index(['platform'], 'idx_rollups_platform')
  })

  // 5. CREATE analytics_cohorts TABLE
  const hasCohorts = await knex.schema.hasTable('analytics_cohorts')
  if (!hasCohorts) {
    await knex.schema.createTable('analytics_cohorts', (table) => {
      table.increments('id').primary()
      table.string('cohort_type', 10).notNullable() // 'weekly', 'monthly'
      table.string('cohort_period', 20).notNullable() // '2026-W38', '2026-09'
      table.integer('period_number').notNullable() // 0, 1, 2, 3...
      table.integer('cohort_size').notNullable().defaultTo(0)
      table.integer('retained_users').notNullable().defaultTo(0)
      table.decimal('retention_rate', 5, 2).notNullable().defaultTo(0)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.unique(['cohort_type', 'cohort_period', 'period_number'], 'uq_cohort_period_step')
      table.index(['cohort_type', 'cohort_period'], 'idx_cohort_lookup')
    })
  }

  // 6. CREATE analytics_user_summaries TABLE
  const hasUserSummaries = await knex.schema.hasTable('analytics_user_summaries')
  if (!hasUserSummaries) {
    await knex.schema.createTable('analytics_user_summaries', (table) => {
      table.integer('user_id').unsigned().primary().references('id').inTable('users').onDelete('CASCADE')
      table.dateTime('first_seen_at', { precision: 3 }).nullable()
      table.dateTime('registered_at', { precision: 3 }).notNullable()
      table.dateTime('onboarding_completed_at', { precision: 3 }).nullable()
      table.dateTime('first_active_at', { precision: 3 }).nullable()
      table.dateTime('last_active_at', { precision: 3 }).nullable()
      table.integer('total_sessions_count').notNullable().defaultTo(0)
      table.decimal('total_hours_tracked', 10, 2).notNullable().defaultTo(0)
      table.integer('total_payments_count').notNullable().defaultTo(0)
      table.decimal('total_revenue_usd', 15, 2).notNullable().defaultTo(0)
      table.integer('total_invoices_count').notNullable().defaultTo(0)
      table.integer('total_events_count').notNullable().defaultTo(0)
      table.string('current_funnel_stage', 100).nullable()
      table.decimal('time_to_activate_hours', 10, 2).nullable()
      table.boolean('is_activated').notNullable().defaultTo(false)
      table.boolean('is_churned').notNullable().defaultTo(false)
      table.boolean('is_internal').notNullable().defaultTo(false)
      table.string('country', 3).nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['is_activated'], 'idx_aus_is_activated')
      table.index(['is_churned'], 'idx_aus_is_churned')
      table.index(['last_active_at'], 'idx_aus_last_active')
      table.index(['registered_at'], 'idx_aus_registered')
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('analytics_user_summaries')
  await knex.schema.dropTableIfExists('analytics_cohorts')
  await knex.schema.dropTableIfExists('analytics_daily_rollups')
  await knex.schema.dropTableIfExists('analytics_funnel_steps')
  await knex.schema.dropTableIfExists('analytics_funnel_definitions')
  await knex.schema.dropTableIfExists('analytics_anonymous_mappings')
}
