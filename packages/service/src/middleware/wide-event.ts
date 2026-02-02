// packages/service/src/middleware/wide-event.ts
import type { MiddlewareHandler, Context } from 'hono'
import { logger, getLoggerBindings } from './logger.ts'
import type { WideEvent } from './types.ts'

// ========================================
// WIDE EVENT MIDDLEWARE
// ========================================

/**
 * Wide event logging middleware.
 *
 * Pattern: Build context throughout request, emit single event on completion.
 * - Success (2xx-3xx): log at info level
 * - Client error (4xx): log at warn level
 * - Server error (5xx): log at error level
 *
 * Must be placed after requestContextMiddleware.
 */
export const wideEventMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.get('requestId')
  const startTime = c.get('startTime')

  // Initialize partial wide event
  const wideEvent: Partial<WideEvent> = {
    request_id: requestId,
    method: c.req.method,
    path: c.req.path,
    user_agent: c.req.header('user-agent'),
    content_length: parseInt(c.req.header('content-length') ?? '0', 10) || undefined,
  }

  c.set('wideEvent', wideEvent)

  try {
    await next()

    // Build final event on success
    const finalEvent = buildFinalEvent(wideEvent, c, startTime, 'success')

    // Log at appropriate level based on status code
    if (c.res.status >= 400 && c.res.status < 500) {
      logger.warn(finalEvent)
    } else if (c.res.status >= 500) {
      logger.error(finalEvent)
    } else {
      logger.info(finalEvent)
    }
  } catch (error) {
    // Build final event on unhandled error
    const finalEvent = buildFinalEvent(wideEvent, c, startTime, 'error', error)
    logger.error(finalEvent)

    // Re-throw for error boundary to handle
    throw error
  }
}

/**
 * Build final wide event with all context.
 */
const buildFinalEvent = (
  partial: Partial<WideEvent>,
  c: Context,
  startTime: number,
  outcome: 'success' | 'error',
  error?: unknown
): WideEvent => {
  const bindings = getLoggerBindings()

  const event: WideEvent = {
    ...partial,
    timestamp: new Date().toISOString(),
    request_id: partial.request_id ?? 'unknown',
    method: partial.method ?? 'UNKNOWN',
    path: partial.path ?? '/',
    status_code: error ? 500 : c.res.status,
    duration_ms: Date.now() - startTime,
    outcome,
    service: bindings.service as string,
    version: bindings.version as string,
    commit_hash: bindings.commit_hash as string,
    environment: bindings.environment as string,
  }

  // Add error details if present
  if (error) {
    event.error = {
      type: error instanceof Error ? error.constructor.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }
  }

  return event
}

// ========================================
// EVENT CONTEXT HELPERS
// ========================================

/**
 * Add domain-specific context to the wide event.
 * Call from route handlers to enrich logging context.
 *
 * @example
 * addEventContext(c, { session_id: id })
 * addEventContext(c, { ingestion_id: ingestionId })
 */
export const addEventContext = (
  c: Context,
  context: Partial<Pick<WideEvent, 'session_id' | 'ingestion_id'>>
): void => {
  const wideEvent = c.get('wideEvent')
  Object.assign(wideEvent, context)
}

/**
 * Add session ID to event context.
 * Convenience wrapper for addEventContext.
 */
export const addSessionContext = (c: Context, sessionId: string): void => {
  addEventContext(c, { session_id: sessionId })
}

/**
 * Add ingestion ID to event context.
 * Convenience wrapper for addEventContext.
 */
export const addIngestionContext = (c: Context, ingestionId: string): void => {
  addEventContext(c, { ingestion_id: ingestionId })
}
