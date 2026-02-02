/**
 * @module routes/health
 * @description Health check endpoints for container orchestration.
 *
 * Endpoints:
 * - GET /health - Liveness check (always returns 200 if service running)
 * - GET /ready - Readiness check (verifies database connectivity)
 */

import { Hono } from 'hono'
import { db } from '../db/index.ts'
import { logger } from '../middleware/index.ts'

const health = new Hono()

// ============================================================================
// Response Types
// ============================================================================

/**
 * Liveness response schema.
 */
interface LivenessResponse {
  status: 'ok'
  timestamp: string
}

/**
 * Readiness response schema.
 */
interface ReadinessResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  checks: {
    database: 'ok' | 'error'
  }
}

// ============================================================================
// GET /health - Liveness check
// ============================================================================

/**
 * Liveness probe for container orchestration.
 *
 * Always returns 200 if the service is running.
 * Used by Kubernetes/Docker for restart decisions.
 */
health.get('/health', (c) => {
  const response: LivenessResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }
  return c.json(response)
})

// ============================================================================
// GET /ready - Readiness check
// ============================================================================

/**
 * Readiness probe for container orchestration.
 *
 * Returns 200 if the service can accept traffic.
 * Returns 503 if dependencies (database) are unavailable.
 * Used by load balancers for routing decisions.
 */
health.get('/ready', async (c) => {
  let dbStatus: 'ok' | 'error' = 'ok'

  try {
    // Simple query to verify database connectivity
    await db().selectFrom('sessions').select('id').limit(1).execute()
  } catch (error) {
    dbStatus = 'error'
    logger.warn({ error }, 'Database health check failed')
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded'
  const httpStatus = status === 'ok' ? 200 : 503

  const response: ReadinessResponse = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbStatus,
    },
  }

  return c.json(response, httpStatus)
})

export default health
