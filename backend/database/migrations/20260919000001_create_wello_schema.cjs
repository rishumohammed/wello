// backend/database/migrations/20260919000001_create_wello_schema.cjs
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. USERS
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary()
    table.string('name', 150).notNullable()
    table.string('email', 255).notNullable().unique()
    table.string('avatar_initials', 4).nullable()
    table.decimal('target_hourly', 19, 4).nullable()
    table.string('base_currency', 3).notNullable().defaultTo('USD')
    table.string('timezone', 50).notNullable().defaultTo('UTC')
    table.string('country', 2).nullable()
    table.string('phone_e164', 50).nullable().unique()
    table.enu('status', ['REGISTERED', 'EMAIL_PENDING', 'VERIFICATION_PENDING', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED']).notNullable().defaultTo('ACTIVE')
    table.enu('role', ['user', 'admin']).notNullable().defaultTo('user')
    table.string('state', 100).nullable()
    table.string('city', 100).nullable()
    table.string('business_name', 200).nullable()
    table.text('business_address').nullable()
    table.string('business_tax_id', 100).nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['status'], 'idx_users_status')
    table.index(['created_at'], 'idx_users_created_at')
  })

  // 2. CATEGORIES
  await knex.schema.createTable('categories', (table) => {
    table.increments('id').primary()
    table.integer('parent_id').unsigned().nullable().references('id').inTable('categories').onDelete('SET NULL')
    table.string('name', 150).notNullable()
    table.string('slug', 150).notNullable().unique()
    table.text('description').nullable()
    table.string('icon', 50).notNullable().defaultTo('IconBriefcase')
    table.integer('display_order').notNullable().defaultTo(0)
    table.boolean('is_active').notNullable().defaultTo(true)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['parent_id'], 'idx_categories_parent')
    table.index(['is_active'], 'idx_categories_active')
  })

  // 3. CLIENTS
  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('name', 200).notNullable()
    table.string('email', 255).nullable()
    table.string('phone_e164', 50).nullable()
    table.string('company', 200).nullable()
    table.string('country', 2).nullable()
    table.text('notes').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_clients_user_id')
    table.index(['user_id', 'deleted_at'], 'idx_clients_user_deleted')
  })

  // 4. PROJECTS
  await knex.schema.createTable('projects', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('client_id').unsigned().nullable().references('id').inTable('clients').onDelete('SET NULL')
    table.integer('category_id').unsigned().nullable().references('id').inTable('categories').onDelete('SET NULL')
    table.string('name', 255).notNullable()
    table.text('description').nullable()
    table.string('service_category', 150).nullable() // Retained for migration transition mapping
    table.enu('status', ['potential', 'quoted', 'approved', 'in_progress', 'completed', 'lost']).notNullable().defaultTo('potential')
    table.boolean('is_job').notNullable().defaultTo(false)
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.decimal('quote_amount', 19, 4).nullable()
    table.date('quote_date').nullable()
    table.decimal('quote_est_hours', 8, 2).nullable()
    table.text('quote_notes').nullable()
    table.enu('quote_status', ['draft', 'sent', 'accepted', 'rejected']).notNullable().defaultTo('draft')
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_projects_user_id')
    table.index(['client_id'], 'idx_projects_client_id')
    table.index(['category_id'], 'idx_projects_category_id')
    table.index(['status'], 'idx_projects_status')
    table.index(['user_id', 'status'], 'idx_projects_user_status')
    table.index(['user_id', 'deleted_at'], 'idx_projects_user_deleted')
  })

  // 5. WORK SESSIONS
  await knex.schema.createTable('work_sessions', (table) => {
    table.increments('id').primary()
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects')
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('title', 255).notNullable().defaultTo('Work session')
    table.enu('type', ['meeting', 'call', 'discussion', 'planning', 'proposal', 'travel', 'production', 'revision', 'delivery', 'other']).notNullable().defaultTo('other')
    table.enu('payment_type', ['unpaid', 'paid', 'intentional_unpaid']).notNullable().defaultTo('unpaid')
    table.enu('unpaid_reason', ['learning', 'portfolio', 'charity', 'strategic', 'personal', 'client_work']).nullable()
    table.text('notes').nullable()
    table.dateTime('started_at', { precision: 3 }).notNullable()
    table.dateTime('ended_at', { precision: 3 }).nullable()
    table.integer('duration_seconds').notNullable().defaultTo(0)
    table.integer('paused_seconds').notNullable().defaultTo(0)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_sessions_user_id')
    table.index(['project_id'], 'idx_sessions_project_id')
    table.index(['user_id', 'started_at'], 'idx_sessions_user_started')
    table.index(['user_id', 'payment_type'], 'idx_sessions_user_payment')
    table.index(['user_id', 'deleted_at'], 'idx_sessions_user_deleted')
  })

  // 6. WORK SESSION PAUSES
  await knex.schema.createTable('work_session_pauses', (table) => {
    table.increments('id').primary()
    table.integer('work_session_id').unsigned().notNullable().references('id').inTable('work_sessions').onDelete('CASCADE')
    table.dateTime('paused_at', { precision: 3 }).notNullable()
    table.dateTime('resumed_at', { precision: 3 }).nullable()
    table.integer('pause_duration_seconds').notNullable().defaultTo(0)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['work_session_id'], 'idx_pauses_session')
  })

  // 7. PAYMENTS
  await knex.schema.createTable('payments', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects')
    table.integer('client_id').unsigned().nullable().references('id').inTable('clients').onDelete('SET NULL')
    table.decimal('amount', 19, 4).notNullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.date('paid_date').notNullable()
    table.text('notes').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_payments_user_id')
    table.index(['project_id'], 'idx_payments_project_id')
    table.index(['user_id', 'paid_date'], 'idx_payments_user_date')
    table.index(['user_id', 'deleted_at'], 'idx_payments_user_deleted')
  })

  // 8. PROJECT EXPENSES
  await knex.schema.createTable('project_expenses', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects')
    table.string('description', 255).notNullable()
    table.string('category', 50).notNullable().defaultTo('General')
    table.decimal('amount', 19, 4).notNullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.date('expense_date').notNullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_expenses_user_id')
    table.index(['project_id'], 'idx_expenses_project_id')
    table.index(['user_id', 'expense_date'], 'idx_expenses_user_date')
    table.index(['user_id', 'deleted_at'], 'idx_expenses_user_deleted')
  })

  // 9. OVERHEAD EXPENSES
  await knex.schema.createTable('overhead_expenses', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('description', 255).notNullable()
    table.string('category', 50).notNullable().defaultTo('General')
    table.decimal('amount', 19, 4).notNullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.date('expense_date').notNullable()
    table.boolean('is_recurring').notNullable().defaultTo(false)
    table.enu('recurring_period', ['monthly', 'quarterly', 'annual']).nullable()
    table.text('notes').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_overhead_user_id')
    table.index(['user_id', 'expense_date'], 'idx_overhead_user_date')
    table.index(['user_id', 'deleted_at'], 'idx_overhead_user_deleted')
  })

  // 10. INCOME SOURCES
  await knex.schema.createTable('income_sources', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('name', 150).notNullable()
    table.enu('type', ['retainer', 'consulting', 'royalty', 'product', 'salary', 'other']).notNullable().defaultTo('other')
    table.decimal('amount', 19, 4).notNullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.enu('frequency', ['one_off', 'weekly', 'monthly', 'quarterly', 'annual']).notNullable().defaultTo('monthly')
    table.boolean('is_active').notNullable().defaultTo(true)
    table.text('notes').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_income_sources_user_id')
    table.index(['user_id', 'is_active'], 'idx_income_sources_active')
  })

  // 11. FX RATES
  await knex.schema.createTable('fx_rates', (table) => {
    table.increments('id').primary()
    table.date('rate_date').notNullable()
    table.string('base_currency', 3).notNullable()
    table.string('quote_currency', 3).notNullable()
    table.decimal('rate', 19, 6).notNullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.unique(['rate_date', 'base_currency', 'quote_currency'], 'uq_fx_date_base_quote')
    table.index(['base_currency', 'quote_currency'], 'idx_fx_pair')
  })

  // 12. PROJECT QUOTES (Versioned)
  await knex.schema.createTable('project_quotes', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects')
    table.integer('version').notNullable().defaultTo(1)
    table.decimal('quote_amount', 19, 4).notNullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.decimal('est_hours', 8, 2).nullable()
    table.date('quote_date').notNullable()
    table.date('valid_until').nullable()
    table.enu('status', ['draft', 'sent', 'accepted', 'rejected', 'superseded']).notNullable().defaultTo('draft')
    table.text('notes').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_quotes_user_id')
    table.index(['project_id', 'version'], 'idx_quotes_project_version')
    table.index(['user_id', 'deleted_at'], 'idx_quotes_user_deleted')
  })

  // 13. INVOICES
  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('project_id').unsigned().nullable().references('id').inTable('projects').onDelete('SET NULL')
    table.integer('client_id').unsigned().nullable().references('id').inTable('clients').onDelete('SET NULL')
    table.string('invoice_number', 100).notNullable()
    table.date('invoice_date').notNullable()
    table.date('due_date').notNullable()
    table.string('customer_name', 200).notNullable()
    table.string('customer_email', 255).nullable()
    table.string('customer_contact', 100).nullable()
    table.text('customer_address').nullable()
    table.text('service_description').nullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.string('seller_name', 200).nullable()
    table.text('seller_logo').nullable()
    table.text('seller_address').nullable()
    table.string('seller_email', 255).nullable()
    table.string('seller_phone', 50).nullable()
    table.string('seller_tax_id', 100).nullable()
    table.decimal('subtotal', 19, 4).notNullable().defaultTo(0)
    table.decimal('discount', 19, 4).notNullable().defaultTo(0)
    table.decimal('tax_percent', 5, 2).notNullable().defaultTo(0)
    table.decimal('tax_amount', 19, 4).notNullable().defaultTo(0)
    table.decimal('total', 19, 4).notNullable().defaultTo(0)
    table.text('notes').nullable()
    table.enu('status', ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).notNullable().defaultTo('DRAFT')
    table.dateTime('paid_at', { precision: 3 }).nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('deleted_at', { precision: 3 }).nullable()

    table.unique(['user_id', 'invoice_number'], 'uq_user_invoice_number')
    table.index(['user_id'], 'idx_invoices_user_id')
    table.index(['user_id', 'status'], 'idx_invoices_user_status')
    table.index(['user_id', 'invoice_date'], 'idx_invoices_user_date')
    table.index(['user_id', 'deleted_at'], 'idx_invoices_user_deleted')
  })

  // 14. INVOICE ITEMS
  await knex.schema.createTable('invoice_items', (table) => {
    table.increments('id').primary()
    table.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices').onDelete('CASCADE')
    table.string('description', 255).notNullable()
    table.decimal('quantity', 10, 2).notNullable().defaultTo(1.00)
    table.decimal('unit_price', 19, 4).notNullable().defaultTo(0)
    table.decimal('amount', 19, 4).notNullable().defaultTo(0)
    table.integer('display_order').notNullable().defaultTo(0)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['invoice_id'], 'idx_items_invoice')
  })

  // 15. INVOICE TAXES
  await knex.schema.createTable('invoice_taxes', (table) => {
    table.increments('id').primary()
    table.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices').onDelete('CASCADE')
    table.string('tax_name', 50).notNullable()
    table.decimal('tax_percent', 5, 2).notNullable()
    table.decimal('tax_amount', 19, 4).notNullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['invoice_id'], 'idx_taxes_invoice')
  })

  // 16. INVOICE SEQUENCES
  await knex.schema.createTable('invoice_sequences', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('prefix', 20).notNullable().defaultTo('INV')
    table.integer('year').notNullable()
    table.integer('next_number').notNullable().defaultTo(1)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.unique(['user_id', 'prefix', 'year'], 'uq_user_prefix_year')
  })

  // 17. OTP CODES
  await knex.schema.createTable('otp_codes', (table) => {
    table.increments('id').primary()
    table.string('email', 255).notNullable()
    table.string('code_hash', 255).notNullable()
    table.enu('purpose', ['login', 'register', 'email_change', 'password_reset']).notNullable().defaultTo('login')
    table.string('name', 150).nullable()
    table.integer('attempts').notNullable().defaultTo(0)
    table.integer('max_attempts').notNullable().defaultTo(5)
    table.dateTime('expires_at', { precision: 3 }).notNullable()
    table.dateTime('consumed_at', { precision: 3 }).nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['email', 'purpose'], 'idx_otp_email_purpose')
    table.index(['expires_at'], 'idx_otp_expires_at')
  })

  // 18. AUTH SESSIONS
  await knex.schema.createTable('auth_sessions', (table) => {
    table.increments('id').primary()
    table.string('token_hash', 255).notNullable().unique()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.text('user_agent').nullable()
    table.string('ip_address', 45).nullable()
    table.string('device_info', 150).nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('last_seen_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('expires_at', { precision: 3 }).notNullable()
    table.dateTime('revoked_at', { precision: 3 }).nullable()

    table.index(['user_id'], 'idx_sessions_user_id')
    table.index(['expires_at'], 'idx_sessions_expires_at')
  })

  // 19. ADDONS
  await knex.schema.createTable('addons', (table) => {
    table.increments('id').primary()
    table.string('slug', 100).notNullable().unique()
    table.string('name', 150).notNullable()
    table.text('description').nullable()
    table.string('icon', 50).notNullable().defaultTo('IconPackage')
    table.string('version', 20).notNullable().defaultTo('1.0.0')
    table.string('category', 50).notNullable().defaultTo('Utilities')
    table.json('features').nullable()
    table.boolean('is_free').notNullable().defaultTo(true)
    table.decimal('price_amount', 19, 4).notNullable().defaultTo(0)
    table.string('price_currency', 3).notNullable().defaultTo('USD')
    table.enu('status', ['PUBLISHED', 'DRAFT', 'ARCHIVED']).notNullable().defaultTo('PUBLISHED')
    table.integer('display_order').notNullable().defaultTo(0)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['status'], 'idx_addons_status')
  })

  // 20. USER ADDONS (Entitlements)
  await knex.schema.createTable('user_addons', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('addon_id').unsigned().notNullable().references('id').inTable('addons')
    table.enu('status', ['INSTALLED', 'ACTIVATED', 'DISABLED', 'UNINSTALLED']).notNullable().defaultTo('ACTIVATED')
    table.dateTime('activated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('last_used_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.integer('usage_count').notNullable().defaultTo(0)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.unique(['user_id', 'addon_id'], 'uq_user_addon')
    table.index(['user_id'], 'idx_user_addons_user')
  })

  // 21. PLANS
  await knex.schema.createTable('plans', (table) => {
    table.increments('id').primary()
    table.string('plan_key', 50).notNullable().unique()
    table.string('name', 100).notNullable()
    table.text('description').nullable()
    table.decimal('price_amount', 19, 4).notNullable().defaultTo(0)
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.enu('billing_interval', ['monthly', 'annual', 'lifetime', 'free']).notNullable().defaultTo('monthly')
    table.json('features').nullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['is_active'], 'idx_plans_active')
  })

  // 22. SUBSCRIPTIONS
  await knex.schema.createTable('subscriptions', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('plan_id').unsigned().notNullable().references('id').inTable('plans')
    table.enu('status', ['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'expired']).notNullable().defaultTo('active')
    table.dateTime('current_period_start', { precision: 3 }).notNullable()
    table.dateTime('current_period_end', { precision: 3 }).notNullable()
    table.boolean('cancel_at_period_end').notNullable().defaultTo(false)
    table.dateTime('canceled_at', { precision: 3 }).nullable()
    table.string('payment_method', 50).nullable()
    table.string('external_sub_id', 150).nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['user_id', 'status'], 'idx_sub_user_status')
    table.index(['current_period_end'], 'idx_sub_period_end')
  })

  // 23. BILLING EVENTS
  await knex.schema.createTable('billing_events', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.integer('subscription_id').unsigned().nullable().references('id').inTable('subscriptions').onDelete('SET NULL')
    table.string('event_type', 50).notNullable()
    table.decimal('amount', 19, 4).notNullable()
    table.string('currency', 3).notNullable().defaultTo('USD')
    table.enu('status', ['succeeded', 'failed', 'pending', 'refunded']).notNullable().defaultTo('succeeded')
    table.json('payload').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['user_id'], 'idx_billing_user')
    table.index(['event_type'], 'idx_billing_type')
  })

  // 24. NOTIFICATIONS
  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('type', 50).notNullable()
    table.string('title', 255).notNullable()
    table.text('message').notNullable()
    table.boolean('is_read').notNullable().defaultTo(false)
    table.json('metadata').nullable()
    table.dateTime('read_at', { precision: 3 }).nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['user_id', 'is_read'], 'idx_notif_user_read')
  })

  // 25. NOTIFICATION PREFERENCES
  await knex.schema.createTable('notification_preferences', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.enu('channel', ['email', 'in_app', 'sms']).notNullable().defaultTo('email')
    table.string('topic', 50).notNullable()
    table.boolean('is_enabled').notNullable().defaultTo(true)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.unique(['user_id', 'channel', 'topic'], 'uq_user_channel_topic')
  })

  // 26. CATEGORY REQUESTS
  await knex.schema.createTable('category_requests', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('user_email', 255).notNullable()
    table.string('requested_name', 150).notNullable()
    table.text('description').nullable()
    table.text('reason').nullable()
    table.enu('status', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'MERGED']).notNullable().defaultTo('PENDING')
    table.text('admin_notes').nullable()
    table.string('processed_by', 255).nullable()
    table.dateTime('processed_at', { precision: 3 }).nullable()
    table.integer('request_count').notNullable().defaultTo(1)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['status'], 'idx_cat_requests_status')
    table.index(['user_email'], 'idx_cat_requests_email')
  })

  // 27. ADMIN ROLES
  await knex.schema.createTable('admin_roles', (table) => {
    table.increments('id').primary()
    table.string('role_key', 50).notNullable().unique()
    table.string('name', 100).notNullable()
    table.text('description').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
  })

  // 28. ADMIN PERMISSIONS
  await knex.schema.createTable('admin_permissions', (table) => {
    table.increments('id').primary()
    table.string('permission_key', 100).notNullable().unique()
    table.string('module', 50).notNullable()
    table.string('name', 100).notNullable()
    table.text('description').nullable()
  })

  // 29. ADMIN ROLE PERMISSIONS
  await knex.schema.createTable('admin_role_permissions', (table) => {
    table.string('role_key', 50).notNullable()
    table.string('permission_key', 100).notNullable()
    table.primary(['role_key', 'permission_key'])
  })

  // 30. ADMIN USERS
  await knex.schema.createTable('admin_users', (table) => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('email', 255).notNullable().unique()
    table.string('role_key', 50).notNullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['role_key'], 'idx_admin_users_role')
  })

  // 31. EMAIL TEMPLATES
  await knex.schema.createTable('email_templates', (table) => {
    table.increments('id').primary()
    table.string('template_key', 100).notNullable().unique()
    table.string('name', 150).notNullable()
    table.string('subject', 255).notNullable()
    table.text('body_html').notNullable()
    table.text('body_text').nullable()
    table.json('variables').nullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
  })

  // 32. EMAIL LOGS
  await knex.schema.createTable('email_logs', (table) => {
    table.bigIncrements('id').primary()
    table.string('recipient', 255).notNullable()
    table.string('template_key', 100).nullable()
    table.string('subject', 255).notNullable()
    table.enu('status', ['sent', 'failed', 'pending']).notNullable().defaultTo('sent')
    table.string('provider_msg_id', 150).nullable()
    table.text('error_message').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['recipient'], 'idx_email_recipient')
    table.index(['status'], 'idx_email_status')
    table.index(['created_at'], 'idx_email_created_at')
  })

  // 33. AUDIT LOGS (Append-only)
  await knex.schema.createTable('audit_logs', (table) => {
    table.bigIncrements('id').primary()
    table.string('admin_email', 255).notNullable()
    table.string('action', 100).notNullable()
    table.string('module', 50).notNullable()
    table.string('target', 255).nullable()
    table.text('prev_value').nullable()
    table.text('new_value').nullable()
    table.string('ip_address', 45).nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['admin_email'], 'idx_audit_admin_email')
    table.index(['action'], 'idx_audit_action')
    table.index(['created_at'], 'idx_audit_created_at')
  })

  // 34. ADMIN NOTIFICATIONS
  await knex.schema.createTable('admin_notifications', (table) => {
    table.increments('id').primary()
    table.string('type', 50).notNullable()
    table.string('title', 255).notNullable()
    table.text('message').notNullable()
    table.boolean('is_read').notNullable().defaultTo(false)
    table.json('metadata').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['is_read'], 'idx_admin_notif_read')
  })

  // 35. ANALYTICS EVENTS
  await knex.schema.createTable('analytics_events', (table) => {
    table.bigIncrements('id').primary()
    table.integer('user_id').unsigned().nullable()
    table.string('email', 255).nullable()
    table.string('event_name', 100).notNullable()
    table.string('stage', 50).nullable()
    table.json('metadata').nullable()
    table.string('ip_address', 45).nullable()
    table.text('user_agent').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.index(['event_name'], 'idx_events_name')
    table.index(['stage'], 'idx_events_stage')
    table.index(['created_at'], 'idx_events_created_at')
    table.index(['user_id'], 'idx_events_user_id')
  })

  // 36. ANALYTICS DAILY ROLLUPS
  await knex.schema.createTable('analytics_daily_rollups', (table) => {
    table.bigIncrements('id').primary()
    table.date('rollup_date').notNullable()
    table.string('metric_key', 100).notNullable()
    table.string('dimension_key', 100).notNullable().defaultTo('overall')
    table.string('dimension_value', 150).notNullable().defaultTo('all')
    table.decimal('metric_value', 19, 4).notNullable().defaultTo(0)
    table.integer('unique_users_count').notNullable().defaultTo(0)
    table.integer('events_count').notNullable().defaultTo(0)
    table.json('metadata').nullable()
    table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
    table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

    table.unique(['rollup_date', 'metric_key', 'dimension_key', 'dimension_value'], 'uq_daily_rollup')
    table.index(['rollup_date'], 'idx_rollups_date')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop tables in reverse order of foreign key dependency
  const tables = [
    'analytics_daily_rollups',
    'analytics_events',
    'admin_notifications',
    'audit_logs',
    'email_logs',
    'email_templates',
    'admin_users',
    'admin_role_permissions',
    'admin_permissions',
    'admin_roles',
    'category_requests',
    'notification_preferences',
    'notifications',
    'billing_events',
    'subscriptions',
    'plans',
    'user_addons',
    'addons',
    'auth_sessions',
    'otp_codes',
    'invoice_sequences',
    'invoice_taxes',
    'invoice_items',
    'invoices',
    'project_quotes',
    'fx_rates',
    'income_sources',
    'overhead_expenses',
    'project_expenses',
    'payments',
    'work_session_pauses',
    'work_sessions',
    'projects',
    'clients',
    'categories',
    'users',
  ]

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table)
  }
}
