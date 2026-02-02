/**
 * @module routes/agents
 * @description Agent API routes with Effect Schema validation.
 *
 * Endpoints:
 * - GET /sessions/:id/agents - List all agents for a session
 *
 * Note: Database rows return plain strings while Schema expects branded types.
 * Actual validation happens via effectValidator on request parameters.
 */

import { Hono } from 'hono'
import { db, getAgentsBySession } from '../db/index.ts'
import { addSessionContext } from '../middleware/index.ts'

const agents = new Hono()

// ============================================================================
// GET /sessions/:id/agents - List agents for session
// ============================================================================

/**
 * Get all agents for a session.
 *
 * Returns all subagents ordered by creation time.
 */
agents.get('/:id/agents', async (c) => {
  const id = c.req.param('id')
  addSessionContext(c, id)

  // Fetch agents ordered by creation time
  const agentsList = await getAgentsBySession(db(), id)

  const response = {
    agents: agentsList,
    total: agentsList.length,
  }

  return c.json(response)
})

export default agents
