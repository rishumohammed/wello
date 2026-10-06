/**
 * Migration: 20260922000021_fx_pegs_and_request_metrics.cjs
 * Creates:
 * 1. `fixed_peg_rates`: Official central bank fixed currency pegs (AED, SAR, QAR, BHD, OMR, JOD, etc.)
 * 2. `request_metrics_minute`: Persistent cluster-wide per-minute request telemetry (p50, p95, error rates)
 */

exports.up = async function (knex) {
  // 1. FIXED PEG RATES TABLE
  const hasPegsTable = await knex.schema.hasTable('fixed_peg_rates')
  if (!hasPegsTable) {
    await knex.schema.createTable('fixed_peg_rates', (table) => {
      table.string('currency', 3).primary() // ISO 4217 code (e.g., 'AED')
      table.string('peg_currency', 3).notNullable().defaultTo('USD')
      table.decimal('peg_rate', 19, 6).notNullable() // 1 USD = peg_rate Units (e.g., 3.6725)
      table.string('source', 150).notNullable()
      table.date('effective_date').notNullable()
      table.text('notes').nullable()
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())
    })

    // Seed official central bank fixed pegs
    await knex('fixed_peg_rates').insert([
      {
        currency: 'AED',
        peg_currency: 'USD',
        peg_rate: 3.6725,
        source: 'Central Bank of the UAE',
        effective_date: '1997-11-01',
        notes: 'Officially pegged to the US Dollar at 3.6725 AED per USD since November 1997.',
      },
      {
        currency: 'SAR',
        peg_currency: 'USD',
        peg_rate: 3.7500,
        source: 'Saudi Central Bank (SAMA)',
        effective_date: '1986-06-01',
        notes: 'Officially pegged to the US Dollar at 3.75 SAR per USD since June 1986.',
      },
      {
        currency: 'QAR',
        peg_currency: 'USD',
        peg_rate: 3.6400,
        source: 'Qatar Central Bank',
        effective_date: '2001-07-09',
        notes: 'Officially pegged to the US Dollar at 3.64 QAR per USD (Royal Decree 34/2001).',
      },
      {
        currency: 'BHD',
        peg_currency: 'USD',
        peg_rate: 0.3760,
        source: 'Central Bank of Bahrain',
        effective_date: '2001-12-01',
        notes: 'Officially pegged to the US Dollar at 1 USD = 0.376 BHD (1 BHD = 2.659 USD).',
      },
      {
        currency: 'OMR',
        peg_currency: 'USD',
        peg_rate: 0.3845,
        source: 'Central Bank of Oman',
        effective_date: '1986-01-01',
        notes: 'Officially pegged to the US Dollar at 1 USD = 0.3845 OMR (1 OMR = 2.6008 USD).',
      },
      {
        currency: 'JOD',
        peg_currency: 'USD',
        peg_rate: 0.7090,
        source: 'Central Bank of Jordan',
        effective_date: '1995-10-01',
        notes: 'Officially pegged to the US Dollar at 1 USD = 0.709 JOD (1 JOD = 1.41 USD).',
      },
    ])
  }

  // 2. PERSISTENT REQUEST METRICS PER MINUTE
  const hasRequestMetricsTable = await knex.schema.hasTable('request_metrics_minute')
  if (!hasRequestMetricsTable) {
    await knex.schema.createTable('request_metrics_minute', (table) => {
      table.bigIncrements('id').primary()
      table.dateTime('minute', { precision: 3 }).notNullable().index()
      table.string('route_pattern', 255).notNullable().index()
      table.string('method', 10).notNullable()
      table.string('status_class', 10).notNullable() // '2xx', '3xx', '4xx', '5xx'
      table.integer('request_count').notNullable().defaultTo(0)
      table.integer('error_count').notNullable().defaultTo(0)
      table.integer('p50_latency_ms').notNullable().defaultTo(0)
      table.integer('p95_latency_ms').notNullable().defaultTo(0)
      table.bigInteger('latency_sum_ms').notNullable().defaultTo(0)
      table.string('instance_id', 100).notNullable().defaultTo('instance_default')
      table.timestamp('created_at').defaultTo(knex.fn.now())

      table.index(['minute', 'route_pattern', 'method'])
      table.index(['minute', 'instance_id'])
    })
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('request_metrics_minute')
  await knex.schema.dropTableIfExists('fixed_peg_rates')
}
