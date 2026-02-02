/**
 * @module routes/messages
 * @description Message API routes with Effect Schema validation.
 *
 * Endpoints:
 * - GET /sessions/:id/messages - List messages with pagination and optional tool calls
 *
 * Note: Database rows return plain strings while Schema expects branded types.
 * Actual validation happens via effectValidator on request parameters.
 */

import { Hono } from 'hono'
import { effectValidator } from '@hono/effect-validator'
import { ListMessagesRequest } from '@inherent.design/simulacrum-common'
import { db, getMessagesBySession } from '../db/index.ts'
import { addSessionContext } from '../middleware/index.ts'

const messages = new Hono()

// ============================================================================
// GET /sessions/:id/messages - List messages with pagination
// ============================================================================

/**
 * Get paginated messages for a session.
 *
 * Query parameters:
 * - limit: Max results (1-500, default 100)
 * - offset: Skip count (default 0)
 * - role: Filter by role ('user', 'assistant')
 * - model: Filter by model name
 * - include_tool_calls: 'true' to embed tool calls in response
 */
messages.get('/:id/messages', effectValidator('query', ListMessagesRequest), async (c) => {
  const id = c.req.param('id')
  const query = c.req.valid('query')
  const limit = query.limit ?? 100
  const offset = query.offset ?? 0
  const includeToolCalls = query.include_tool_calls === 'true'

  addSessionContext(c, id)

  // Build filters
  const filters = {
    role: query.role,
    model: query.model,
  }

  // Execute paginated query with optional tool calls
  const result = await getMessagesBySession(db(), id, { limit, offset }, filters, includeToolCalls)

  const response = {
    messages: result.data,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  }

  return c.json(response)
})

export default messages
