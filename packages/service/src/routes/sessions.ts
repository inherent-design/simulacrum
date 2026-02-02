/**
 * @module routes/sessions
 * @description Session API routes with Effect Schema validation.
 *
 * Endpoints:
 * - GET /sessions - List sessions with pagination and filters
 * - GET /sessions/:id - Get session detail with counts
 * - GET /sessions/:id/timeline - Get timeline data for visualization
 * - GET /sessions/:id/files - Get file history snapshots
 * - GET /sessions/:id/forks - Get fork tree
 *
 * Note: Database rows return plain strings while Schema expects branded types.
 * The `as unknown` cast bridges Kysely row types to Effect Schema types.
 * Actual validation happens via effectValidator on request parameters.
 */

import { Hono } from 'hono'
import { effectValidator } from '@hono/effect-validator'
import { ListSessionsRequest, type ForkTree } from '@inherent.design/simulacrum-common'
import { db, getSessions, getSessionById, getTimelineData } from '../db/index.ts'
import { addSessionContext, sessionNotFound } from '../middleware/index.ts'

const sessions = new Hono()

// ============================================================================
// GET /sessions - List sessions with pagination and filters
// ============================================================================

sessions.get('/', effectValidator('query', ListSessionsRequest), async (c) => {
  const query = c.req.valid('query')
  const limit = query.limit ?? 100
  const offset = query.offset ?? 0

  // Build filters from query params
  const filters = {
    projectPath: query.project_path,
    status: query.status,
    startedAfter: query.started_after ? new Date(query.started_after) : undefined,
    startedBefore: query.started_before ? new Date(query.started_before) : undefined,
  }

  // Execute paginated query
  const result = await getSessions(db(), { limit, offset }, filters)

  // Return response (database rows compatible with schema structure)
  const response = {
    sessions: result.data,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  }

  return c.json(response)
})

// ============================================================================
// GET /sessions/:id - Get session detail with counts
// ============================================================================

sessions.get('/:id', async (c) => {
  const id = c.req.param('id')

  // Add session context to wide event
  addSessionContext(c, id)

  // Fetch session with counts
  const result = await getSessionById(db(), id)

  if (!result) {
    throw sessionNotFound(id)
  }

  const response = {
    session: result.session,
    message_count: result.messageCount,
    agent_count: result.agentCount,
    tool_call_count: result.toolCallCount,
  }

  return c.json(response)
})

// ============================================================================
// GET /sessions/:id/timeline - Get timeline data for visualization
// ============================================================================

sessions.get('/:id/timeline', async (c) => {
  const id = c.req.param('id')
  addSessionContext(c, id)

  // Get timeline data
  const data = await getTimelineData(db(), id)

  const response = {
    session_id: data.sessionId,
    points: data.points.map((p) => ({
      timestamp: p.timestamp,
      user_count: p.userCount,
      assistant_count: p.assistantCount,
      tool_call_count: p.toolCallCount,
    })),
    time_range: data.timeRange,
  }

  return c.json(response)
})

// ============================================================================
// GET /sessions/:id/files - Get file history snapshots
// ============================================================================

sessions.get('/:id/files', async (c) => {
  const id = c.req.param('id')
  addSessionContext(c, id)

  const snapshots = await db()
    .selectFrom('file_history')
    .where('session_id', '=', id)
    .selectAll()
    .orderBy('timestamp', 'asc')
    .execute()

  const response = {
    snapshots,
    total: snapshots.length,
  }

  return c.json(response)
})

// ============================================================================
// GET /sessions/:id/forks - Get fork tree
// ============================================================================

sessions.get('/:id/forks', async (c) => {
  const id = c.req.param('id')
  addSessionContext(c, id)

  // Get direct forks
  const forks = await db()
    .selectFrom('forks')
    .where('parent_session_id', '=', id)
    .selectAll()
    .execute()

  // Build recursive tree
  const buildTree = async (sessionId: string): Promise<ForkTree> => {
    const session = await db()
      .selectFrom('sessions')
      .where('id', '=', sessionId)
      .select(['id', 'title'])
      .executeTakeFirst()

    const childForks = await db()
      .selectFrom('forks')
      .where('parent_session_id', '=', sessionId)
      .select('child_session_id')
      .execute()

    const children = await Promise.all(childForks.map((f) => buildTree(f.child_session_id)))

    return {
      session_id: sessionId,
      title: session?.title ?? undefined,
      children,
    }
  }

  const tree = await buildTree(id)

  const response = {
    forks,
    tree,
  }

  return c.json(response)
})

export default sessions
