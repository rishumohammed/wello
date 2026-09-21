// backend/database/migrations/20260921000008_income_sources_and_overhead.cjs
/**
 * Migration for Universal Income Sources, Quick Entry, Overhead Costs & Persona Support:
 * - Creates/expands income_sources table (type, pay_frequency, expected_amount, expected_hours)
 * - Makes project_id nullable on work_sessions and payments; adds income_source_id FK
 * - Creates/expands overhead_expenses table (category, allocation_rule, income_source_id)
 * - Adds earning_persona and include_overhead_in_metrics to users table
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Income Sources Table
  const hasIncomeSources = await knex.schema.hasTable('income_sources')
  if (!hasIncomeSources) {
    await knex.schema.createTable('income_sources', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()
      table.integer('client_id').unsigned().nullable()
      table.integer('project_id').unsigned().nullable()
      table.string('name', 200).notNullable()
      table.string('type', 50).notNullable().defaultTo('other') // project, salary, hourly_wage, daily_wage, retainer, gig, other
      table.string('currency', 3).notNullable().defaultTo('USD')
      table.string('pay_frequency', 50).notNullable().defaultTo('monthly') // hourly, daily, weekly, biweekly, monthly, quarterly, annual, per_job, one_off
      table.decimal('expected_amount', 19, 4).nullable().defaultTo(null)
      table.decimal('expected_hours_per_period', 8, 2).nullable().defaultTo(null)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.text('notes').nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('deleted_at', { precision: 3 }).nullable().defaultTo(null)

      table.foreign('user_id').references('id').inTable('users')
      table.foreign('client_id').references('id').inTable('clients').onDelete('SET NULL')
      table.foreign('project_id').references('id').inTable('projects').onDelete('SET NULL')

      table.index(['user_id'], 'idx_income_sources_user_id')
      table.index(['user_id', 'is_active'], 'idx_income_sources_active')
      table.index(['user_id', 'deleted_at'], 'idx_income_sources_deleted')
    })
  } else {
    // Add missing columns if table already existed
    const hasClientId = await knex.schema.hasColumn('income_sources', 'client_id')
    const hasProjectId = await knex.schema.hasColumn('income_sources', 'project_id')
    const hasPayFreq = await knex.schema.hasColumn('income_sources', 'pay_frequency')
    const hasExpectedAmt = await knex.schema.hasColumn('income_sources', 'expected_amount')
    const hasExpectedHrs = await knex.schema.hasColumn('income_sources', 'expected_hours_per_period')

    await knex.schema.alterTable('income_sources', (table) => {
      if (!hasClientId) table.integer('client_id').unsigned().nullable().references('id').inTable('clients').onDelete('SET NULL')
      if (!hasProjectId) table.integer('project_id').unsigned().nullable().references('id').inTable('projects').onDelete('SET NULL')
      if (!hasPayFreq) table.string('pay_frequency', 50).notNullable().defaultTo('monthly')
      if (!hasExpectedAmt) table.decimal('expected_amount', 19, 4).nullable().defaultTo(null)
      if (!hasExpectedHrs) table.decimal('expected_hours_per_period', 8, 2).nullable().defaultTo(null)
    })
  }

  // 2. Work Sessions: make project_id nullable and add income_source_id
  try {
    await knex.raw('ALTER TABLE work_sessions DROP FOREIGN KEY work_sessions_project_id_foreign')
  } catch (_) {}
  await knex.raw('ALTER TABLE work_sessions MODIFY project_id INT NULL')
  try {
    await knex.raw('ALTER TABLE work_sessions ADD CONSTRAINT work_sessions_project_id_foreign FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL')
  } catch (_) {}
  
  const hasSessionIncomeSource = await knex.schema.hasColumn('work_sessions', 'income_source_id')
  if (!hasSessionIncomeSource) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.integer('income_source_id').unsigned().nullable()
      table.foreign('income_source_id').references('id').inTable('income_sources').onDelete('SET NULL')
      table.index(['user_id', 'income_source_id'], 'idx_sessions_income_source')
    })
  }

  // 3. Payments: make project_id nullable, add income_source_id, is_expected, and status
  try {
    await knex.raw('ALTER TABLE payments DROP FOREIGN KEY payments_project_id_foreign')
  } catch (_) {}
  await knex.raw('ALTER TABLE payments MODIFY project_id INT NULL')
  try {
    await knex.raw('ALTER TABLE payments ADD CONSTRAINT payments_project_id_foreign FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL')
  } catch (_) {}

  const hasPaymentIncomeSource = await knex.schema.hasColumn('payments', 'income_source_id')
  const hasIsExpected = await knex.schema.hasColumn('payments', 'is_expected')
  const hasStatus = await knex.schema.hasColumn('payments', 'status')

  await knex.schema.alterTable('payments', (table) => {
    if (!hasPaymentIncomeSource) {
      table.integer('income_source_id').unsigned().nullable()
      table.foreign('income_source_id').references('id').inTable('income_sources').onDelete('SET NULL')
      table.index(['user_id', 'income_source_id'], 'idx_payments_income_source')
    }
    if (!hasIsExpected) {
      table.boolean('is_expected').notNullable().defaultTo(false)
    }
    if (!hasStatus) {
      table.string('status', 50).notNullable().defaultTo('paid')
    }
  })

  // 4. Overhead Expenses Table
  const hasOverhead = await knex.schema.hasTable('overhead_expenses')
  if (!hasOverhead) {
    await knex.schema.createTable('overhead_expenses', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()
      table.integer('income_source_id').unsigned().nullable()
      table.string('description', 255).notNullable()
      table.string('category', 50).notNullable().defaultTo('general') // commute, tools, equipment, phone_internet, uniforms, licences, general, other
      table.decimal('amount', 19, 4).notNullable()
      table.string('currency', 3).notNullable().defaultTo('USD')
      table.date('expense_date').notNullable()
      table.string('allocation_rule', 50).notNullable().defaultTo('none') // none, per_hour_worked, per_period, per_source
      table.boolean('is_recurring').notNullable().defaultTo(false)
      table.string('recurring_period', 50).nullable().defaultTo(null)
      table.text('notes').nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('deleted_at', { precision: 3 }).nullable().defaultTo(null)

      table.foreign('user_id').references('id').inTable('users')
      table.foreign('income_source_id').references('id').inTable('income_sources').onDelete('SET NULL')

      table.index(['user_id'], 'idx_overhead_user_id')
      table.index(['user_id', 'expense_date'], 'idx_overhead_user_date')
      table.index(['user_id', 'deleted_at'], 'idx_overhead_user_deleted')
    })
  } else {
    const hasSourceFk = await knex.schema.hasColumn('overhead_expenses', 'income_source_id')
    const hasAllocRule = await knex.schema.hasColumn('overhead_expenses', 'allocation_rule')
    await knex.schema.alterTable('overhead_expenses', (table) => {
      if (!hasSourceFk) table.integer('income_source_id').unsigned().nullable().references('id').inTable('income_sources').onDelete('SET NULL')
      if (!hasAllocRule) table.string('allocation_rule', 50).notNullable().defaultTo('none')
    })
  }

  // 5. Users: add earning_persona and include_overhead_in_metrics
  const hasPersona = await knex.schema.hasColumn('users', 'earning_persona')
  const hasIncludeOverhead = await knex.schema.hasColumn('users', 'include_overhead_in_metrics')

  await knex.schema.alterTable('users', (table) => {
    if (!hasPersona) {
      table.string('earning_persona', 50).notNullable().defaultTo('freelancer_projects') // freelancer_projects, salaried, daily_hourly_wage, gig_retainer, mixed_hybrid
    }
    if (!hasIncludeOverhead) {
      table.boolean('include_overhead_in_metrics').notNullable().defaultTo(false)
    }
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  if (await knex.schema.hasColumn('users', 'include_overhead_in_metrics')) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('include_overhead_in_metrics')
      table.dropColumn('earning_persona')
    })
  }

  if (await knex.schema.hasColumn('payments', 'income_source_id')) {
    await knex.schema.alterTable('payments', (table) => {
      table.dropColumn('status')
      table.dropColumn('is_expected')
      table.dropColumn('income_source_id')
    })
  }

  if (await knex.schema.hasColumn('work_sessions', 'income_source_id')) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.dropColumn('income_source_id')
    })
  }
}
