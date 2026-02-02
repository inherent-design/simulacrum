/**
 * @module store/ingest
 * @description Main session ingestion entry point.
 *
 * Combines parser stream with store writes using Effect.gen orchestration.
 *
 * Pipeline:
 * 1. Truncate staging tables (clean slate)
 * 2. Stream JSONL file line-by-line
 * 3. Decode entries with schema validation
 * 4. Route entries to appropriate staging tables
 * 5. Batch accumulate for efficient inserts
 * 6. Flush staging to production
 * 7. Update cursor (if successful)
 *
 * Error handling:
 * - Parse errors: Skip line, log, continue (if resilient=true)
 * - DB errors: Fail immediately, cursor NOT updated
 * - IO errors: Fail immediately, cursor NOT updated
 */

import { Effect, Either, Option, pipe, Stream } from 'effect'
import type { Kysely } from 'kysely'
import type { FileSystem } from '@effect/platform'
import type {
  IngestionStats,
  DBError,
  SessionStagingRow,
  MessageStagingRow,
  ToolCallStagingRow,
  ProgressEventStagingRow,
  QueueOperationStagingRow,
  SystemEventStagingRow,
  FileHistoryStagingRow,
} from './types.ts'
import { DEFAULT_STORE_BATCH_CONFIG } from './types.ts'
import { createBatchAccumulator, type BatchAccumulator } from './accumulator.ts'
import {
  insertMessagesStaging,
  insertToolCallsStaging,
  insertProgressEventsStaging,
  insertSessionsStaging,
  insertQueueOperationsStaging,
  insertSystemEventsStaging,
  insertFileHistoryStaging,
  flushAllStaging,
  truncateAllStaging,
} from './staging.ts'
import { getCursor, setCursor, shouldProcessSession } from './cursor.ts'
import type { SessionFile } from '../scanner/types.ts'
import type { IOError } from '../parser/stream.ts'
import type { ParseError, DecodedEntry } from '../parser/decoder.ts'
import { streamJSONL } from '../parser/stream.ts'
import { decodeStream, decodeStreamResilient } from '../parser/decoder.ts'
import { routeEntry, type RouteResult, type StagingTable } from '../parser/router.ts'

// ============================================================================
// INGESTION TYPES
// ============================================================================

/**
 * Configuration for session ingestion.
 */
export interface IngestConfig {
  /**
   * Batch size for staging inserts.
   * Default: 1000
   */
  batchSize?: number

  /**
   * Whether to update cursor after successful ingestion.
   * Default: true
   */
  updateCursor?: boolean

  /**
   * Progress callback (called periodically during ingestion).
   */
  onProgress?: (stats: Partial<IngestionStats>) => Effect.Effect<void>

  /**
   * Whether to continue on parse errors.
   * Default: true (resilient mode)
   */
  resilient?: boolean
}

/**
 * Default ingestion configuration.
 */
export const DEFAULT_INGEST_CONFIG: Required<Omit<IngestConfig, 'onProgress'>> = {
  batchSize: DEFAULT_STORE_BATCH_CONFIG.batchSize,
  updateCursor: true,
  resilient: true,
}

// ============================================================================
// ACCUMULATOR COLLECTION TYPE
// ============================================================================

