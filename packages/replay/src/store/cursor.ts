/**
 * @module store/cursor
 * @description Ingestion state management via `ingestion_state` table.
 *
 * Tracks last-processed timestamp for incremental ingestion.
 * Uses upsert pattern (INSERT ON CONFLICT UPDATE) for cursor updates.
 *
 * Crash-safe: Cursor only updated after successful flush to production.
 */

import { Effect, Option, pipe } from 'effect'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { DBError } from './types.ts'

// ============================================================================
// CURSOR TYPES
// ============================================================================

/**
 * Cursor key for main ingestion state.
 */
export const CURSOR_KEY = 'last_processed_timestamp' as const

/**
 * Cursor value stored in ingestion_state table.
 */
export interface CursorValue {
  /** Last successfully processed session mtime */
  timestamp: Date
  /** Session UUID that was processed */
  lastSessionId: string
  /** Number of sessions processed in last run */
  sessionsProcessed: number
  /** Last updated timestamp */
  updatedAt: Date
}

// ============================================================================
// CURSOR FUNCTIONS
// ============================================================================

/**
 * Get the current ingestion cursor.
 *
 * Returns Option.none if no cursor exists (first run).
 *
 * @param db - Kysely database instance
 * @returns Effect yielding Option<CursorValue>
 *
 * @example
 * ```typescript
 * const cursor = yield* getCursor(db)
 * const lastTimestamp = Option.match(cursor, {
 *   onNone: () => new Date(0), // Unix epoch for first run
 *   onSome: (c) => c.timestamp
 * })
 * ```
 */
export const getCursor = (
  db: Kysely<unknown>
): Effect.Effect<Option.Option<CursorValue>, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql<{ value: unknown }>`
        SELECT value FROM ingestion_state WHERE key = ${CURSOR_KEY}
      `.execute(db)

      const row = result.rows[0]
      if (!row) {
        return Option.none()
      }

      const value = row.value as Record<string, unknown>
      return Option.some({
        timestamp: new Date(value.timestamp as string),
        lastSessionId: (value.lastSessionId as string) ?? '',
        sessionsProcessed: (value.sessionsProcessed as number) ?? 0,
        updatedAt: new Date((value.updatedAt as string) ?? Date.now()),
      })
    },
    catch: (cause) =>
      new DBError({
        operation: 'cursor_get',
        cause,
      }),
  })

/**
 * Get last processed timestamp (convenience wrapper).
 *
 * Returns Unix epoch (1970-01-01) if no cursor exists.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding Date
 */
export const getLastProcessedTimestamp = (db: Kysely<unknown>): Effect.Effect<Date, DBError> =>
  pipe(
    getCursor(db),
    Effect.map(
      Option.match({
        onNone: () => new Date(0),
        onSome: (c) => c.timestamp,
      })
    )
  )

/**
 * Set the ingestion cursor after successful processing.
 *
 * Uses upsert pattern (INSERT ON CONFLICT UPDATE).
 * Should only be called after successful flush to production.
 *
 * @param db - Kysely database instance
 * @param timestamp - Last processed session mtime
 * @param sessionId - Session UUID that was processed (optional)
 * @param sessionsProcessed - Number of sessions in this run (optional)
 * @returns Effect yielding void
 *
 * @example
 * ```typescript
 * // After successful flush
 * yield* setCursor(db, sessionFile.modifiedAt, sessionFile.uuid, 1)
 * ```
 */
export const setCursor = (
  db: Kysely<unknown>,
  timestamp: Date,
  sessionId?: string,
  sessionsProcessed?: number
): Effect.Effect<void, DBError> =>
  Effect.tryPromise({
    try: () => {
      const value = JSON.stringify({
        timestamp: timestamp.toISOString(),
        lastSessionId: sessionId ?? '',
        sessionsProcessed: sessionsProcessed ?? 1,
        updatedAt: new Date().toISOString(),
      })

      return sql`
        INSERT INTO ingestion_state (key, value, updated_at)
        VALUES (
          ${CURSOR_KEY},
          ${value}::jsonb,
          NOW()
        )
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at
      `.execute(db)
    },
    catch: (cause) =>
      new DBError({
        operation: 'cursor_set',
        cause,
      }),
  }).pipe(Effect.asVoid)

/**
 * Reset the cursor to initial state.
 *
 * Deletes cursor from ingestion_state table.
 * Use to force full re-ingestion.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding void
 */
export const resetCursor = (db: Kysely<unknown>): Effect.Effect<void, DBError> =>
  Effect.tryPromise({
    try: () => sql`DELETE FROM ingestion_state WHERE key = ${CURSOR_KEY}`.execute(db),
    catch: (cause) =>
      new DBError({
        operation: 'cursor_set',
        cause,
      }),
  }).pipe(Effect.asVoid)

/**
 * Check if a session should be processed based on cursor.
 *
 * @param cursor - Current cursor (Option)
 * @param sessionMtime - Session file modification time
 * @returns true if session is newer than cursor
 */
export const shouldProcessSession = (
  cursor: Option.Option<CursorValue>,
  sessionMtime: Date
): boolean =>
  Option.match(cursor, {
    onNone: () => true, // No cursor = process all
    onSome: (c) => sessionMtime > c.timestamp,
  })
