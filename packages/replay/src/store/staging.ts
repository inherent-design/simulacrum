/**
 * @module store/staging
 * @description UNLOGGED staging table operations - fast inserts and flush to production.
 *
 * Uses UNLOGGED table properties:
 * - No WAL writes (30-50% faster)
 * - No constraints checked
 * - Data lost on crash (acceptable for staging)
 *
 * Flush functions call SQL procedures that:
 * 1. INSERT INTO production SELECT FROM staging ON CONFLICT DO NOTHING
 * 2. TRUNCATE staging table
 *
 * This provides idempotent upserts - duplicates are safely skipped.
 */

import { Effect } from 'effect'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import {
  DBError,
  type StagingFlushResult,
  type SessionStagingRow,
  type MessageStagingRow,
  type ToolCallStagingRow,
  type ProgressEventStagingRow,
  type QueueOperationStagingRow,
  type SystemEventStagingRow,
  type FileHistoryStagingRow,
} from './types.ts'

// ============================================================================
// STAGING INSERT FUNCTIONS
// ============================================================================

/**
 * Insert rows into a staging table.
 *
 * Uses UNLOGGED table properties:
 * - No WAL writes (30-50% faster)
 * - No constraints checked
 * - Data lost on crash (acceptable for staging)
 *
 * @param db - Kysely database instance
 * @param table - Staging table name
 * @param rows - Rows to insert
 * @returns Effect yielding number of rows inserted
 *
 * @example
 * ```typescript
 * const count = yield* insertToStaging(db, 'messages_staging', messageRows)
 * ```
 */
export const insertToStaging = <T extends object>(
  db: Kysely<unknown>,
  table: string,
  rows: T[]
): Effect.Effect<number, DBError> =>
  Effect.gen(function* () {
    if (rows.length === 0) return 0

    yield* Effect.tryPromise({
      try: () =>
        db
          .insertInto(table as never)
          .values(rows as never)
          .execute(),
      catch: (cause) =>
        new DBError({
          operation: 'insert_staging',
          table,
          cause,
        }),
    })

    return rows.length
  })

/**
 * Insert session rows into sessions_staging.
 * Type-safe wrapper around insertToStaging.
 */
export const insertSessionsStaging = (
  db: Kysely<unknown>,
  rows: SessionStagingRow[]
): Effect.Effect<number, DBError> => insertToStaging(db, 'sessions_staging', rows)

/**
 * Insert message rows into messages_staging.
 * Type-safe wrapper around insertToStaging.
 */
export const insertMessagesStaging = (
  db: Kysely<unknown>,
  rows: MessageStagingRow[]
): Effect.Effect<number, DBError> => insertToStaging(db, 'messages_staging', rows)

/**
 * Insert tool call rows into tool_calls_staging.
 * Type-safe wrapper around insertToStaging.
 */
export const insertToolCallsStaging = (
  db: Kysely<unknown>,
  rows: ToolCallStagingRow[]
): Effect.Effect<number, DBError> => insertToStaging(db, 'tool_calls_staging', rows)

/**
 * Insert progress event rows into progress_events_staging.
 * Type-safe wrapper around insertToStaging.
 */
export const insertProgressEventsStaging = (
  db: Kysely<unknown>,
  rows: ProgressEventStagingRow[]
): Effect.Effect<number, DBError> => insertToStaging(db, 'progress_events_staging', rows)

/**
 * Insert queue operation rows into queue_operations_staging.
 * Type-safe wrapper around insertToStaging.
 */
export const insertQueueOperationsStaging = (
  db: Kysely<unknown>,
  rows: QueueOperationStagingRow[]
): Effect.Effect<number, DBError> => insertToStaging(db, 'queue_operations_staging', rows)

/**
 * Insert system event rows into system_events_staging.
 * Type-safe wrapper around insertToStaging.
 */
export const insertSystemEventsStaging = (
  db: Kysely<unknown>,
  rows: SystemEventStagingRow[]
): Effect.Effect<number, DBError> => insertToStaging(db, 'system_events_staging', rows)

/**
 * Insert file history rows into file_history_staging.
 * Type-safe wrapper around insertToStaging.
 */
export const insertFileHistoryStaging = (
  db: Kysely<unknown>,
  rows: FileHistoryStagingRow[]
): Effect.Effect<number, DBError> => insertToStaging(db, 'file_history_staging', rows)

// ============================================================================
// STAGING FLUSH FUNCTIONS
// ============================================================================

/**
 * Flush sessions staging table to production.
 *
 * Calls flush_sessions_staging() SQL function:
 * 1. INSERT INTO sessions SELECT FROM sessions_staging ON CONFLICT DO NOTHING
 * 2. TRUNCATE sessions_staging
 *
 * @param db - Kysely database instance
 * @returns Effect yielding number of rows flushed
 */
export const flushSessions = (db: Kysely<unknown>): Effect.Effect<number, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql`SELECT * FROM flush_sessions_staging()`.execute(db)
      return (result.rows[0] as { inserted_count?: number })?.inserted_count ?? 0
    },
    catch: (cause) =>
      new DBError({
        operation: 'flush',
        table: 'sessions',
        cause,
      }),
  })

/**
 * Flush messages staging table to production.
 *
 * Calls flush_messages_staging() SQL function.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding number of rows flushed
 */
export const flushMessages = (db: Kysely<unknown>): Effect.Effect<number, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql`SELECT * FROM flush_messages_staging()`.execute(db)
      return (result.rows[0] as { inserted_count?: number })?.inserted_count ?? 0
    },
    catch: (cause) =>
      new DBError({
        operation: 'flush',
        table: 'messages',
        cause,
      }),
  })

