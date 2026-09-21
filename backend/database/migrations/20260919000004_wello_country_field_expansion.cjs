// backend/database/migrations/20260919000004_wello_country_field_expansion.cjs
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users')
  if (hasUsers) {
    await knex.schema.alterTable('users', (table) => {
      table.string('country', 100).nullable().alter()
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users')
  if (hasUsers) {
    await knex.schema.alterTable('users', (table) => {
      table.string('country', 2).nullable().alter()
    })
  }
}
