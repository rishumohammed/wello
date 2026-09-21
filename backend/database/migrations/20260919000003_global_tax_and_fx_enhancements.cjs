// backend/database/migrations/20260919000003_global_tax_and_fx_enhancements.cjs
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Create TAX_RATES table for generic user-defined taxes
  const hasTaxRates = await knex.schema.hasTable('tax_rates')
  if (!hasTaxRates) {
    await knex.schema.createTable('tax_rates', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.decimal('percentage', 5, 2).notNullable().defaultTo(0)
      table.boolean('is_inclusive').notNullable().defaultTo(false)
      table.boolean('is_compound').notNullable().defaultTo(false)
      table.boolean('is_default').notNullable().defaultTo(false)
      table.boolean('is_reverse_charge').notNullable().defaultTo(false)
      table.boolean('is_zero_rated').notNullable().defaultTo(false)
      table.text('description').nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('deleted_at', { precision: 3 }).nullable()

      table.index(['user_id'], 'idx_tax_rates_user_id')
      table.index(['user_id', 'is_default'], 'idx_tax_rates_default')
    })
  }

  // 2. Add tax_id_label and generic address columns to USERS if not existing
  const hasTaxIdLabel = await knex.schema.hasColumn('users', 'tax_id_label')
  if (!hasTaxIdLabel) {
    await knex.schema.alterTable('users', (table) => {
      table.string('tax_id_label', 50).notNullable().defaultTo('Tax ID')
    })
  }

  const hasAddress1 = await knex.schema.hasColumn('users', 'address_line1')
  if (!hasAddress1) {
    await knex.schema.alterTable('users', (table) => {
      table.string('address_line1', 255).nullable()
    })
  }

  const hasAddress2 = await knex.schema.hasColumn('users', 'address_line2')
  if (!hasAddress2) {
    await knex.schema.alterTable('users', (table) => {
      table.string('address_line2', 255).nullable()
    })
  }

  const hasPostal = await knex.schema.hasColumn('users', 'postal_code')
  if (!hasPostal) {
    await knex.schema.alterTable('users', (table) => {
      table.string('postal_code', 30).nullable()
    })
  }

  const hasStateProvince = await knex.schema.hasColumn('users', 'state_province')
  if (!hasStateProvince) {
    await knex.schema.alterTable('users', (table) => {
      table.string('state_province', 100).nullable()
    })
  }

  // 3. Add FX rate & Base Currency Amount to PAYMENTS
  const hasPaymentFx = await knex.schema.hasColumn('payments', 'fx_rate')
  if (!hasPaymentFx) {
    await knex.schema.alterTable('payments', (table) => {
      table.decimal('fx_rate', 19, 6).nullable()
      table.decimal('base_amount', 19, 4).nullable()
    })
  }

  // 4. Add FX rate & Base Currency Amount to PROJECT_EXPENSES
  const hasExpenseFx = await knex.schema.hasColumn('project_expenses', 'fx_rate')
  if (!hasExpenseFx) {
    await knex.schema.alterTable('project_expenses', (table) => {
      table.decimal('fx_rate', 19, 6).nullable()
      table.decimal('base_amount', 19, 4).nullable()
    })
  }

  // 5. Add FX rate, Base Currency Amount, Tax Rate FK, Reverse Charge & Zero Rated flags to INVOICES
  const hasInvoiceFx = await knex.schema.hasColumn('invoices', 'fx_rate')
  if (!hasInvoiceFx) {
    await knex.schema.alterTable('invoices', (table) => {
      table.decimal('fx_rate', 19, 6).nullable()
      table.decimal('base_total', 19, 4).nullable()
      table.integer('tax_rate_id').unsigned().nullable().references('id').inTable('tax_rates').onDelete('SET NULL')
      table.boolean('is_reverse_charge').notNullable().defaultTo(false)
      table.boolean('is_zero_rated').notNullable().defaultTo(false)
      table.string('tax_id_label', 50).nullable()
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasInvoiceFx = await knex.schema.hasColumn('invoices', 'fx_rate')
  if (hasInvoiceFx) {
    await knex.schema.alterTable('invoices', (table) => {
      table.dropForeign(['tax_rate_id'])
      table.dropColumn('tax_rate_id')
      table.dropColumn('fx_rate')
      table.dropColumn('base_total')
      table.dropColumn('is_reverse_charge')
      table.dropColumn('is_zero_rated')
      table.dropColumn('tax_id_label')
    })
  }

  const hasExpenseFx = await knex.schema.hasColumn('project_expenses', 'fx_rate')
  if (hasExpenseFx) {
    await knex.schema.alterTable('project_expenses', (table) => {
      table.dropColumn('fx_rate')
      table.dropColumn('base_amount')
    })
  }

  const hasPaymentFx = await knex.schema.hasColumn('payments', 'fx_rate')
  if (hasPaymentFx) {
    await knex.schema.alterTable('payments', (table) => {
      table.dropColumn('fx_rate')
      table.dropColumn('base_amount')
    })
  }

  const hasTaxIdLabel = await knex.schema.hasColumn('users', 'tax_id_label')
  if (hasTaxIdLabel) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('tax_id_label')
    })
  }

  const hasAddress1 = await knex.schema.hasColumn('users', 'address_line1')
  if (hasAddress1) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('address_line1')
    })
  }

  const hasAddress2 = await knex.schema.hasColumn('users', 'address_line2')
  if (hasAddress2) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('address_line2')
    })
  }

  const hasPostal = await knex.schema.hasColumn('users', 'postal_code')
  if (hasPostal) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('postal_code')
    })
  }

  const hasStateProvince = await knex.schema.hasColumn('users', 'state_province')
  if (hasStateProvince) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('state_province')
    })
  }

  await knex.schema.dropTableIfExists('tax_rates')
}
