/**
 * @module store
 * @description Re-export all store module exports for clean imports.
 *
 * The store module provides high-performance batch ingestion with:
 * - UNLOGGED staging tables for fast writes (no WAL overhead)
 * - Idempotent flush operations (ON CONFLICT DO NOTHING)
 * - Cursor-based incremental ingestion
 * - Effect.gen orchestration for the ingestion pipeline
 *
 * @example
 * ```typescript
 * import {
 *   ingestSession,
 *   ingestIncremental,
 *   getCursor,
 *   createBatchAccumulator,
 *   type IngestionStats
 * } from '@inherent.design/simulacrum-replay/store'
 *
 * const stats = await Effect.runPromise(
 *   ingestSession(db, sessionFile, { batchSize: 1000 }).pipe(
 *     Effect.provide(NodeFileSystem.layer)
 *   )
 * )
 * console.log(`Ingested ${stats.totalProductionInserts} rows`)
 * ```
 */

// Error types
export { DBError } from './types.ts'

// Batch types
export type {
  StoreBatchConfig,
  FlushResult,
  StagingFlushResult,
  IngestionStats,
  SessionStagingRow,
  MessageStagingRow,
  ToolCallStagingRow,
  ProgressEventStagingRow,
  QueueOperationStagingRow,
  SystemEventStagingRow,
  FileHistoryStagingRow,
  AnyStagingRow,
} from './types.ts'
export { DEFAULT_STORE_BATCH_CONFIG } from './types.ts'

// Accumulator types and functions
export type { AccumulatorState, BatchAccumulator } from './accumulator.ts'
export { createBatchAccumulator } from './accumulator.ts'

// Staging functions
export {
  insertToStaging,
  insertSessionsStaging,
  insertMessagesStaging,
  insertToolCallsStaging,
  insertProgressEventsStaging,
  insertQueueOperationsStaging,
  insertSystemEventsStaging,
  insertFileHistoryStaging,
  flushSessions,
  flushMessages,
  flushToolCalls,
  flushProgressEvents,
  flushQueueOperations,
  flushSystemEvents,
  flushFileHistory,
  flushAllStaging,
  truncateAllStaging,
} from './staging.ts'

// Ingestion functions
export type { IngestConfig } from './ingest.ts'
export {
  DEFAULT_INGEST_CONFIG,
  ingestSession,
  ingestSessions,
  ingestIncremental,
} from './ingest.ts'

// Cursor functions
export type { CursorValue } from './cursor.ts'
export {
  CURSOR_KEY,
  getCursor,
  getLastProcessedTimestamp,
  setCursor,
  resetCursor,
  shouldProcessSession,
} from './cursor.ts'