interface Accumulators {
  sessions: BatchAccumulator<SessionStagingRow>
  messages: BatchAccumulator<MessageStagingRow>
  toolCalls: BatchAccumulator<ToolCallStagingRow>
  progressEvents: BatchAccumulator<ProgressEventStagingRow>
  queueOperations: BatchAccumulator<QueueOperationStagingRow>
  systemEvents: BatchAccumulator<SystemEventStagingRow>
  fileHistory: BatchAccumulator<FileHistoryStagingRow>
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Route a decoded entry and add to appropriate accumulator.
 */
const processRoutedEntry = (
  decoded: DecodedEntry,
  sessionId: string,
  accumulators: Accumulators
): Effect.Effect<{ table: StagingTable | 'skip'; skipped: boolean }, DBError> =>
  Effect.gen(function* () {
    const routed = routeEntry(decoded, sessionId)

    if (routed.table === 'skip') {
      return { table: 'skip' as const, skipped: true }
    }

    // Route to appropriate accumulator based on table
    // Note: router returns Record<string, unknown>, we cast through unknown for type safety
    switch (routed.table) {
      case 'sessions_staging':
        yield* accumulators.sessions.add(routed.row as unknown as SessionStagingRow)
        break
      case 'messages_staging':
        yield* accumulators.messages.add(routed.row as unknown as MessageStagingRow)
        break
      case 'tool_calls_staging':
        yield* accumulators.toolCalls.add(routed.row as unknown as ToolCallStagingRow)
        break
      case 'progress_events_staging':
        yield* accumulators.progressEvents.add(routed.row as unknown as ProgressEventStagingRow)
        break
      case 'queue_operations_staging':
        yield* accumulators.queueOperations.add(routed.row as unknown as QueueOperationStagingRow)
        break
      case 'system_events_staging':
        yield* accumulators.systemEvents.add(routed.row as unknown as SystemEventStagingRow)
        break
      case 'file_history_staging':
        yield* accumulators.fileHistory.add(routed.row as unknown as FileHistoryStagingRow)
        break
    }

    return { table: routed.table, skipped: false }
  })

// ============================================================================
// INGESTION FUNCTIONS
// ============================================================================

/**
 * Ingest a single session from JSONL file.
 *
 * Pipeline:
 * 1. Truncate staging tables (clean slate)
 * 2. Stream JSONL file line-by-line
 * 3. Decode entries with schema validation
 * 4. Route entries to appropriate staging tables
 * 5. Batch accumulate for efficient inserts
 * 6. Flush staging to production
 * 7. Update cursor (if successful)
 *
 * Error handling:
 * - Parse errors: Skip line, log, continue (if resilient=true)
 * - DB errors: Fail immediately, cursor NOT updated
 * - IO errors: Fail immediately, cursor NOT updated
 *
 * @param db - Kysely database instance
 * @param sessionFile - Session file metadata from scanner
 * @param config - Ingestion configuration (optional)
 * @returns Effect yielding IngestionStats
 *
 * @example
 * ```typescript
 * const stats = yield* ingestSession(db, sessionFile, {
 *   batchSize: 1000,
 *   onProgress: (s) => Effect.log(`Processed ${s.totalEntriesProcessed} entries`)
 * })
 *
 * console.log(`Ingested: ${stats.totalProductionInserts} rows in ${stats.totalDurationMs}ms`)
 * ```
 */
export const ingestSession = (
  db: Kysely<unknown>,
  sessionFile: SessionFile,
  config: IngestConfig = {}
): Effect.Effect<IngestionStats, DBError | IOError | ParseError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    const startedAt = new Date(startTime)
    const batchSize = config.batchSize ?? DEFAULT_INGEST_CONFIG.batchSize
    const resilient = config.resilient ?? DEFAULT_INGEST_CONFIG.resilient

    // Step 1: Truncate staging tables
    yield* truncateAllStaging(db)

    // Step 2: Create batch accumulators for each table type
    const accumulators: Accumulators = {
      sessions: yield* createBatchAccumulator<SessionStagingRow>(
        'sessions_staging',
        (rows) => insertSessionsStaging(db, rows),
        { batchSize }
      ),
      messages: yield* createBatchAccumulator<MessageStagingRow>(
        'messages_staging',
        (rows) => insertMessagesStaging(db, rows),
        { batchSize }
      ),
      toolCalls: yield* createBatchAccumulator<ToolCallStagingRow>(
        'tool_calls_staging',
        (rows) => insertToolCallsStaging(db, rows),
        { batchSize }
      ),
      progressEvents: yield* createBatchAccumulator<ProgressEventStagingRow>(
        'progress_events_staging',
        (rows) => insertProgressEventsStaging(db, rows),
        { batchSize }
      ),
      queueOperations: yield* createBatchAccumulator<QueueOperationStagingRow>(
        'queue_operations_staging',
        (rows) => insertQueueOperationsStaging(db, rows),
        { batchSize }
      ),
      systemEvents: yield* createBatchAccumulator<SystemEventStagingRow>(
        'system_events_staging',
        (rows) => insertSystemEventsStaging(db, rows),
        { batchSize }
      ),
      fileHistory: yield* createBatchAccumulator<FileHistoryStagingRow>(
        'file_history_staging',
        (rows) => insertFileHistoryStaging(db, rows),
        { batchSize }
      ),
    }

    // Track stats
    let totalProcessed = 0
    let skipped = 0
    let parseErrors = 0

    // Step 3: Build and execute pipeline
    if (resilient) {
      // Resilient mode: collect errors without stopping
      yield* pipe(
        streamJSONL(sessionFile.mainFile),
        decodeStreamResilient(),
        Stream.tap((either) =>
          Effect.gen(function* () {
            totalProcessed++

            if (Either.isLeft(either)) {
              // Parse error - count and skip
              parseErrors++
              return
            }

            const decoded = either.right
            const result = yield* processRoutedEntry(decoded, sessionFile.uuid, accumulators)
            if (result.skipped) {
              skipped++
            }

            // Report progress if callback provided
            if (config.onProgress && totalProcessed % 100 === 0) {
              yield* config.onProgress({
                sessionId: sessionFile.uuid,
                totalEntriesProcessed: totalProcessed,
                entriesSkipped: skipped,
                parseErrors,
              })
            }
          })
        ),
        Stream.runDrain
      )
    } else {
      // Strict mode: fail on first parse error
      yield* pipe(
        streamJSONL(sessionFile.mainFile),
        decodeStream(),
        Stream.tap((decoded) =>
          Effect.gen(function* () {
            totalProcessed++

            const result = yield* processRoutedEntry(decoded, sessionFile.uuid, accumulators)
            if (result.skipped) {
              skipped++
            }

            // Report progress if callback provided
            if (config.onProgress && totalProcessed % 100 === 0) {
              yield* config.onProgress({
                sessionId: sessionFile.uuid,
                totalEntriesProcessed: totalProcessed,
                entriesSkipped: skipped,
              })
            }
          })
        ),
        Stream.runDrain
      )
    }

