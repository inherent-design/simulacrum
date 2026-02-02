/**
 * @module db/types
 * @description Database type definitions mapping Effect schemas to Kysely row types.
 *
 * These types define the database table structures for Kysely's type-safe query builder.
 * The interfaces correspond to the 9 core tables plus 4 staging tables plus 4 continuous aggregate views.
 */

import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import type {
  SessionStatus,
  MessageRole,
  QueueOperationType,
} from '@inherent.design/simulacrum-common'

// ============================================================================
// TABLE ROW TYPES
// ============================================================================

/**
 * Sessions table structure.
 * Primary table for Claude Code session metadata.
 */
export interface SessionsTable {
  id: string
  project_path: string
  started_at: Date
  ended_at: Date | null
  status: SessionStatus
  title: string | null
  custom_title: string | null
  version: string | null
  slug: string | null
  cwd: string | null
  git_branch: string | null
  user_type: string | null
  parent_session_id: string | null
  is_sidechain: boolean
  leaf_uuid: string | null
  total_messages: number
  total_tokens: number
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

/**
 * Messages table structure.
 * TimescaleDB hypertable for time-series message data.
 */
export interface MessagesTable {
  id: string
  session_id: string
  timestamp: Date
  role: MessageRole
  content: string
  token_count: number | null
  parent_uuid: string | null
  uuid: string | null
  request_id: string | null
  message_id: string | null
  model: string | null
  stop_reason: string | null
  stop_sequence: string | null
  is_meta: boolean
  input_tokens: number | null
  output_tokens: number | null
  cache_creation_input_tokens: number | null
  cache_read_input_tokens: number | null
  ephemeral_5m_input_tokens: number | null
  ephemeral_1h_input_tokens: number | null
  service_tier: string | null
  sequence_number: number | null
  created_at: Generated<Date>
}

/**
 * Tool calls table structure.
 * TimescaleDB hypertable for tool invocation tracking.
 */
export interface ToolCallsTable {
  id: string
  message_id: string
  session_id: string
  type: string
  input: Record<string, unknown>
  timestamp: Date
  duration_ms: number | null
  result_file_path: string | null
  result_truncated: boolean
  created_at: Generated<Date>
}

/**
 * Agents table structure.
 * Tracks subagent spawning and hierarchy.
 */
export interface AgentsTable {
  id: Generated<string>
  session_id: string
  parent_agent_id: string | null
  agent_id: string | null
  is_sidechain: boolean
  created_at: Date
  ended_at: Date | null
  total_messages: number
  depth: number
}

/**
 * File history table structure.
 * Tracks file state at message boundaries via file-history-snapshot entries.
 */
export interface FileHistoryTable {
  id: Generated<string>
  session_id: string
  message_id: string | null
  timestamp: Date
  tracked_files: Record<string, unknown>
  is_snapshot_update: boolean
  created_at: Generated<Date>
}

/**
 * Forks table structure.
 * Records session branching relationships.
 */
export interface ForksTable {
  id: Generated<string>
  parent_session_id: string
  child_session_id: string
  fork_point_message_id: string | null
  created_at: Generated<Date>
}

/**
 * Progress events table structure.
 * TimescaleDB hypertable for hook execution events (60-70% of JSONL volume).
 */
export interface ProgressEventsTable {
  id: Generated<string>
  session_id: string
  message_id: string | null
  timestamp: Date
  hook_event: string | null
  hook_name: string | null
  command: string | null
  tool_use_id: string | null
  parent_tool_use_id: string | null
  uuid: string | null
  parent_uuid: string | null
}

/**
 * Queue operations table structure.
 * Records user-queued tasks (enqueue/dequeue operations).
 */
export interface QueueOperationsTable {
  id: Generated<string>
  session_id: string
  timestamp: Date
  operation: QueueOperationType
  content: string
}

/**
 * System events table structure.
 * Telemetry events (turn_duration, etc.).
 */
export interface SystemEventsTable {
  id: Generated<string>
  session_id: string
  timestamp: Date
  subtype: string
  duration_ms: number | null
  uuid: string | null
  parent_uuid: string | null
  is_meta: boolean
}

/**
 * Ingestion state table structure.
 * Stores cursor position and ingestion metadata for incremental processing.
 */
export interface IngestionStateTable {
  key: string
  value: Record<string, unknown>
  updated_at: Generated<Date>
}

// ============================================================================
// STAGING TABLES (same structure, no constraints)
// ============================================================================

/**
 * Sessions staging table for batch ingestion.
 * UNLOGGED for performance - no WAL writes.
 */
export interface SessionsStagingTable {
  id: string
  project_path: string
  started_at: Date
  ended_at: Date | null
  status: string
  title: string | null
  custom_title: string | null
  version: string | null
  slug: string | null
  cwd: string | null
  git_branch: string | null
  user_type: string | null
  parent_session_id: string | null
  is_sidechain: boolean
  leaf_uuid: string | null
  total_messages: number
  total_tokens: number
}

/**
 * Messages staging table for batch ingestion.
 * UNLOGGED for performance.
 */
export interface MessagesStagingTable {
  id: string
  session_id: string
  timestamp: Date
  role: string
  content: string
  token_count: number | null
  parent_uuid: string | null
  uuid: string | null
  request_id: string | null
  message_id: string | null
  model: string | null
  stop_reason: string | null
  stop_sequence: string | null
  is_meta: boolean
  input_tokens: number | null
  output_tokens: number | null
  cache_creation_input_tokens: number | null
  cache_read_input_tokens: number | null
  ephemeral_5m_input_tokens: number | null
  ephemeral_1h_input_tokens: number | null
  service_tier: string | null
  sequence_number: number | null
}

/**
 * Tool calls staging table for batch ingestion.
 * UNLOGGED for performance.
 */
export interface ToolCallsStagingTable {
  id: string
  message_id: string
  session_id: string
  type: string
  input: Record<string, unknown>
  timestamp: Date
  duration_ms: number | null
  result_file_path: string | null
  result_truncated: boolean
}

/**
 * Progress events staging table for batch ingestion.
 * UNLOGGED for performance.
 */
export interface ProgressEventsStagingTable {
  id: string
  session_id: string
  message_id: string | null
  timestamp: Date
  hook_event: string | null
  hook_name: string | null
  command: string | null
  tool_use_id: string | null
  parent_tool_use_id: string | null
  uuid: string | null
  parent_uuid: string | null
}

// ============================================================================
// CONTINUOUS AGGREGATE VIEWS
// ============================================================================

/**
 * Daily message counts continuous aggregate.
 * Pre-computed daily statistics per session and role.
 */
export interface DailyMessageCountsView {
  day: Date
  session_id: string
  role: MessageRole
  message_count: number
  total_tokens: number
  avg_tokens_per_message: number
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_creation_tokens: number
}

/**
 * Hourly tool call statistics continuous aggregate.
 * Pre-computed hourly tool usage metrics.
 */
export interface HourlyToolCallStatsView {
  hour: Date
  tool_type: string
  call_count: number
  avg_duration_ms: number | null
  max_duration_ms: number | null
  min_duration_ms: number | null
  truncated_count: number
}

/**
 * Session activity summary continuous aggregate.
 * Pre-computed daily session activity by project path.
 */
export interface SessionActivitySummaryView {
  day: Date
  project_path: string
  status: SessionStatus
  session_count: number
  total_messages: number
  total_tokens: number
  avg_messages_per_session: number
}

/**
 * Daily model usage continuous aggregate.
 * Pre-computed daily token usage by model.
 */
export interface DailyModelUsageView {
  day: Date
  model: string
  message_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_creation_tokens: number
}

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

/**
 * Complete database interface for Kysely.
 * Maps all table names to their type definitions.
 */
export interface Database {
  // Core tables
  sessions: SessionsTable
  messages: MessagesTable
  tool_calls: ToolCallsTable
  agents: AgentsTable
  file_history: FileHistoryTable
  forks: ForksTable
  progress_events: ProgressEventsTable
  queue_operations: QueueOperationsTable
  system_events: SystemEventsTable
  ingestion_state: IngestionStateTable

