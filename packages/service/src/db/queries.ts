/**
 * @module db/queries
 * @description Common query builders for API routes with type-safe pagination and filtering.
 *
 * Query patterns:
 * - Pagination via PaginatedResult with offset/limit
 * - Parallel count fetching with Promise.all
 * - Two-query pattern for messages+tool_calls (avoids row multiplication)
 * - Timeline data suitable for visx visualization
 */

import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { Database, SessionRow, MessageRow, ToolCallRow, AgentRow } from './types.ts'
import type { SessionStatus, MessageRole } from '@inherent.design/simulacrum-common'

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Pagination parameters for list queries.
 */
export interface PaginationParams {
  limit: number
  offset: number
}

/**
 * Paginated result wrapper with total count.
 */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

// ============================================================================
// SESSION QUERIES
// ============================================================================

/**
 * Filter options for session queries.
 */
export interface SessionFilters {
  projectPath?: string
  status?: SessionStatus
  startedAfter?: Date
  startedBefore?: Date
}

/**
 * Get paginated sessions with optional filters.
 * Uses covering index sessions_list_idx for efficiency.
 *
 * @param db - Kysely database client
 * @param pagination - Limit and offset parameters
 * @param filters - Optional filter conditions
 * @returns Paginated session rows with total count
 */
export const getSessions = async (
  db: Kysely<Database>,
  pagination: PaginationParams,
  filters?: SessionFilters
): Promise<PaginatedResult<SessionRow>> => {
  let query = db.selectFrom('sessions').selectAll()
  let countQuery = db.selectFrom('sessions').select(db.fn.count<number>('id').as('count'))

  // Apply filters conditionally
  if (filters?.projectPath) {
    query = query.where('project_path', '=', filters.projectPath)
    countQuery = countQuery.where('project_path', '=', filters.projectPath)
  }

  if (filters?.status) {
    query = query.where('status', '=', filters.status)
    countQuery = countQuery.where('status', '=', filters.status)
  }

  if (filters?.startedAfter) {
    query = query.where('started_at', '>=', filters.startedAfter)
    countQuery = countQuery.where('started_at', '>=', filters.startedAfter)
  }

  if (filters?.startedBefore) {
    query = query.where('started_at', '<=', filters.startedBefore)
    countQuery = countQuery.where('started_at', '<=', filters.startedBefore)
  }

  // Execute queries in parallel
  const [data, totalResult] = await Promise.all([
    query.orderBy('started_at', 'desc').limit(pagination.limit).offset(pagination.offset).execute(),
    countQuery.executeTakeFirstOrThrow(),
  ])

  return {
    data,
    total: totalResult.count,
    limit: pagination.limit,
    offset: pagination.offset,
  }
}

/**
 * Session with aggregate counts for detail view.
 */
export interface SessionWithCounts {
  session: SessionRow
  messageCount: number
  agentCount: number
  toolCallCount: number
}

/**
 * Get session by ID with aggregate counts.
 * Returns null if session not found.
 *
 * @param db - Kysely database client
 * @param sessionId - Session UUID
 * @returns Session with counts or null if not found
 */
export const getSessionById = async (
  db: Kysely<Database>,
  sessionId: string
): Promise<SessionWithCounts | null> => {
  const session = await db
    .selectFrom('sessions')
    .where('id', '=', sessionId)
    .selectAll()
    .executeTakeFirst()

  if (!session) {
    return null
  }

  // Fetch counts in parallel
  const [messageCount, agentCount, toolCallCount] = await Promise.all([
    db
      .selectFrom('messages')
      .where('session_id', '=', sessionId)
      .select(db.fn.count<number>('id').as('count'))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('agents')
      .where('session_id', '=', sessionId)
      .select(db.fn.count<number>('id').as('count'))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('tool_calls')
      .where('session_id', '=', sessionId)
      .select(db.fn.count<number>('id').as('count'))
      .executeTakeFirstOrThrow(),
  ])

  return {
    session,
    messageCount: messageCount.count,
    agentCount: agentCount.count,
    toolCallCount: toolCallCount.count,
  }
}

// ============================================================================
// MESSAGE QUERIES
// ============================================================================

/**
 * Filter options for message queries.
 */
export interface MessageFilters {
  role?: MessageRole
  model?: string
  afterTimestamp?: Date
  beforeTimestamp?: Date
}

/**
 * Message row with associated tool calls.
 */
export interface MessageWithToolCalls extends MessageRow {
  tool_calls: ToolCallRow[]
}

/**
 * Get paginated messages for a session with optional tool calls.
 * Uses index messages_session_timeline_idx.
 *
 * Two-query pattern to avoid row multiplication from JOINs:
 * 1. Fetch messages with pagination
 * 2. Fetch tool calls for returned message IDs
 * 3. Group tool calls by message ID in application code
 *
 * @param db - Kysely database client
 * @param sessionId - Session UUID
 * @param pagination - Limit and offset parameters
 * @param filters - Optional filter conditions
 * @param includeToolCalls - Whether to fetch associated tool calls
 * @returns Paginated messages with optional tool calls
 */
