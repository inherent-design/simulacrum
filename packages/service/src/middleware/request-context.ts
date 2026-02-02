// packages/service/src/middleware/request-context.ts
import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'node:crypto'
import { createChildLogger } from './logger.ts'

// ========================================
// REQUEST CONTEXT MIDDLEWARE
// ========================================

/**
 * Request context middleware.
 *
 * Responsibilities:
 * 1. Generate or extract request ID from x-request-id header
 * 2. Record request start time for duration calculation
 * 3. Set x-request-id response header for correlation
 * 4. Create child logger with request context
 *
 * Must be first middleware in chain.
 */
export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
  // Extract or generate request ID
  const requestId = c.req.header('x-request-id') ?? randomUUID()
  const startTime = Date.now()

  // Set context variables
  c.set('requestId', requestId)
  c.set('startTime', startTime)

  // Create request-scoped logger
  const childLogger = createChildLogger({
    request_id: requestId,
    method: c.req.method,
    path: c.req.path,
  })
  c.set('logger', childLogger)

  // Set response header for correlation
  c.header('x-request-id', requestId)

  await next()
}

/**
 * Extract request ID from context.
 * Utility for use in route handlers.
 */
export const getRequestId = (c: { get: (key: 'requestId') => string }): string => {
  return c.get('requestId')
}

/**
 * Get request duration in milliseconds.
 */
export const getRequestDuration = (c: { get: (key: 'startTime') => number }): number => {
  return Date.now() - c.get('startTime')
}