  // Staging tables (UNLOGGED)
  sessions_staging: SessionsStagingTable
  messages_staging: MessagesStagingTable
  tool_calls_staging: ToolCallsStagingTable
  progress_events_staging: ProgressEventsStagingTable

  // Continuous aggregate views
  daily_message_counts: DailyMessageCountsView
  hourly_tool_call_stats: HourlyToolCallStatsView
  session_activity_summary: SessionActivitySummaryView
  daily_model_usage: DailyModelUsageView
}

// ============================================================================
// ROW TYPE ALIASES
// ============================================================================

export type SessionRow = Selectable<SessionsTable>
export type NewSession = Insertable<SessionsTable>
export type SessionUpdate = Updateable<SessionsTable>

export type MessageRow = Selectable<MessagesTable>
export type NewMessage = Insertable<MessagesTable>
export type MessageUpdate = Updateable<MessagesTable>

export type ToolCallRow = Selectable<ToolCallsTable>
export type NewToolCall = Insertable<ToolCallsTable>

export type AgentRow = Selectable<AgentsTable>
export type NewAgent = Insertable<AgentsTable>

export type FileHistoryRow = Selectable<FileHistoryTable>
export type NewFileHistory = Insertable<FileHistoryTable>

export type ForkRow = Selectable<ForksTable>
export type NewFork = Insertable<ForksTable>

export type ProgressEventRow = Selectable<ProgressEventsTable>
export type NewProgressEvent = Insertable<ProgressEventsTable>

export type QueueOperationRow = Selectable<QueueOperationsTable>
export type NewQueueOperation = Insertable<QueueOperationsTable>

export type SystemEventRow = Selectable<SystemEventsTable>
export type NewSystemEvent = Insertable<SystemEventsTable>
