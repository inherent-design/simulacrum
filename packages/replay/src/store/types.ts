/**
 * @module store/types
 * @description Type definitions for batch accumulation, flush results, and ingestion statistics.
 *
 * Error types are tagged for Effect's catchTag pattern.
 * Row types mirror staging table schemas from 002_staging migration.
 */

import { Data } from 'effect'

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Database operation error.
 * Tagged for Effect's catchTag pattern.
 */
export class DBError extends Data.TaggedError('DBError')<{
  /** Database operation that failed */
  operation: 'insert_staging' | 'flush' | 'cursor_get' | 'cursor_set' | 'truncate' | 'transaction'
  /** Target table (if applicable) */
  table?: string
  /** Original error */
  cause: unknown
}> {}

// ============================================================================
// BATCH TYPES
// ============================================================================

/**
 * Configuration for store batch accumulation.
 */
export interface StoreBatchConfig {
  /**
   * Number of rows per batch before auto-flush.
   * Default: 1000
   *
   * Tuning guide:
   * - Lower (500): Less memory, more transactions
   * - Higher (2000): More memory, fewer transactions
   * - Max: 32767 / columns_per_row (PostgreSQL limit)
   */
  batchSize?: number
}

/**
 * Default store batch configuration.
 */
export const DEFAULT_STORE_BATCH_CONFIG: Required<StoreBatchConfig> = {
  batchSize: 1000,
}

/**
 * Result of flushing a batch to staging table.
 */
export interface FlushResult {
  /** Number of rows successfully inserted */
  insertedCount: number
  /** Target table name */
  table: string
  /** Flush duration in milliseconds */
  durationMs: number
}

/**
 * Result of flushing staging to production.
 */
export interface StagingFlushResult {
  /** Sessions flushed to production */
  sessionsInserted: number
  /** Messages flushed to production */
  messagesInserted: number
  /** Tool calls flushed to production */
  toolCallsInserted: number
  /** Progress events flushed to production */
  progressEventsInserted: number
  /** Queue operations flushed to production */
  queueOperationsInserted: number
  /** System events flushed to production */
  systemEventsInserted: number
  /** File history entries flushed to production */
  fileHistoryInserted: number
  /** Total flush duration in milliseconds */
  durationMs: number
}

/**
 * Aggregated statistics for a complete ingestion run.
 */
export interface IngestionStats {
  /** Session ID being processed */
  sessionId: string
  /** Total entries processed from JSONL */
  totalEntriesProcessed: number
  /** Entries inserted to staging tables */
  totalStagingInserts: number
  /** Rows flushed to production tables */
  totalProductionInserts: number
  /** Batches accumulated before flush */
  batchCount: number
  /** Parse errors (from parser) */
  parseErrors: number
  /** Entries skipped during routing */
  entriesSkipped: number
  /** Total ingestion duration in milliseconds */
  totalDurationMs: number
  /** Ingestion start timestamp */
  startedAt: Date
  /** Ingestion end timestamp */
  completedAt: Date
}

// ============================================================================
// ROW TYPES
// ============================================================================

/**
 * Row types for staging table inserts.
 * Mirrors staging table schemas from 002_staging migration.
 */

export interface SessionStagingRow {
  id: string
  project_path: string
  started_at: Date
  ended_at?: Date | null
  status: string
  title?: string | null
  custom_title?: string | null
  version?: string | null
  slug?: string | null
  cwd?: string | null
  git_branch?: string | null
  user_type?: string | null
  parent_session_id?: string | null
  is_sidechain: boolean
  leaf_uuid?: string | null
  total_messages: number
  total_tokens: number
}

export interface MessageStagingRow {
  id: string
  session_id: string
  timestamp: Date
  role: string
  content: string
  token_count?: number | null
  parent_uuid?: string | null
  uuid?: string | null
  request_id?: string | null
  message_id?: string | null
  model?: string | null
  stop_reason?: string | null
  stop_sequence?: string | null
  is_meta: boolean
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  ephemeral_5m_input_tokens?: number | null
  ephemeral_1h_input_tokens?: number | null
  service_tier?: string | null
  sequence_number?: number | null
}

export interface ToolCallStagingRow {
  id: string
  message_id: string
  session_id: string
  type: string
  input: Record<string, unknown>
  timestamp: Date
  duration_ms?: number | null
  result_file_path?: string | null
  result_truncated: boolean
}

export interface ProgressEventStagingRow {
  id: string
  session_id: string
  message_id?: string | null
  timestamp: Date
  hook_event?: string | null
  hook_name?: string | null
  command?: string | null
  tool_use_id?: string | null
  parent_tool_use_id?: string | null
  uuid?: string | null
  parent_uuid?: string | null
}

export interface QueueOperationStagingRow {
  id: string
  session_id: string
  timestamp: Date
  operation: string
  content: string
}

export interface SystemEventStagingRow {
  id: string
  session_id: string
  timestamp: Date
  subtype: string
  is_meta: boolean
  duration_ms?: number | null
  uuid?: string | null
  parent_uuid?: string | null
}

export interface FileHistoryStagingRow {
  id: string
  session_id: string
  message_id?: string | null
  timestamp: Date
  tracked_files: unknown
  is_snapshot_update: boolean
}

/**
 * Union type for all staging row types.
 */
export type AnyStagingRow =
  | SessionStagingRow
  | MessageStagingRow
  | ToolCallStagingRow
  | ProgressEventStagingRow
  | QueueOperationStagingRow
  | SystemEventStagingRow
  | FileHistoryStagingRow
