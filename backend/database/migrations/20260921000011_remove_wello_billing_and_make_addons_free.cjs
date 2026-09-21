// backend/database/migrations/20260921000011_remove_wello_billing_and_make_addons_free.cjs
/**
 * Migration: Remove Wello Platform Billing, Subscriptions, Plans and Make All Addons 100% Free
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Drop billing and subscription tables in safe dependency order
  const hasBillingEvents = await knex.schema.hasTable('billing_events')
  if (hasBillingEvents) {
    await knex.schema.dropTableIfExists('billing_events')
  }

  const hasSubscriptions = await knex.schema.hasTable('subscriptions')
  if (hasSubscriptions) {
    await knex.schema.dropTableIfExists('subscriptions')
  }

  const hasPlans = await knex.schema.hasTable('plans')
  if (hasPlans) {
    await knex.schema.dropTableIfExists('plans')
  }

  // 2. Remove price columns from addons table while keeping addons and user_addons intact
  const hasAddons = await knex.schema.hasTable('addons')
  if (hasAddons) {
    const hasPriceAmount = await knex.schema.hasColumn('addons', 'price_amount')
    const hasPriceCurrency = await knex.schema.hasColumn('addons', 'price_currency')

    if (hasPriceAmount || hasPriceCurrency) {
      await knex.schema.alterTable('addons', (table) => {
        if (hasPriceAmount) table.dropColumn('price_amount')
        if (hasPriceCurrency) table.dropColumn('price_currency')
      })
    }

    const hasIsFree = await knex.schema.hasColumn('addons', 'is_free')
    if (hasIsFree) {
      await knex('addons').update({ is_free: true })
    }
  }

  // 3. Clean up any notification preferences for 'subscription_event'
  const hasNotifPrefs = await knex.schema.hasTable('notification_preferences')
  if (hasNotifPrefs) {
    await knex('notification_preferences').where({ topic: 'subscription_event' }).del()
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // 1. Recreate plans table
  const hasPlans = await knex.schema.hasTable('plans')
  if (!hasPlans) {
    await knex.schema.createTable('plans', (table) => {
      table.increments('id').primary()
      table.string('plan_key', 50).notNullable().unique()
      table.string('name', 100).notNullable()
      table.text('description').nullable()
      table.decimal('price_amount', 19, 4).notNullable().defaultTo(0)
      table.string('currency', 3).notNullable().defaultTo('USD')
      table.enu('billing_interval', ['monthly', 'annual', 'lifetime', 'free']).notNullable().defaultTo('monthly')
      table.json('features').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['is_active'], 'idx_plans_active')
    })
  }

  // 2. Recreate subscriptions table
  const hasSubscriptions = await knex.schema.hasTable('subscriptions')
  if (!hasSubscriptions) {
    await knex.schema.createTable('subscriptions', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('plan_id').unsigned().notNullable().references('id').inTable('plans')
      table.enu('status', ['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'expired']).notNullable().defaultTo('active')
      table.dateTime('current_period_start', { precision: 3 }).notNullable()
      table.dateTime('current_period_end', { precision: 3 }).notNullable()
      table.boolean('cancel_at_period_end').notNullable().defaultTo(false)
      table.dateTime('canceled_at', { precision: 3 }).nullable()
      table.string('payment_method', 50).nullable()
      table.string('external_sub_id', 150).nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))
      table.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['user_id', 'status'], 'idx_sub_user_status')
      table.index(['current_period_end'], 'idx_sub_period_end')
    })
  }

  // 3. Recreate billing_events table
  const hasBillingEvents = await knex.schema.hasTable('billing_events')
  if (!hasBillingEvents) {
    await knex.schema.createTable('billing_events', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('subscription_id').unsigned().nullable().references('id').inTable('subscriptions').onDelete('SET NULL')
      table.string('event_type', 50).notNullable()
      table.decimal('amount', 19, 4).notNullable()
      table.string('currency', 3).notNullable().defaultTo('USD')
      table.enu('status', ['succeeded', 'failed', 'pending', 'refunded']).notNullable().defaultTo('succeeded')
      table.json('payload').nullable()
      table.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3))

      table.index(['user_id'], 'idx_billing_user')
      table.index(['event_type'], 'idx_billing_type')
    })
  }

  // 4. Restore price columns to addons table if missing
  const hasAddons = await knex.schema.hasTable('addons')
  if (hasAddons) {
    const hasPriceAmount = await knex.schema.hasColumn('addons', 'price_amount')
    if (!hasPriceAmount) {
      await knex.schema.alterTable('addons', (table) => {
        table.decimal('price_amount', 19, 4).notNullable().defaultTo(0)
        table.string('price_currency', 3).notNullable().defaultTo('USD')
      })
    }
  }
}