export const getMessagesBySession = async (
  db: Kysely<Database>,
  sessionId: string,
  pagination: PaginationParams,
  filters?: MessageFilters,
  includeToolCalls = false
): Promise<PaginatedResult<MessageWithToolCalls>> => {
  let query = db.selectFrom('messages').where('session_id', '=', sessionId).selectAll()

  let countQuery = db
    .selectFrom('messages')
    .where('session_id', '=', sessionId)
    .select(db.fn.count<number>('id').as('count'))

  // Apply filters
  if (filters?.role) {
    query = query.where('role', '=', filters.role)
    countQuery = countQuery.where('role', '=', filters.role)
  }

  if (filters?.model) {
    query = query.where('model', '=', filters.model)
    countQuery = countQuery.where('model', '=', filters.model)
  }

  if (filters?.afterTimestamp) {
    query = query.where('timestamp', '>=', filters.afterTimestamp)
    countQuery = countQuery.where('timestamp', '>=', filters.afterTimestamp)
  }

  if (filters?.beforeTimestamp) {
    query = query.where('timestamp', '<=', filters.beforeTimestamp)
    countQuery = countQuery.where('timestamp', '<=', filters.beforeTimestamp)
  }

  // Execute queries
  const [messages, totalResult] = await Promise.all([
    query.orderBy('timestamp', 'asc').limit(pagination.limit).offset(pagination.offset).execute(),
    countQuery.executeTakeFirstOrThrow(),
  ])

  // Fetch tool calls if requested
  let messagesWithToolCalls: MessageWithToolCalls[]

  if (includeToolCalls && messages.length > 0) {
    const messageIds = messages.map((m) => m.id)
    const toolCalls = await db
      .selectFrom('tool_calls')
      .where('message_id', 'in', messageIds)
      .selectAll()
      .orderBy('timestamp', 'asc')
      .execute()

    // Group tool calls by message ID
    const toolCallsByMessage = new Map<string, ToolCallRow[]>()
    for (const tc of toolCalls) {
      const existing = toolCallsByMessage.get(tc.message_id) ?? []
      existing.push(tc)
      toolCallsByMessage.set(tc.message_id, existing)
    }

    messagesWithToolCalls = messages.map((m) => ({
      ...m,
      tool_calls: toolCallsByMessage.get(m.id) ?? [],
    }))
  } else {
    messagesWithToolCalls = messages.map((m) => ({ ...m, tool_calls: [] }))
  }

  return {
    data: messagesWithToolCalls,
    total: totalResult.count,
    limit: pagination.limit,
    offset: pagination.offset,
  }
}

// ============================================================================
// AGENT QUERIES
// ============================================================================

/**
 * Get all agents for a session with hierarchy information.
 * Ordered by creation time.
 *
 * @param db - Kysely database client
 * @param sessionId - Session UUID
 * @returns Agent rows ordered by created_at
 */
export const getAgentsBySession = async (
  db: Kysely<Database>,
  sessionId: string
): Promise<AgentRow[]> => {
  return db
    .selectFrom('agents')
    .where('session_id', '=', sessionId)
    .selectAll()
    .orderBy('created_at', 'asc')
    .execute()
}

/**
 * Get agent hierarchy as a tree structure.
 * Groups agents by parent_agent_id for tree construction in the UI.
 *
 * @param db - Kysely database client
 * @param sessionId - Session UUID
 * @returns Map of parent_agent_id -> child agents (null key for root agents)
 */
export const getAgentHierarchy = async (
  db: Kysely<Database>,
  sessionId: string
): Promise<Map<string | null, AgentRow[]>> => {
  const agents = await getAgentsBySession(db, sessionId)

  // Group by parent_agent_id for tree construction
  const hierarchy = new Map<string | null, AgentRow[]>()
  for (const agent of agents) {
    const parentId = agent.parent_agent_id
    const siblings = hierarchy.get(parentId) ?? []
    siblings.push(agent)
    hierarchy.set(parentId, siblings)
  }

  return hierarchy
}

// ============================================================================
// TIMELINE QUERIES
// ============================================================================

/**
 * Single point in the timeline visualization.
 * Timestamp is epoch milliseconds for visx compatibility.
 */
export interface TimelinePoint {
  timestamp: number
  userCount: number
  assistantCount: number
  toolCallCount: number
}

/**
 * Complete timeline data for a session.
 */
export interface TimelineData {
  sessionId: string
  points: TimelinePoint[]
  timeRange: {
    start: number
    end: number
  }
}

/**
 * Get timeline data for a session suitable for visx timeline visualization.
 * Aggregates message and tool call counts by timestamp.
 *
 * Returns epoch milliseconds for direct use with visx scales.
 *
 * @param db - Kysely database client
 * @param sessionId - Session UUID
 * @returns Timeline data with points and time range
 */
