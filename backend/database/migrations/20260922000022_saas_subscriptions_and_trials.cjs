/**
 * Migration: 20260922000022_saas_subscriptions_and_trials.cjs
 * Creates:
 * 1. Enhances `users` table with SaaS fields: `trial_ends_at`, `subscription_status`, `is_comped`, `comped_at`.
 * 2. `user_subscriptions` table for Razorpay monthly subscriptions.
 * 3. `subscription_invoices` table for storing payment receipts and billing history.
 */

exports.up = async function (knex) {
  // 1. ADD SAAS COLUMNS TO USERS TABLE IF NOT EXISTS
  const hasTrialEndsAt = await knex.schema.hasColumn('users', 'trial_ends_at')
  if (!hasTrialEndsAt) {
    await knex.schema.alterTable('users', (table) => {
      table.dateTime('trial_ends_at', { precision: 3 }).nullable()
      table.string('subscription_status', 30).notNullable().defaultTo('trialing') // 'trialing', 'active', 'past_due', 'cancelled', 'expired'
      table.boolean('is_comped').notNullable().defaultTo(false)
      table.dateTime('comped_at', { precision: 3 }).nullable()

      table.index(['subscription_status'], 'idx_users_subscription_status')
      table.index(['trial_ends_at'], 'idx_users_trial_ends_at')
    })

    // Backfill existing users with a 90-day trial from their creation date
    await knex.raw(`
      UPDATE users 
      SET trial_ends_at = DATE_ADD(created_at, INTERVAL 90 DAY),
          subscription_status = CASE 
            WHEN DATE_ADD(created_at, INTERVAL 90 DAY) > NOW() THEN 'trialing'
            ELSE 'expired'
          END
      WHERE trial_ends_at IS NULL
    `)
  }

  // 2. USER SUBSCRIPTIONS TABLE
  const hasSubscriptionsTable = await knex.schema.hasTable('user_subscriptions')
  if (!hasSubscriptionsTable) {
    await knex.schema.createTable('user_subscriptions', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE')
      table.string('razorpay_customer_id', 128).nullable().index()
      table.string('razorpay_subscription_id', 128).notNullable().unique().index()
      table.string('razorpay_plan_id', 128).notNullable()
      table.string('status', 30).notNullable().defaultTo('created') // 'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'paused'
      table.decimal('amount', 12, 2).notNullable().defaultTo(1.21)
      table.string('currency', 10).notNullable().defaultTo('USD')
      table.dateTime('current_period_start', { precision: 3 }).nullable()
      table.dateTime('current_period_end', { precision: 3 }).nullable()
      table.boolean('cancel_at_period_end').notNullable().defaultTo(false)
      table.dateTime('cancelled_at', { precision: 3 }).nullable()
      table.text('notes').nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['status'], 'idx_user_subscriptions_status')
    })
  }

  // 3. SUBSCRIPTION INVOICES / RECEIPTS TABLE
  const hasSubscriptionInvoicesTable = await knex.schema.hasTable('subscription_invoices')
  if (!hasSubscriptionInvoicesTable) {
    await knex.schema.createTable('subscription_invoices', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('subscription_id').unsigned().nullable().references('id').inTable('user_subscriptions').onDelete('SET NULL')
      table.string('razorpay_invoice_id', 128).nullable().index()
      table.string('razorpay_payment_id', 128).nullable().index()
      table.decimal('amount', 12, 2).notNullable()
      table.string('currency', 10).notNullable().defaultTo('INR')
      table.string('status', 30).notNullable().defaultTo('paid') // 'paid', 'issued', 'failed'
      table.string('receipt_url', 512).nullable()
      table.dateTime('paid_at', { precision: 3 }).nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['user_id', 'created_at'], 'idx_sub_invoices_user_created')
    })
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('subscription_invoices')
  await knex.schema.dropTableIfExists('user_subscriptions')
  const hasTrialEndsAt = await knex.schema.hasColumn('users', 'trial_ends_at')
  if (hasTrialEndsAt) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('trial_ends_at')
      table.dropColumn('subscription_status')
      table.dropColumn('is_comped')
      table.dropColumn('comped_at')
    })
  }
}
