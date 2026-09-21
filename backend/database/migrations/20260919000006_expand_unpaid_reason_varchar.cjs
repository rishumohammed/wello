// backend/database/migrations/20260919000006_expand_unpaid_reason_varchar.cjs
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Alter work_sessions.unpaid_reason from ENUM to VARCHAR(100)
  try {
    await knex.raw('ALTER TABLE `work_sessions` MODIFY COLUMN `unpaid_reason` VARCHAR(100) NULL')
  } catch (err) {
    console.warn('Could not modify column with raw MySQL alter:', err.message)
    // Fallback for knex alterTable
    await knex.schema.alterTable('work_sessions', (table) => {
      table.string('unpaid_reason', 100).nullable().alter()
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // No-op or revert
}
