// packages/service/src/middleware/index.ts

// Types
export type { WideEvent, AppErrorOptions, ValidationErrorField, ErrorResponse } from './types.ts'

// Logger
export { logger, createChildLogger, getLoggerBindings } from './logger.ts'

// Request context middleware
export { requestContextMiddleware, getRequestId, getRequestDuration } from './request-context.ts'

// Wide event middleware
export {
  wideEventMiddleware,
  addEventContext,
  addSessionContext,
  addIngestionContext,
} from './wide-event.ts'

// Error boundary middleware
export {
  errorBoundary,
  AppError,
  NotFoundError,
  ValidationError,
  DBError,
  ConflictError,
  BadRequestError,
  ServiceUnavailableError,
  sessionNotFound,
  messageNotFound,
  queryFailed,
} from './error-boundary.ts'

// ========================================
// MIDDLEWARE STACK HELPER
// ========================================

import { Hono } from 'hono'
import { requestContextMiddleware } from './request-context.ts'
import { wideEventMiddleware } from './wide-event.ts'
import { errorBoundary } from './error-boundary.ts'

/**
 * Apply standard middleware stack to a Hono app.
 *
 * Order is critical:
 * 1. requestContextMiddleware - Sets up request ID, start time, logger
 * 2. wideEventMiddleware - Builds and emits wide event on completion
 * 3. errorBoundary - Catches errors and returns structured responses
 *
 * @example
 * const app = new Hono()
 * applyMiddleware(app)
 * // Now add routes
 */
export const applyMiddleware = (app: Hono): Hono => {
  return app
    .use('*', requestContextMiddleware)
    .use('*', wideEventMiddleware)
    .use('*', errorBoundary)
}
