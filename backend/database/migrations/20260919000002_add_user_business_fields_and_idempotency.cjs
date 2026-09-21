// backend/database/migrations/20260919000002_add_user_business_fields_and_idempotency.cjs
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Add extra profile / invoice identity fields to users table if not existing
  const hasBusinessPhone = await knex.schema.hasColumn('users', 'business_phone')
  if (!hasBusinessPhone) {
    await knex.schema.alterTable('users', (table) => {
      table.string('business_phone', 50).nullable()
      table.string('business_email', 255).nullable()
      table.text('business_logo').nullable()
      table.text('default_invoice_notes').nullable()
    })
  }

  // 2. Add IDEMPOTENCY KEYS table for offline retries and network idempotency
  const hasIdempotency = await knex.schema.hasTable('idempotency_keys')
  if (!hasIdempotency) {
    await knex.schema.createTable('idempotency_keys', (table) => {
      table.increments('id').primary()
      table.string('key', 255).notNullable()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('request_path', 255).notNullable()
      table.string('request_method', 10).notNullable().defaultTo('POST')
      table.integer('response_status').notNullable().defaultTo(200)
      table.text('response_body').notNullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('expires_at', { precision: 3 }).notNullable()

      table.unique(['user_id', 'key'], 'uq_user_idempotency_key')
      table.index(['expires_at'], 'idx_idempotency_expires')
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('idempotency_keys')
  const hasBusinessPhone = await knex.schema.hasColumn('users', 'business_phone')
  if (hasBusinessPhone) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('business_phone')
      table.dropColumn('business_email')
      table.dropColumn('business_logo')
      table.dropColumn('default_invoice_notes')
    })
  }
}