    // Step 4: Flush remaining batches
    yield* accumulators.sessions.flush()
    yield* accumulators.messages.flush()
    yield* accumulators.toolCalls.flush()
    yield* accumulators.progressEvents.flush()
    yield* accumulators.queueOperations.flush()
    yield* accumulators.systemEvents.flush()
    yield* accumulators.fileHistory.flush()

    // Step 5: Flush staging to production
    const flushResult = yield* flushAllStaging(db)

    // Step 6: Update cursor (if successful and enabled)
    if (config.updateCursor !== false) {
      yield* setCursor(db, sessionFile.modifiedAt, sessionFile.uuid, 1)
    }

    const completedAt = new Date()

    // Step 7: Get accumulator states for stats
    const [sessState, msgState, tcState, progState, qOpState, sysState, fhState] =
      yield* Effect.all([
        accumulators.sessions.getState(),
        accumulators.messages.getState(),
        accumulators.toolCalls.getState(),
        accumulators.progressEvents.getState(),
        accumulators.queueOperations.getState(),
        accumulators.systemEvents.getState(),
        accumulators.fileHistory.getState(),
      ])

    const totalStagingInserts =
      sessState.totalFlushed +
      msgState.totalFlushed +
      tcState.totalFlushed +
      progState.totalFlushed +
      qOpState.totalFlushed +
      sysState.totalFlushed +
      fhState.totalFlushed

    const totalProductionInserts =
      flushResult.sessionsInserted +
      flushResult.messagesInserted +
      flushResult.toolCallsInserted +
      flushResult.progressEventsInserted +
      flushResult.queueOperationsInserted +
      flushResult.systemEventsInserted +
      flushResult.fileHistoryInserted

    const batchCount =
      sessState.flushCount +
      msgState.flushCount +
      tcState.flushCount +
      progState.flushCount +
      qOpState.flushCount +
      sysState.flushCount +
      fhState.flushCount

    return {
      sessionId: sessionFile.uuid,
      totalEntriesProcessed: totalProcessed,
      totalStagingInserts,
      totalProductionInserts,
      batchCount,
      parseErrors,
      entriesSkipped: skipped,
      totalDurationMs: Date.now() - startTime,
      startedAt,
      completedAt,
    }
  })

/**
 * Ingest multiple sessions with cursor tracking.
 *
 * Processes sessions in order of timestamp (oldest first).
 * Updates cursor after each successful session.
 * Continues to next session even if one fails (logs error).
 *
 * @param db - Kysely database instance
 * @param sessionFiles - Session files to ingest (should be sorted by mtime)
 * @param config - Ingestion configuration
 * @returns Effect yielding array of IngestionStats (one per session)
 *
 * @example
 * ```typescript
 * const results = yield* ingestSessions(db, sessionFiles, { batchSize: 1000 })
 * const successful = results.filter(r => r.totalProductionInserts > 0)
 * console.log(`Ingested ${successful.length}/${sessionFiles.length} sessions`)
 * ```
 */
export const ingestSessions = (
  db: Kysely<unknown>,
  sessionFiles: SessionFile[],
  config: IngestConfig = {}
): Effect.Effect<IngestionStats[], DBError | IOError | ParseError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const results: IngestionStats[] = []

    for (const sessionFile of sessionFiles) {
      const stats = yield* ingestSession(db, sessionFile, config)
      results.push(stats)
    }

    return results
  })

/**
 * Ingest sessions incrementally from cursor.
 *
 * Algorithm:
 * 1. Get last processed timestamp from cursor
 * 2. Filter sessions to those newer than cursor
 * 3. Sort by mtime (oldest first)
 * 4. Ingest each session
 * 5. Update cursor after each success
 *
 * @param db - Kysely database instance
 * @param sessionFiles - All available session files
 * @param config - Ingestion configuration
 * @returns Effect yielding array of IngestionStats for newly processed sessions
 */
export const ingestIncremental = (
  db: Kysely<unknown>,
  sessionFiles: SessionFile[],
  config: IngestConfig = {}
): Effect.Effect<IngestionStats[], DBError | IOError | ParseError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    // Get current cursor
    const cursor = yield* getCursor(db)

    // Filter sessions to those newer than cursor
    const sessionsToProcess = sessionFiles
      .filter((s) => shouldProcessSession(cursor, s.modifiedAt))
      .sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())

    if (sessionsToProcess.length === 0) {
      return []
    }

    // Process sessions
    return yield* ingestSessions(db, sessionsToProcess, config)
  })
