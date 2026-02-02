/**
 * @module schemas/transport
 * @description Effect Schema definitions for API request/response contracts
 *
 * These schemas define the HTTP transport layer contracts for the Hono API.
 * Used by @hono/effect-validator for middleware validation and Hono client
 * for type-safe responses.
 */

import { Schema as S } from 'effect'
import {
  Session,
  Message,
  ToolCall,
  Agent,
  FileHistory,
  Fork,
  SessionStatus,
  MessageRole,
} from './domain.js'

// ============================================================================
// Pagination
// ============================================================================

/**
 * Standard pagination parameters for list endpoints.
 */
export class PaginationParams extends S.Class<PaginationParams>('PaginationParams')({
  limit: S.Number.pipe(S.int(), S.positive(), S.lessThanOrEqualTo(1000)),
  offset: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

// ============================================================================
// Session API Contracts
// ============================================================================

/**
 * GET /sessions query parameters.
 * Uses NumberFromString for HTTP query string parsing.
 */
export class ListSessionsRequest extends S.Class<ListSessionsRequest>('ListSessionsRequest')({
  limit: S.optional(S.NumberFromString.pipe(S.int(), S.positive(), S.lessThanOrEqualTo(100))),
  offset: S.optional(S.NumberFromString.pipe(S.int(), S.nonNegative())),
  project_path: S.optional(S.String),
  status: S.optional(SessionStatus),
  started_after: S.optional(S.String), // ISO 8601 date string
  started_before: S.optional(S.String), // ISO 8601 date string
}) {}

/**
 * GET /sessions response body.
 */
export class ListSessionsResponse extends S.Class<ListSessionsResponse>('ListSessionsResponse')({
  sessions: S.Array(Session),
  total: S.Number.pipe(S.int(), S.nonNegative()),
  limit: S.Number.pipe(S.int(), S.positive()),
  offset: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

/**
 * GET /sessions/:id response body.
 */
export class GetSessionResponse extends S.Class<GetSessionResponse>('GetSessionResponse')({
  session: Session,
  message_count: S.Number.pipe(S.int(), S.nonNegative()),
  agent_count: S.Number.pipe(S.int(), S.nonNegative()),
  tool_call_count: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

// ============================================================================
// Message API Contracts
// ============================================================================

/**
 * GET /sessions/:id/messages query parameters.
 */
export class ListMessagesRequest extends S.Class<ListMessagesRequest>('ListMessagesRequest')({
  limit: S.optional(S.NumberFromString.pipe(S.int(), S.positive(), S.lessThanOrEqualTo(500))),
  offset: S.optional(S.NumberFromString.pipe(S.int(), S.nonNegative())),
  role: S.optional(MessageRole),
  model: S.optional(S.String),
  include_tool_calls: S.optional(S.Literal('true', 'false')),
}) {}

/**
 * Message with embedded tool calls for detailed views.
 */
export class MessageWithToolCalls extends S.Class<MessageWithToolCalls>('MessageWithToolCalls')({
  ...Message.fields,
  tool_calls: S.Array(ToolCall),
}) {}

/**
 * GET /sessions/:id/messages response body.
 */
export class ListMessagesResponse extends S.Class<ListMessagesResponse>('ListMessagesResponse')({
  messages: S.Array(MessageWithToolCalls),
  total: S.Number.pipe(S.int(), S.nonNegative()),
  limit: S.Number.pipe(S.int(), S.positive()),
  offset: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

// ============================================================================
// Timeline API Contracts
// ============================================================================

/**
 * Single point in timeline visualization (for visx).
 * timestamp is Unix milliseconds for chart compatibility.
 */
export class TimelinePoint extends S.Class<TimelinePoint>('TimelinePoint')({
  timestamp: S.Number, // Unix milliseconds
  user_count: S.Number.pipe(S.int(), S.nonNegative()),
  assistant_count: S.Number.pipe(S.int(), S.nonNegative()),
  tool_call_count: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

/**
 * GET /sessions/:id/timeline response body.
 */
export class TimelineResponse extends S.Class<TimelineResponse>('TimelineResponse')({
  session_id: S.String,
  points: S.Array(TimelinePoint),
  time_range: S.Struct({
    start: S.Number,
    end: S.Number,
  }),
}) {}

// ============================================================================
// Agent API Contracts
// ============================================================================

/**
 * GET /sessions/:id/agents response body.
 */
export class ListAgentsResponse extends S.Class<ListAgentsResponse>('ListAgentsResponse')({
  agents: S.Array(Agent),
  total: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

// ============================================================================
// File History API Contracts
// ============================================================================

/**
 * GET /sessions/:id/files response body.
 */
export class ListFileHistoryResponse extends S.Class<ListFileHistoryResponse>(
  'ListFileHistoryResponse'
)({
  snapshots: S.Array(FileHistory),
  total: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

// ============================================================================
// Fork API Contracts
// ============================================================================

/**
 * Recursive tree structure for fork visualization.
 * Uses Struct with S.suspend for lazy recursive type definition.
 */
export interface ForkTree {
  readonly session_id: string
  readonly title?: string | undefined
  readonly children: readonly ForkTree[]
}

export const ForkTree: S.Schema<ForkTree> = S.Struct({
  session_id: S.String,
  title: S.optional(S.String),
  children: S.Array(S.suspend((): S.Schema<ForkTree> => ForkTree)),
})

/**
 * GET /sessions/:id/forks response body.
 */
export class GetForksResponse extends S.Class<GetForksResponse>('GetForksResponse')({
  forks: S.Array(Fork),
  tree: ForkTree,
}) {}

// ============================================================================
// Analytics API Contracts
// ============================================================================

/**
 * Daily aggregated message counts (from TimescaleDB continuous aggregate).
 */
export class DailyMessageCount extends S.Class<DailyMessageCount>('DailyMessageCount')({
  day: S.Date,
  session_id: S.String,
  role: MessageRole,
  message_count: S.Number.pipe(S.int(), S.nonNegative()),
  total_tokens: S.Number.pipe(S.int(), S.nonNegative()),
  avg_tokens_per_message: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

/**
 * GET /analytics/daily response body.
 */
export class DailyAnalyticsResponse extends S.Class<DailyAnalyticsResponse>(
  'DailyAnalyticsResponse'
)({
  data: S.Array(DailyMessageCount),
  start_date: S.Date,
  end_date: S.Date,
}) {}

/**
 * Hourly aggregated tool call statistics (from TimescaleDB continuous aggregate).
 */
export class HourlyToolCallStat extends S.Class<HourlyToolCallStat>('HourlyToolCallStat')({
  hour: S.Date,
  tool_type: S.String,
  call_count: S.Number.pipe(S.int(), S.nonNegative()),
  avg_duration_ms: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
  max_duration_ms: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
  truncated_count: S.Number.pipe(S.int(), S.nonNegative()),
}) {}

/**
 * GET /analytics/tools response body.
 */
export class ToolAnalyticsResponse extends S.Class<ToolAnalyticsResponse>('ToolAnalyticsResponse')({
  data: S.Array(HourlyToolCallStat),
  start_date: S.Date,
  end_date: S.Date,
}) {}

// ============================================================================
// Ingestion API Contracts
// ============================================================================

/**
 * POST /ingest/start request body.
 */
export class IngestionStartRequest extends S.Class<IngestionStartRequest>('IngestionStartRequest')({
  source_path: S.optional(S.String),
  project_filter: S.optional(S.String),
  since: S.optional(S.String), // ISO 8601 date string
  dry_run: S.optional(S.Literal('true', 'false')),
}) {}

/**
 * POST /ingest/start response body.
 */
export class IngestionStartResponse extends S.Class<IngestionStartResponse>(
  'IngestionStartResponse'
)({
  ingestion_id: S.String,
  status: S.Literal('started', 'already_running'),
  estimated_sessions: S.optionalWith(S.Number.pipe(S.int(), S.nonNegative()), { nullable: true }),
}) {}

/**
 * GET /ingest/status response body.
 */
export class IngestionStatusResponse extends S.Class<IngestionStatusResponse>(
  'IngestionStatusResponse'
)({
  ingestion_id: S.String,
  status: S.Literal('running', 'completed', 'failed', 'idle'),
  progress: S.Struct({
    sessions_discovered: S.Number.pipe(S.int(), S.nonNegative()),
    sessions_processed: S.Number.pipe(S.int(), S.nonNegative()),
    messages_inserted: S.Number.pipe(S.int(), S.nonNegative()),
    tool_calls_inserted: S.Number.pipe(S.int(), S.nonNegative()),
    errors: S.Number.pipe(S.int(), S.nonNegative()),
  }),
  started_at: S.optionalWith(S.Date, { nullable: true }),
  completed_at: S.optionalWith(S.Date, { nullable: true }),
  error: S.optionalWith(S.String, { nullable: true }),
}) {}
