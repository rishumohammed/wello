// server/utils/db.ts
/**
 * Shared Database Connection & Knex Query Builder for Wello
 * High-performance connection pooling via mysql2
 */

import knex, { Knex } from 'knex'

let _db: Knex | null = null

export function getDb(): Knex {
  if (!_db) {
    _db = knex({
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
      pool: {
        min: 2,
        max: 10,
      },
    })
  }
  return _db
}

export const db = getDb()

export default db
