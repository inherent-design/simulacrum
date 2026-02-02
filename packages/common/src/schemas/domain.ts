/**
 * @module schemas/domain
 * @description Effect Schema definitions for all 9 database tables
 *
 * These schemas provide runtime validation, encode/decode, and type generation
 * for the core domain model persisted to TimescaleDB.
 */

import { Schema as S } from 'effect'

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Session status enumeration.
 * - active: Currently in use or recently used
 * - pruned: Content pruned for storage optimization
 * - compacted: Fully compacted, minimal metadata retained
 */
export const SessionStatus = S.Literal('active', 'pruned', 'compacted')
export type SessionStatus = S.Schema.Type<typeof SessionStatus>

/**
 * Message role enumeration.
 */
export const MessageRole = S.Literal('user', 'assistant')
export type MessageRole = S.Schema.Type<typeof MessageRole>

/**
 * Queue operation type enumeration.
 */
export const QueueOperationType = S.Literal('enqueue', 'dequeue')
export type QueueOperationType = S.Schema.Type<typeof QueueOperationType>

// ============================================================================
// Session Schema
// ============================================================================

/**
 * Session database table schema.
 *
 * Field sources:
 * - id: UUID extracted from {uuid}.jsonl filename
 * - project_path: Parent directory of JSONL file
 * - started_at: First entry timestamp
 * - title: From summary entry (auto-generated)
 * - custom_title: From custom-title entry (user-assigned)
 * - version, slug, cwd, git_branch, user_type: From first user message metadata
 */
export class Session extends S.Class<Session>('Session')({
  // Primary key
  id: S.String.pipe(S.brand('SessionId')),

  // Required fields
  project_path: S.String,
  started_at: S.Date,
  status: SessionStatus,
  is_sidechain: S.Boolean,
  total_messages: S.Number.pipe(S.int(), S.nonNegative()),
  total_tokens: S.Number.pipe(S.int(), S.nonNegative()),
  created_at: S.Date,
  updated_at: S.Date,

  // Nullable fields (from JSONL metadata)
  ended_at: S.optionalWith(S.Date, { nullable: true }),
  title: S.optionalWith(S.String, { nullable: true }),
  custom_title: S.optionalWith(S.String, { nullable: true }),
  version: S.optionalWith(S.String, { nullable: true }),
  slug: S.optionalWith(S.String, { nullable: true }),
  cwd: S.optionalWith(S.String, { nullable: true }),
  git_branch: S.optionalWith(S.String, { nullable: true }),
  user_type: S.optionalWith(S.String, { nullable: true }),
  parent_session_id: S.optionalWith(S.String.pipe(S.brand('SessionId')), { nullable: true }),
  leaf_uuid: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
}) {}

// ============================================================================
// Message Schema
// ============================================================================

/**
 * Message database table schema.
 *
 * Field sources:
 * - id: Generated UUID during ingestion
 * - content: From message.content (concatenated for multi-block)
 * - token fields: From message.usage breakdown
 * - model, stop_reason: From assistant entry metadata
 */
export class Message extends S.Class<Message>('Message')({
  // Primary key
  id: S.String.pipe(S.brand('MessageId')),

  // Required fields
  session_id: S.String.pipe(S.brand('SessionId')),
  timestamp: S.Date,
  role: MessageRole,
  content: S.String,
  is_meta: S.Boolean,
  created_at: S.Date,

  // Nullable fields
  token_count: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
  parent_uuid: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
  uuid: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
  request_id: S.optionalWith(S.String, { nullable: true }),
  message_id: S.optionalWith(S.String, { nullable: true }),
  model: S.optionalWith(S.String, { nullable: true }),
  stop_reason: S.optionalWith(S.String, { nullable: true }),
  stop_sequence: S.optionalWith(S.String, { nullable: true }),

  // Token usage breakdown (from message.usage)
  input_tokens: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
  output_tokens: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
  cache_creation_input_tokens: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), {
    nullable: true,
  }),
  cache_read_input_tokens: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), {
    nullable: true,
  }),
  ephemeral_5m_input_tokens: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), {
    nullable: true,
  }),
  ephemeral_1h_input_tokens: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), {
    nullable: true,
  }),
  service_tier: S.optionalWith(S.String, { nullable: true }),

  // Ordering
  sequence_number: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
}) {}

// ============================================================================
// ToolCall Schema
// ============================================================================

/**
 * ToolCall database table schema.
 *
 * Field sources:
 * - id: From tool_use.id (Anthropic toolu_ prefix)
 * - type: From tool_use.name (Read, Write, Bash, etc.)
 * - input: JSONB of tool parameters
 * - duration_ms: Computed from progress events
 */
