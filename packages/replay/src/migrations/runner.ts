/**
 * @module migrations/runner
 * @description Effect-wrapped migration runner with tracking table and tagged error types.
 *
 * Why custom runner instead of Kysely's built-in migrator:
 * - TimescaleDB functions (create_hypertable, add_compression_policy) require raw SQL
 * - Need idempotent patterns (IF NOT EXISTS, if_not_exists => TRUE) for safe re-runs
 * - Effect integration for consistent error handling across replay package
 * - Forward-only migrations preferred for production safety
 */

import { Effect, Data } from 'effect'
import { Kysely, sql } from 'kysely'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// ============================================================
// ERROR TYPES
// ============================================================

/**
 * Error creating or querying migration tracking table.
 */
export class MigrationTableError extends Data.TaggedError('MigrationTableError')<{
  cause: unknown
}> {}

/**
 * Error reading migration files from directory.
 */
export class MigrationReadError extends Data.TaggedError('MigrationReadError')<{
  cause: unknown
}> {}

/**
 * Error executing a specific migration.
 */
export class MigrationExecuteError extends Data.TaggedError('MigrationExecuteError')<{
  name: string
  cause: unknown
}> {}

// ============================================================
// TYPES
// ============================================================

/**
 * Migration module interface.
 * down is optional - forward-only migrations preferred.
 */
export interface MigrationModule {
  up: (db: Kysely<unknown>) => Promise<void>
  down?: (db: Kysely<unknown>) => Promise<void>
}

/**
 * Result of running a single migration.
 */
export interface MigrationResult {
  name: string
  status: 'applied' | 'skipped' | 'failed'
  error?: string
  durationMs: number
}

// ============================================================
// RUNNER
// ============================================================

/**
 * Run all pending migrations in order.
 *
 * Algorithm:
 * 1. Ensure tracking table exists (idempotent)
 * 2. Query already-applied migrations
 * 3. Read migration files (sorted lexicographically)
 * 4. Execute pending migrations sequentially
 * 5. Record each successful migration
 * 6. Stop on first failure
 *
 * @param db - Kysely database instance
 * @param migrationsPath - Absolute path to migrations directory
 * @returns Array of migration results
 */
export const runMigrations = (
  db: Kysely<unknown>,
  migrationsPath: string
): Effect.Effect<
  MigrationResult[],
  MigrationTableError | MigrationReadError | MigrationExecuteError
> =>
  Effect.gen(function* () {
    // Step 1: Ensure migration tracking table exists
    yield* Effect.tryPromise({
      try: () =>
        sql`
      CREATE TABLE IF NOT EXISTS kysely_migration (
        name VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.execute(db),
      catch: (cause) => new MigrationTableError({ cause }),
    })

    // Step 2: Get already-applied migrations
    const appliedRows = yield* Effect.tryPromise({
      try: async () => {
        const result = await sql<{ name: string }>`
          SELECT name FROM kysely_migration
        `.execute(db)
        return result.rows
      },
      catch: (cause) => new MigrationTableError({ cause }),
    })
    const applied = new Set(appliedRows.map((r) => r.name))

    // Step 3: Read migration files (sorted by name)
    const files = yield* Effect.tryPromise({
      try: async () => {
        const entries = await fs.readdir(migrationsPath)
        return entries
          .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
          .filter((f) => !f.startsWith('index')) // Skip index.ts
          .filter((f) => !f.startsWith('runner')) // Skip runner.ts
          .sort() // Lexicographic: 001_init.ts, 002_staging.ts, etc.
      },
      catch: (cause) => new MigrationReadError({ cause }),
    })

    // Step 4: Execute pending migrations sequentially
    const results: MigrationResult[] = []

    for (const file of files) {
      const name = path.basename(file, path.extname(file))
      const startTime = Date.now()

      // Skip already-applied migrations
      if (applied.has(name)) {
        results.push({
          name,
          status: 'skipped',
          durationMs: 0,
        })
        continue
      }

      // Execute migration
      const result = yield* Effect.tryPromise({
        try: async () => {
          // Dynamic import of migration module
          const migration: MigrationModule = (await import(
            path.join(migrationsPath, file)
          )) as MigrationModule

          // Run up migration
          await migration.up(db)

          // Record successful migration
          await db
            .insertInto('kysely_migration' as never)
            .values({ name } as never)
            .execute()

          return {
            name,
            status: 'applied' as const,
            durationMs: Date.now() - startTime,
          }
        },
        catch: (cause) => new MigrationExecuteError({ name, cause }),
      }).pipe(
        // Convert execution error to failed result (don't throw)
        Effect.catchTag('MigrationExecuteError', (error) =>
          Effect.succeed({
            name,
            status: 'failed' as const,
            error: String(error.cause),
            durationMs: Date.now() - startTime,
          })
        )
      )

      results.push(result)

      // Stop on first failure
      if (result.status === 'failed') {
        break
      }
    }

    return results
  })

/**
 * Get list of applied migrations.
 */
export const getAppliedMigrations = (
  db: Kysely<unknown>
): Effect.Effect<string[], MigrationTableError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql<{ name: string }>`
        SELECT name FROM kysely_migration ORDER BY timestamp ASC
      `.execute(db)
      return result.rows.map((r) => r.name)
    },
    catch: (cause) => new MigrationTableError({ cause }),
  })
