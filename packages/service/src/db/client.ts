/**
 * @module db/client
 * @description Kysely client factory with PgBouncer-compatible pool configuration.
 *
 * Pool settings are optimized for:
 * - Connection reuse under concurrent requests
 * - PgBouncer transaction pooling mode compatibility
 * - Graceful handling of connection errors
 */

import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from './types.ts'

const { Pool } = pg

// ============================================================================
// POOL CONFIGURATION
// ============================================================================

/**
 * Database configuration options.
 */
export interface DbConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
  applicationName: string
}

/**
 * Create pool configuration from environment variables.
 * PgBouncer-compatible settings for transaction pooling mode.
 *
 * @param overrides - Optional configuration overrides
 * @returns pg Pool configuration object
 */
export const createPoolConfig = (overrides?: Partial<DbConfig>): pg.PoolConfig => ({
  host: overrides?.host ?? process.env['DB_HOST'] ?? 'localhost',
  port: overrides?.port ?? parseInt(process.env['DB_PORT'] ?? '5432', 10),
  database: overrides?.database ?? process.env['DB_NAME'] ?? 'simulacrum',
  user: overrides?.user ?? process.env['DB_USER'] ?? 'postgres',
  password: overrides?.password ?? process.env['DB_PASSWORD'] ?? 'postgres',

  // Connection pool settings
  max: overrides?.max ?? 20,
  idleTimeoutMillis: overrides?.idleTimeoutMillis ?? 30000, // 30s idle timeout
  connectionTimeoutMillis: overrides?.connectionTimeoutMillis ?? 2000, // 2s connect timeout

  // PgBouncer compatibility
  application_name: overrides?.applicationName ?? 'simulacrum-service',

  // Important: Disable prepared statement caching for PgBouncer transaction mode
  // Kysely uses simple queries by default, but this ensures compatibility
})

// ============================================================================
// CLIENT FACTORY
// ============================================================================

/**
 * Create a Kysely database client with PgBouncer-compatible configuration.
 *
 * Pool settings:
 * - max: 20 connections (default)
 * - idleTimeoutMillis: 30000 (close idle after 30s)
 * - connectionTimeoutMillis: 2000 (fail connect after 2s)
 *
 * PgBouncer compatibility:
 * - application_name set for connection tracking
 * - No prepared statement caching (transaction mode compatible)
 * - No session-level settings
 *
 * @param overrides - Optional configuration overrides
 * @returns Kysely database client instance
 */
export const createDbClient = (overrides?: Partial<DbConfig>): Kysely<Database> => {
  const poolConfig = createPoolConfig(overrides)
  const pool = new Pool(poolConfig)

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err)
  })

  // Optional: Log connection events in development
  if (process.env['NODE_ENV'] === 'development') {
    pool.on('connect', () => {
      console.debug('[db] New client connected')
    })
    pool.on('remove', () => {
      console.debug('[db] Client removed from pool')
    })
  }

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  })
}

/**
 * Check database connectivity.
 * Performs a simple count query to verify the connection is working.
 *
 * @param db - Kysely database client
 * @returns true if connection successful
 * @throws on connection failure
 */
export const checkConnection = async (db: Kysely<Database>): Promise<boolean> => {
  const result = await db
    .selectFrom('sessions')
    .select(db.fn.count<number>('id').as('count'))
    .executeTakeFirst()
  return result !== undefined
}

/**
 * Gracefully close database connection pool.
 * Call during application shutdown to ensure clean resource cleanup.
 *
 * @param db - Kysely database client
 */
export const closeConnection = async (db: Kysely<Database>): Promise<void> => {
  await db.destroy()
}
