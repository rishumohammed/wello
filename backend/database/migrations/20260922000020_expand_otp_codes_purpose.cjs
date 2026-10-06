// backend/database/migrations/20260922000020_expand_otp_codes_purpose.cjs
/**
 * Migration 20: Expand otp_codes.purpose from restrictive ENUM to VARCHAR(100)
 * Allows step-up authentication purposes (e.g., admin_roles, admin_user_status, admin_addon_kill_switch, etc.)
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('otp_codes', (table) => {
    table.string('purpose', 100).notNullable().defaultTo('login').alter()
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('otp_codes', (table) => {
    table.enu('purpose', ['login', 'register', 'email_change', 'password_reset']).notNullable().defaultTo('login').alter()
  })
}
