// server/utils/db.ts
/**
 * Shared Database Connection & Knex Query Builder for Wello
 * High-performance connection pooling via mysql2 with graceful shutdown support
 */

import knex, { Knex } from 'knex'

let _db: Knex | null = null

export function getDb(): Knex {
  if (!_db) {
    const minPool = Number(process.env.DB_POOL_MIN) || 2
    const maxPool = Number(process.env.DB_POOL_MAX) || 20

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
        min: minPool,
        max: maxPool,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
      },
    })
  }
  return _db
}

/**
 * Closes the Knex connection pool during graceful shutdown
 */
export async function closeDbPool(): Promise<void> {
  if (_db) {
    try {
      await _db.destroy()
    } catch (e) {
      // ignore
    } finally {
      _db = null
    }
  }
}

export const db = getDb()

export default db
