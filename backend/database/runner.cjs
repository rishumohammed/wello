// backend/database/runner.cjs
/**
 * Programmatic Database Migration & Seed Runner for Wello
 * Auto-ensures database existence before running migrations
 */

const mysql = require('mysql2/promise')
const knex = require('knex')
const config = require('../knexfile.cjs')

async function ensureDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    })
    const dbName = process.env.DB_NAME || 'wello'
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)
    await connection.end()
  } catch (err) {
    console.warn('Could not auto-create database (might already exist or user lacks CREATE DB privileges):', err.message)
  }
}

async function run() {
  const cmd = process.argv[2] || 'migrate'
  await ensureDatabase()
  const db = knex(config)

  try {
    if (cmd === 'migrate') {
      console.log('🔄 Running knex migrate:latest...')
      const [batchNo, log] = await db.migrate.latest()
      console.log(`✅ Batch ${batchNo} complete: ${log.length} migrations executed.`)
      log.forEach(m => console.log(`  ✓ ${m}`))
    } else if (cmd === 'rollback') {
      console.log('🔄 Running knex migrate:rollback...')
      const [batchNo, log] = await db.migrate.rollback()
      console.log(`✅ Batch ${batchNo} rolled back: ${log.length} migrations reverted.`)
      log.forEach(m => console.log(`  ↺ ${m}`))
    } else if (cmd === 'seed') {
      console.log('🌱 Running knex seed:run...')
      const [log] = await db.seed.run()
      console.log(`✅ Ran ${log.length} seed file(s).`)
      log.forEach(s => console.log(`  ✓ ${s}`))
    } else {
      console.error(`Unknown command "${cmd}". Expected "migrate", "rollback", or "seed".`)
      process.exit(1)
    }
  } finally {
    await db.destroy()
  }
}

run().catch(err => {
  console.error('❌ Migration runner failed:', err)
  process.exit(1)
})