/**
 * Flush tool_calls staging table to production.
 *
 * Calls flush_tool_calls_staging() SQL function.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding number of rows flushed
 */
export const flushToolCalls = (db: Kysely<unknown>): Effect.Effect<number, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql`SELECT * FROM flush_tool_calls_staging()`.execute(db)
      return (result.rows[0] as { inserted_count?: number })?.inserted_count ?? 0
    },
    catch: (cause) =>
      new DBError({
        operation: 'flush',
        table: 'tool_calls',
        cause,
      }),
  })

/**
 * Flush progress_events staging table to production.
 *
 * Calls flush_progress_events_staging() SQL function.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding number of rows flushed
 */
export const flushProgressEvents = (db: Kysely<unknown>): Effect.Effect<number, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql`SELECT * FROM flush_progress_events_staging()`.execute(db)
      return (result.rows[0] as { inserted_count?: number })?.inserted_count ?? 0
    },
    catch: (cause) =>
      new DBError({
        operation: 'flush',
        table: 'progress_events',
        cause,
      }),
  })

/**
 * Flush queue_operations staging table to production.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding number of rows flushed
 */
export const flushQueueOperations = (db: Kysely<unknown>): Effect.Effect<number, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql`SELECT * FROM flush_queue_operations_staging()`.execute(db)
      return (result.rows[0] as { inserted_count?: number })?.inserted_count ?? 0
    },
    catch: (cause) =>
      new DBError({
        operation: 'flush',
        table: 'queue_operations',
        cause,
      }),
  })

/**
 * Flush system_events staging table to production.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding number of rows flushed
 */
export const flushSystemEvents = (db: Kysely<unknown>): Effect.Effect<number, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql`SELECT * FROM flush_system_events_staging()`.execute(db)
      return (result.rows[0] as { inserted_count?: number })?.inserted_count ?? 0
    },
    catch: (cause) =>
      new DBError({
        operation: 'flush',
        table: 'system_events',
        cause,
      }),
  })

/**
 * Flush file_history staging table to production.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding number of rows flushed
 */
export const flushFileHistory = (db: Kysely<unknown>): Effect.Effect<number, DBError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await sql`SELECT * FROM flush_file_history_staging()`.execute(db)
      return (result.rows[0] as { inserted_count?: number })?.inserted_count ?? 0
    },
    catch: (cause) =>
      new DBError({
        operation: 'flush',
        table: 'file_history',
        cause,
      }),
  })

/**
 * Flush all staging tables to production in a single transaction.
 *
 * Transaction guarantees:
 * - All-or-nothing: either all tables flush or none
 * - On failure, staging data preserved for retry
 * - Cursor NOT updated until this succeeds
 *
 * @param db - Kysely database instance
 * @returns Effect yielding StagingFlushResult with counts per table
 *
 * @example
 * ```typescript
 * const result = yield* flushAllStaging(db)
 * console.log(`Flushed: ${result.messagesInserted} messages, ${result.toolCallsInserted} tool calls`)
 * ```
 */
export const flushAllStaging = (db: Kysely<unknown>): Effect.Effect<StagingFlushResult, DBError> =>
  Effect.gen(function* () {
    const startTime = Date.now()

    // Execute all flushes in a single transaction
    const counts = yield* Effect.tryPromise({
      try: () =>
        db.transaction().execute(async (trx) => {
          const sessions = await sql`SELECT * FROM flush_sessions_staging()`.execute(trx)
          const messages = await sql`SELECT * FROM flush_messages_staging()`.execute(trx)
          const toolCalls = await sql`SELECT * FROM flush_tool_calls_staging()`.execute(trx)
          const progressEvents = await sql`SELECT * FROM flush_progress_events_staging()`.execute(
            trx
          )
          const queueOperations = await sql`SELECT * FROM flush_queue_operations_staging()`.execute(
            trx
          )
          const systemEvents = await sql`SELECT * FROM flush_system_events_staging()`.execute(trx)
          const fileHistory = await sql`SELECT * FROM flush_file_history_staging()`.execute(trx)

          return {
            sessionsInserted:
              (sessions.rows[0] as { inserted_count?: number })?.inserted_count ?? 0,
            messagesInserted:
              (messages.rows[0] as { inserted_count?: number })?.inserted_count ?? 0,
            toolCallsInserted:
              (toolCalls.rows[0] as { inserted_count?: number })?.inserted_count ?? 0,
            progressEventsInserted:
              (progressEvents.rows[0] as { inserted_count?: number })?.inserted_count ?? 0,
            queueOperationsInserted:
              (queueOperations.rows[0] as { inserted_count?: number })?.inserted_count ?? 0,
            systemEventsInserted:
              (systemEvents.rows[0] as { inserted_count?: number })?.inserted_count ?? 0,
            fileHistoryInserted:
              (fileHistory.rows[0] as { inserted_count?: number })?.inserted_count ?? 0,
          }
        }),
      catch: (cause) =>
        new DBError({
          operation: 'transaction',
          cause,
        }),
    })

    return {
      ...counts,
      durationMs: Date.now() - startTime,
    }
  })

/**
 * Truncate all staging tables.
 *
 * Calls truncate_staging_tables() SQL function.
 * Use before starting a new session ingestion.
 *
 * @param db - Kysely database instance
 * @returns Effect yielding void
 */
export const truncateAllStaging = (db: Kysely<unknown>): Effect.Effect<void, DBError> =>
  Effect.tryPromise({
    try: () => sql`SELECT truncate_staging_tables()`.execute(db),
    catch: (cause) =>
      new DBError({
        operation: 'truncate',
        cause,
      }),
  }).pipe(Effect.asVoid)