export const getTimelineData = async (
  db: Kysely<Database>,
  sessionId: string
): Promise<TimelineData> => {
  // Get message counts grouped by timestamp and role
  const messageCounts = await db
    .selectFrom('messages')
    .where('session_id', '=', sessionId)
    .select(['timestamp', 'role', db.fn.count<number>('id').as('count')])
    .groupBy(['timestamp', 'role'])
    .orderBy('timestamp', 'asc')
    .execute()

  // Get tool call counts grouped by timestamp
  const toolCallCounts = await db
    .selectFrom('tool_calls')
    .where('session_id', '=', sessionId)
    .select(['timestamp', db.fn.count<number>('id').as('count')])
    .groupBy('timestamp')
    .orderBy('timestamp', 'asc')
    .execute()

  // Build points map
  const pointsMap = new Map<number, { user: number; assistant: number; tools: number }>()

  for (const row of messageCounts) {
    const ts = new Date(row.timestamp).getTime()
    const existing = pointsMap.get(ts) ?? { user: 0, assistant: 0, tools: 0 }
    if (row.role === 'user') existing.user = row.count
    if (row.role === 'assistant') existing.assistant = row.count
    pointsMap.set(ts, existing)
  }

  for (const row of toolCallCounts) {
    const ts = new Date(row.timestamp).getTime()
    const existing = pointsMap.get(ts) ?? { user: 0, assistant: 0, tools: 0 }
    existing.tools = row.count
    pointsMap.set(ts, existing)
  }

  // Convert to sorted array
  const points: TimelinePoint[] = Array.from(pointsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, counts]) => ({
      timestamp,
      userCount: counts.user,
      assistantCount: counts.assistant,
      toolCallCount: counts.tools,
    }))

  // Calculate time range
  const timestamps = points.map((p) => p.timestamp)
  const timeRange = {
    start: timestamps.length > 0 ? Math.min(...timestamps) : 0,
    end: timestamps.length > 0 ? Math.max(...timestamps) : 0,
  }

  return {
    sessionId,
    points,
    timeRange,
  }
}

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

/**
 * Get daily message counts from continuous aggregate.
 * Uses materialized view daily_message_counts for efficient analytics.
 *
 * @param db - Kysely database client
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 * @param sessionId - Optional filter to specific session
 * @returns Daily message count rows
 */
export const getDailyMessageCounts = async (
  db: Kysely<Database>,
  startDate: Date,
  endDate: Date,
  sessionId?: string
) => {
  let query = db
    .selectFrom('daily_message_counts')
    .where('day', '>=', startDate)
    .where('day', '<=', endDate)
    .selectAll()

  if (sessionId) {
    query = query.where('session_id', '=', sessionId)
  }

  return query.orderBy('day', 'asc').execute()
}

/**
 * Get hourly tool call statistics from continuous aggregate.
 * Uses materialized view hourly_tool_call_stats for efficient analytics.
 *
 * @param db - Kysely database client
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 * @param toolType - Optional filter to specific tool type
 * @returns Hourly tool call stats rows
 */
export const getHourlyToolCallStats = async (
  db: Kysely<Database>,
  startDate: Date,
  endDate: Date,
  toolType?: string
) => {
  let query = db
    .selectFrom('hourly_tool_call_stats')
    .where('hour', '>=', startDate)
    .where('hour', '<=', endDate)
    .selectAll()

  if (toolType) {
    query = query.where('tool_type', '=', toolType)
  }

  return query.orderBy('hour', 'asc').execute()
}

// ============================================================================
// STAGING TABLE OPERATIONS
// ============================================================================

/**
 * Truncate all staging tables.
 * Call before starting a new batch ingestion.
 *
 * Uses SQL function truncate_staging_tables() defined in migrations.
 *
 * @param db - Kysely database client
 */
export const truncateStagingTables = async (db: Kysely<Database>): Promise<void> => {
  await sql`SELECT truncate_staging_tables()`.execute(db)
}

/**
 * Counts of rows flushed from staging to production tables.
 */
export interface FlushResult {
  sessions: number
  messages: number
  toolCalls: number
  progressEvents: number
}

/**
 * Flush staging tables to production.
 * Uses SQL functions for each table defined in migrations.
 *
 * @param db - Kysely database client
 * @returns Counts of inserted rows per table
 */
export const flushStagingTables = async (db: Kysely<Database>): Promise<FlushResult> => {
  const [sessions, messages, toolCalls, progressEvents] = await Promise.all([
    sql<{ inserted_count: number }>`SELECT * FROM flush_sessions_staging()`.execute(db),
    sql<{ inserted_count: number }>`SELECT * FROM flush_messages_staging()`.execute(db),
    sql<{ inserted_count: number }>`SELECT * FROM flush_tool_calls_staging()`.execute(db),
    sql<{ inserted_count: number }>`SELECT * FROM flush_progress_events_staging()`.execute(db),
  ])

  return {
    sessions: sessions.rows[0]?.inserted_count ?? 0,
    messages: messages.rows[0]?.inserted_count ?? 0,
    toolCalls: toolCalls.rows[0]?.inserted_count ?? 0,
    progressEvents: progressEvents.rows[0]?.inserted_count ?? 0,
  }
}
