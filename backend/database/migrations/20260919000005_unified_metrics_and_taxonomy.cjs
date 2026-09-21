// backend/database/migrations/20260919000005_unified_metrics_and_taxonomy.cjs
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Add headline_rate_metric to users table (default 'client_work')
  const hasHeadlineRate = await knex.schema.hasColumn('users', 'headline_rate_metric')
  if (!hasHeadlineRate) {
    await knex.schema.alterTable('users', (table) => {
      table.enum('headline_rate_metric', ['client_work', 'all_in']).notNullable().defaultTo('client_work')
    })
  }

  // 2. Add unpaid_category to work_sessions table
  const hasUnpaidCategory = await knex.schema.hasColumn('work_sessions', 'unpaid_category')
  if (!hasUnpaidCategory) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.enum('unpaid_category', ['unpaid_client', 'intentional_unpaid']).nullable().defaultTo(null)
    })
  }

  // 3. Normalize existing unpaid_reason entries to standard taxonomy
  await knex.raw(`
    UPDATE work_sessions 
    SET unpaid_category = CASE 
      WHEN unpaid_reason IN ('learning', 'portfolio', 'charity', 'strategic', 'personal', 'upskilling', 'open_source') THEN 'intentional_unpaid'
      WHEN unpaid_reason IS NOT NULL AND unpaid_reason != '' THEN 'unpaid_client'
      ELSE NULL
    END
    WHERE payment_type = 'unpaid' OR payment_type = 'partial'
  `)
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasHeadlineRate = await knex.schema.hasColumn('users', 'headline_rate_metric')
  if (hasHeadlineRate) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('headline_rate_metric')
    })
  }

  const hasUnpaidCategory = await knex.schema.hasColumn('work_sessions', 'unpaid_category')
  if (hasUnpaidCategory) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.dropColumn('unpaid_category')
    })
  }
}
