// backend/database/migrations/20260921000012_real_enforceable_free_addon_system.cjs
/**
 * Migration: Real, Enforceable Free Addon System, Persona Defaults, and Fair-Use Limits
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Update addons table
  const hasAddons = await knex.schema.hasTable('addons')
  if (hasAddons) {
    const hasKey = await knex.schema.hasColumn('addons', 'key')
    const hasDefaultEnabled = await knex.schema.hasColumn('addons', 'default_enabled')
    const hasDependsOn = await knex.schema.hasColumn('addons', 'depends_on')
    const hasSortOrder = await knex.schema.hasColumn('addons', 'sort_order')
    const hasIsKilled = await knex.schema.hasColumn('addons', 'is_killed')

    await knex.schema.alterTable('addons', (table) => {
      if (!hasKey) table.string('key', 100).nullable()
      if (!hasDefaultEnabled) table.boolean('default_enabled').notNullable().defaultTo(false)
      if (!hasDependsOn) table.json('depends_on').nullable()
      if (!hasSortOrder) table.integer('sort_order').notNullable().defaultTo(0)
      if (!hasIsKilled) table.boolean('is_killed').notNullable().defaultTo(false)
    })

    // Populate key from slug if missing
    await knex.raw('UPDATE addons SET `key` = `slug` WHERE `key` IS NULL OR `key` = ""')
  }

  // 2. Update user_addons table to support activated_at / deactivated_at
  const hasUserAddons = await knex.schema.hasTable('user_addons')
  if (hasUserAddons) {
    const hasDeactivatedAt = await knex.schema.hasColumn('user_addons', 'deactivated_at')
    if (!hasDeactivatedAt) {
      await knex.schema.alterTable('user_addons', (table) => {
        table.dateTime('deactivated_at', { precision: 3 }).nullable()
      })
    }
  }

  // 3. Create addon_persona_defaults table
  const hasPersonaDefaults = await knex.schema.hasTable('addon_persona_defaults')
  if (!hasPersonaDefaults) {
    await knex.schema.createTable('addon_persona_defaults', (table) => {
      table.increments('id').primary()
      table.string('persona', 50).notNullable().unique()
      table.json('default_addon_keys').notNullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['persona'], 'idx_persona_defaults_persona')
    })

    // Seed initial persona mappings
    const now = new Date()
    await knex('addon_persona_defaults').insert([
      {
        persona: 'freelancer_projects',
        default_addon_keys: JSON.stringify(['basic-invoicing', 'pricing-calculator']),
        created_at: now,
        updated_at: now,
      },
      {
        persona: 'freelancer_hours',
        default_addon_keys: JSON.stringify(['basic-invoicing', 'executive-reports']),
        created_at: now,
        updated_at: now,
      },
      {
        persona: 'agency_subcontractor',
        default_addon_keys: JSON.stringify(['basic-invoicing', 'recurring-retainers', 'executive-reports', 'pricing-calculator']),
        created_at: now,
        updated_at: now,
      },
      {
        persona: 'creator_products',
        default_addon_keys: JSON.stringify(['income-streams', 'executive-reports']),
        created_at: now,
        updated_at: now,
      },
      {
        persona: 'multi_stream',
        default_addon_keys: JSON.stringify(['basic-invoicing', 'income-streams', 'executive-reports', 'pricing-calculator']),
        created_at: now,
        updated_at: now,
      },
      {
        persona: 'default',
        default_addon_keys: JSON.stringify(['basic-invoicing']),
        created_at: now,
        updated_at: now,
      },
    ])
  }

  // 4. Create fair_use_limits table
  const hasFairUseLimits = await knex.schema.hasTable('fair_use_limits')
  if (!hasFairUseLimits) {
    await knex.schema.createTable('fair_use_limits', (table) => {
      table.increments('id').primary()
      table.string('limit_key', 50).notNullable().unique()
      table.string('name', 100).notNullable()
      table.integer('limit_value').notNullable()
      table.integer('window_seconds').notNullable().defaultTo(86400)
      table.string('unit', 30).notNullable()
      table.text('description').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['limit_key'], 'idx_fair_use_limits_key')
    })

    // Seed default fair-use protection limits
    const now = new Date()
    await knex('fair_use_limits').insert([
      {
        limit_key: 'invoices_per_day',
        name: 'Daily Invoice Creations',
        limit_value: 100,
        window_seconds: 86400,
        unit: 'invoices/day',
        description: 'Safety rate limit to prevent spam invoice generation and automated script abuse.',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        limit_key: 'pdf_exports_per_hour',
        name: 'Hourly PDF Vector Exports',
        limit_value: 60,
        window_seconds: 3600,
        unit: 'exports/hour',
        description: 'CPU protection limit against continuous automated PDF generation.',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        limit_key: 'max_logo_size_kb',
        name: 'Maximum Invoice Logo Size',
        limit_value: 2048,
        window_seconds: 0,
        unit: 'KB',
        description: 'Maximum allowable file size for custom branding invoice logo uploads.',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        limit_key: 'max_import_rows',
        name: 'Maximum CSV Batch Import Rows',
        limit_value: 5000,
        window_seconds: 0,
        unit: 'rows',
        description: 'Maximum data rows allowed in a single time-tracking or client batch import.',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ])
  }

  // 5. Create fair_use_logs table for tracking usage windows
  const hasFairUseLogs = await knex.schema.hasTable('fair_use_logs')
  if (!hasFairUseLogs) {
    await knex.schema.createTable('fair_use_logs', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
      table.string('limit_key', 50).notNullable()
      table.dateTime('window_start', { precision: 3 }).notNullable()
      table.integer('current_count').notNullable().defaultTo(1)
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.unique(['user_id', 'limit_key', 'window_start'], 'uq_user_limit_window')
      table.index(['user_id', 'limit_key'], 'idx_fair_use_user_key')
    })
  }

  // 6. Seed official Free Addons in database
  const existingAddons = await knex('addons').select('slug')
  const existingSlugs = new Set(existingAddons.map(a => a.slug))

  const officialAddons = [
    {
      slug: 'basic-invoicing',
      key: 'basic-invoicing',
      name: 'Basic Invoicing',
      description: 'Create, issue, print, and track professional client invoices and payment balances directly from your logged time and projects.',
      category: 'Finance & Invoicing',
      icon: 'IconReceipt',
      version: '1.0.0',
      is_free: true,
      status: 'PUBLISHED',
      default_enabled: false,
      depends_on: JSON.stringify([]),
      sort_order: 1,
      is_killed: false,
    },
    {
      slug: 'pricing-calculator',
      key: 'pricing-calculator',
      name: 'Pricing & Quote Calculator',
      description: 'Benchmark historical effective hourly earnings and calculate smart quote targets with unpaid buffers and target margins.',
      category: 'Pricing & Quotes',
      icon: 'IconCalculator',
      version: '1.0.0',
      is_free: true,
      status: 'PUBLISHED',
      default_enabled: false,
      depends_on: JSON.stringify([]),
      sort_order: 2,
      is_killed: false,
    },
    {
      slug: 'executive-reports',
      key: 'executive-reports',
      name: 'Executive Reports & CSV/PDF Export',
      description: 'Comprehensive daily, weekly, and monthly hourly-value reports, leakage analysis, and PDF vector executive summaries.',
      category: 'Reports & Analytics',
      icon: 'IconReport',
      version: '1.0.0',
      is_free: true,
      status: 'PUBLISHED',
      default_enabled: false,
      depends_on: JSON.stringify([]),
      sort_order: 3,
      is_killed: false,
    },
    {
      slug: 'recurring-retainers',
      key: 'recurring-retainers',
      name: 'Recurring Retainers & Schedules',
      description: 'Manage recurring invoice generation, fixed monthly client retainers, and automated scheduled billing cycles.',
      category: 'Finance & Invoicing',
      icon: 'IconRepeat',
      version: '1.0.0',
      is_free: true,
      status: 'PUBLISHED',
      default_enabled: false,
      depends_on: JSON.stringify(['basic-invoicing']),
      sort_order: 4,
      is_killed: false,
    },
    {
      slug: 'income-streams',
      key: 'income-streams',
      name: 'Multi-Stream Income & Overheads',
      description: 'Track multiple income streams, freelance vs salary streams, and monthly recurring overhead expense allocations.',
      category: 'Revenue Management',
      icon: 'IconLayers',
      version: '1.0.0',
      is_free: true,
      status: 'PUBLISHED',
      default_enabled: false,
      depends_on: JSON.stringify([]),
      sort_order: 5,
      is_killed: false,
    },
  ]

  for (const addon of officialAddons) {
    if (existingSlugs.has(addon.slug)) {
      await knex('addons').where({ slug: addon.slug }).update({
        key: addon.key,
        name: addon.name,
        description: addon.description,
        category: addon.category,
        icon: addon.icon,
        is_free: true,
        depends_on: addon.depends_on,
        sort_order: addon.sort_order,
        is_killed: addon.is_killed,
        updated_at: new Date(),
      })
    } else {
      await knex('addons').insert({
        ...addon,
        created_at: new Date(),
        updated_at: new Date(),
      })
    }
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('fair_use_logs')
  await knex.schema.dropTableIfExists('fair_use_limits')
  await knex.schema.dropTableIfExists('addon_persona_defaults')
}
