// backend/knexfile.cjs
/**
 * Knex Configuration for Wello
 * Environment-aware database connection and migration settings
 */

const path = require('path')

module.exports = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wello',
    charset: 'utf8mb4',
    timezone: 'Z',
    decimalNumbers: true,
  },
  migrations: {
    directory: path.join(__dirname, 'database/migrations'),
    tableName: 'knex_migrations',
    extension: 'cjs',
  },
  seeds: {
    directory: path.join(__dirname, 'database/seeds'),
    extension: 'cjs',
  },
  pool: {
    min: 2,
    max: 10,
  },
}
