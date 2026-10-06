// backend/database/migrations/20260921000018_security_privacy_hardening.cjs
/**
 * Migration 18: Security and Privacy Hardening
 * - Creates impersonation_sessions table
 * - Creates payment_claims table for public invoice payment workflow
 * - Adds hashed token support to invoices and project_quotes
 * - Adds append-only triggers on audit_logs
 */

exports.up = async function (knex) {
  // 1. Create impersonation_sessions table
  const hasImpersonationTable = await knex.schema.hasTable('impersonation_sessions')
  if (!hasImpersonationTable) {
    await knex.schema.createTable('impersonation_sessions', (table) => {
      table.increments('id').primary()
      table.integer('admin_id').unsigned().notNullable()
      table.string('admin_email', 255).notNullable()
      table.integer('target_user_id').unsigned().notNullable()
      table.text('reason').notNullable()
      table.boolean('has_financial_view').defaultTo(false)
      table.string('token_hash', 64).notNullable().unique()
      table.datetime('started_at').notNullable()
      table.datetime('expires_at').notNullable()
      table.datetime('ended_at').nullable()
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now())

      table.foreign('admin_id').references('users.id').onDelete('CASCADE')
      table.foreign('target_user_id').references('users.id').onDelete('CASCADE')
      table.index(['target_user_id', 'expires_at'], 'idx_imp_target_expires')
      table.index(['token_hash'], 'idx_imp_token_hash')
    })
  }

  // 2. Create payment_claims table
  const hasPaymentClaimsTable = await knex.schema.hasTable('payment_claims')
  if (!hasPaymentClaimsTable) {
    await knex.schema.createTable('payment_claims', (table) => {
      table.increments('id').primary()
      table.integer('invoice_id').unsigned().notNullable()
      table.decimal('amount', 12, 2).notNullable()
      table.string('currency', 10).notNullable().defaultTo('USD')
      table.string('payment_method', 50).notNullable().defaultTo('OTHER')
      table.string('transaction_ref', 255).nullable()
      table.string('payer_email', 255).nullable()
      table.string('payer_name', 255).nullable()
      table.text('notes').nullable()
      table.enum('status', ['PENDING', 'CONFIRMED', 'REJECTED']).notNullable().defaultTo('PENDING')
      table.datetime('confirmed_at').nullable()
      table.datetime('rejected_at').nullable()
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now())
      table.datetime('updated_at').notNullable().defaultTo(knex.fn.now())

      table.foreign('invoice_id').references('invoices.id').onDelete('CASCADE')
      table.index(['invoice_id', 'status'], 'idx_claims_invoice_status')
    })
  }

  // 3. Add hashed tokens and expiration to invoices & project_quotes
  const hasInvoicesTokenHash = await knex.schema.hasColumn('invoices', 'public_token_hash')
  if (!hasInvoicesTokenHash) {
    await knex.schema.table('invoices', (table) => {
      table.string('public_token_hash', 64).nullable().index('idx_invoices_token_hash')
      table.datetime('public_token_expires_at').nullable()
      table.datetime('public_token_revoked_at').nullable()
    })
  }

  const hasQuotesTokenHash = await knex.schema.hasColumn('project_quotes', 'public_token_hash')
  if (!hasQuotesTokenHash) {
    await knex.schema.table('project_quotes', (table) => {
      table.string('public_token_hash', 64).nullable().index('idx_quotes_token_hash')
      table.datetime('public_token_expires_at').nullable()
      table.datetime('public_token_revoked_at').nullable()
    })
  }

  // Backfill existing tokens to SHA-256 hashes
  await knex.raw(`
    UPDATE invoices 
    SET public_token_hash = SHA2(public_token, 256),
        public_token_expires_at = DATE_ADD(created_at, INTERVAL 180 DAY)
    WHERE public_token IS NOT NULL AND public_token_hash IS NULL
  `)

  await knex.raw(`
    UPDATE project_quotes 
    SET public_token_hash = SHA2(public_token, 256),
        public_token_expires_at = DATE_ADD(created_at, INTERVAL 180 DAY)
    WHERE public_token IS NOT NULL AND public_token_hash IS NULL
  `)

  // 4. Create append-only defence-in-depth triggers on audit_logs
  try {
    await knex.raw('DROP TRIGGER IF EXISTS before_audit_logs_update')
    await knex.raw(`
      CREATE TRIGGER before_audit_logs_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Security Violation: audit_logs is append-only. UPDATE operations are prohibited.';
      END
    `)
  } catch (err) {
    console.warn('Note: Trigger creation may require SUPER privilege on MySQL; proceeding.')
  }

  try {
    await knex.raw('DROP TRIGGER IF EXISTS before_audit_logs_delete')
    await knex.raw(`
      CREATE TRIGGER before_audit_logs_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Security Violation: audit_logs is append-only. DELETE operations are prohibited.';
      END
    `)
  } catch (err) {
    console.warn('Note: Trigger creation may require SUPER privilege on MySQL; proceeding.')
  }
}

exports.down = async function (knex) {
  try {
    await knex.raw('DROP TRIGGER IF EXISTS before_audit_logs_update')
    await knex.raw('DROP TRIGGER IF EXISTS before_audit_logs_delete')
  } catch (_) {}

  await knex.schema.dropTableIfExists('payment_claims')
  await knex.schema.dropTableIfExists('impersonation_sessions')

  if (await knex.schema.hasColumn('invoices', 'public_token_hash')) {
    await knex.schema.table('invoices', (table) => {
      table.dropColumn('public_token_hash')
      table.dropColumn('public_token_expires_at')
      table.dropColumn('public_token_revoked_at')
    })
  }

  if (await knex.schema.hasColumn('project_quotes', 'public_token_hash')) {
    await knex.schema.table('project_quotes', (table) => {
      table.dropColumn('public_token_hash')
      table.dropColumn('public_token_expires_at')
      table.dropColumn('public_token_revoked_at')
    })
  }
}
