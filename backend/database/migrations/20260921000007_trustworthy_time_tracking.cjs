// backend/database/migrations/20260921000007_trustworthy_time_tracking.cjs
/**
 * Migration for Trustworthy Time Tracking:
 * - Adds max_timer_hours to users
 * - Adds is_overlapping, is_flagged_forgotten, last_activity_at, raw_duration_seconds to work_sessions
 * - Creates work_session_edits audit log table
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Add max_timer_hours to users
  const hasMaxTimer = await knex.schema.hasColumn('users', 'max_timer_hours')
  if (!hasMaxTimer) {
    await knex.schema.alterTable('users', (table) => {
      table.integer('max_timer_hours').notNullable().defaultTo(8)
    })
  }

  // 2. Add trustworthy tracking fields to work_sessions
  const hasOverlapping = await knex.schema.hasColumn('work_sessions', 'is_overlapping')
  if (!hasOverlapping) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.boolean('is_overlapping').notNullable().defaultTo(false)
    })
  }

  const hasForgotten = await knex.schema.hasColumn('work_sessions', 'is_flagged_forgotten')
  if (!hasForgotten) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.boolean('is_flagged_forgotten').notNullable().defaultTo(false)
    })
  }

  const hasLastActivity = await knex.schema.hasColumn('work_sessions', 'last_activity_at')
  if (!hasLastActivity) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.dateTime('last_activity_at', { precision: 3 }).nullable().defaultTo(null)
    })
  }

  const hasRawDuration = await knex.schema.hasColumn('work_sessions', 'raw_duration_seconds')
  if (!hasRawDuration) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.integer('raw_duration_seconds').nullable().defaultTo(null)
    })
  }

  // 3. Create work_session_edits audit log table
  const hasEditsTable = await knex.schema.hasTable('work_session_edits')
  if (!hasEditsTable) {
    await knex.schema.createTable('work_session_edits', (table) => {
      table.increments('id').primary()
      table.integer('work_session_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('editor_user_id').unsigned().notNullable()
      table.string('change_summary', 255).notNullable()
      table.json('old_values').notNullable()
      table.json('new_values').notNullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.foreign('work_session_id').references('id').inTable('work_sessions').onDelete('CASCADE')
      table.foreign('user_id').references('id').inTable('users')
      table.foreign('editor_user_id').references('id').inTable('users')

      table.index(['work_session_id', 'created_at'], 'idx_session_edits_session_time')
      table.index(['user_id'], 'idx_session_edits_user_id')
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  if (await knex.schema.hasTable('work_session_edits')) {
    await knex.schema.dropTable('work_session_edits')
  }

  if (await knex.schema.hasColumn('work_sessions', 'raw_duration_seconds')) {
    await knex.schema.alterTable('work_sessions', (table) => {
      table.dropColumn('raw_duration_seconds')
      table.dropColumn('last_activity_at')
      table.dropColumn('is_flagged_forgotten')
      table.dropColumn('is_overlapping')
    })
  }

  if (await knex.schema.hasColumn('users', 'max_timer_hours')) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('max_timer_hours')
    })
  }
}