export class ToolCall extends S.Class<ToolCall>('ToolCall')({
  // Primary key
  id: S.String.pipe(S.brand('ToolCallId')),

  // Required fields
  message_id: S.String.pipe(S.brand('MessageId')),
  session_id: S.String.pipe(S.brand('SessionId')),
  type: S.String,
  input: S.Record({ key: S.String, value: S.Unknown }),
  timestamp: S.Date,
  result_truncated: S.Boolean,
  created_at: S.Date,

  // Nullable fields
  duration_ms: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
  result_file_path: S.optionalWith(S.String, { nullable: true }),
}) {}

// ============================================================================
// Agent Schema
// ============================================================================

/**
 * Agent (subagent) database table schema.
 *
 * Field sources:
 * - id: Generated UUID (primary key)
 * - agent_id: Short hex from directory name (agent-a13a7a3.jsonl)
 * - depth: Nesting level (1 = direct child of main session)
 */
export class Agent extends S.Class<Agent>('Agent')({
  // Primary key
  id: S.String.pipe(S.brand('MessageId')),

  // Required fields
  session_id: S.String.pipe(S.brand('SessionId')),
  is_sidechain: S.Boolean,
  created_at: S.Date,
  total_messages: S.Number.pipe(S.int(), S.nonNegative()),
  depth: S.Number.pipe(S.int(), S.nonNegative()),

  // Nullable fields
  parent_agent_id: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
  agent_id: S.optionalWith(S.String.pipe(S.brand('AgentId')), { nullable: true }),
  ended_at: S.optionalWith(S.Date, { nullable: true }),
}) {}

// ============================================================================
// FileHistory Schema
// ============================================================================

/**
 * FileHistory database table schema.
 *
 * Stores file-history-snapshot entries that track file state at message boundaries.
 */
export class FileHistory extends S.Class<FileHistory>('FileHistory')({
  // Primary key
  id: S.String.pipe(S.brand('MessageId')),

  // Required fields
  session_id: S.String.pipe(S.brand('SessionId')),
  timestamp: S.Date,
  tracked_files: S.Record({ key: S.String, value: S.Unknown }),
  is_snapshot_update: S.Boolean,
  created_at: S.Date,

  // Nullable fields
  message_id: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
}) {}

// ============================================================================
// Fork Schema
// ============================================================================

/**
 * Fork database table schema.
 *
 * Records session branching/forking relationships.
 */
export class Fork extends S.Class<Fork>('Fork')({
  // Primary key
  id: S.String.pipe(S.brand('MessageId')),

  // Required fields
  parent_session_id: S.String.pipe(S.brand('SessionId')),
  child_session_id: S.String.pipe(S.brand('SessionId')),
  created_at: S.Date,

  // Nullable fields
  fork_point_message_id: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
}) {}

// ============================================================================
// ProgressEvent Schema
// ============================================================================

/**
 * ProgressEvent database table schema.
 *
 * Progress events constitute 60-70% of JSONL volume.
 * Stored separately from messages to keep messages table lean.
 */
export class ProgressEvent extends S.Class<ProgressEvent>('ProgressEvent')({
  // Primary key
  id: S.String.pipe(S.brand('MessageId')),

  // Required fields
  session_id: S.String.pipe(S.brand('SessionId')),
  timestamp: S.Date,

  // Nullable fields
  message_id: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
  hook_event: S.optionalWith(S.String, { nullable: true }),
  hook_name: S.optionalWith(S.String, { nullable: true }),
  command: S.optionalWith(S.String, { nullable: true }),
  tool_use_id: S.optionalWith(S.String, { nullable: true }),
  parent_tool_use_id: S.optionalWith(S.String, { nullable: true }),
  uuid: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
  parent_uuid: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
}) {}

// ============================================================================
// QueueOperation Schema
// ============================================================================

/**
 * QueueOperation database table schema.
 *
 * Records user-queued tasks (enqueue/dequeue operations).
 */
export class QueueOperation extends S.Class<QueueOperation>('QueueOperation')({
  // Primary key
  id: S.String.pipe(S.brand('MessageId')),

  // Required fields
  session_id: S.String.pipe(S.brand('SessionId')),
  timestamp: S.Date,
  operation: QueueOperationType,
  content: S.String,
}) {}

// ============================================================================
// SystemEvent Schema
// ============================================================================

/**
 * SystemEvent database table schema.
 *
 * Telemetry events (turn_duration, etc.).
 */
export class SystemEvent extends S.Class<SystemEvent>('SystemEvent')({
  // Primary key
  id: S.String.pipe(S.brand('MessageId')),

  // Required fields
  session_id: S.String.pipe(S.brand('SessionId')),
  timestamp: S.Date,
  subtype: S.String,
  is_meta: S.Boolean,

  // Nullable fields
  duration_ms: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
  uuid: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
  parent_uuid: S.optionalWith(S.String.pipe(S.brand('MessageId')), { nullable: true }),
}) {}
