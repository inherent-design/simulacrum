// packages/service/src/middleware/error-boundary.ts
import type { MiddlewareHandler } from 'hono'
import { logger } from './logger.ts'
import type { ErrorResponse, ValidationErrorField, AppErrorOptions } from './types.ts'

// ========================================
// APPLICATION ERROR CLASSES
// ========================================

/**
 * Base application error with HTTP status code mapping.
 * Extend this class for domain-specific errors.
 */
export class AppError extends Error {
  readonly code: number
  readonly type: string
  readonly details?: Record<string, unknown>

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = 'AppError'
    this.code = options.code
    this.type = options.type
    this.details = options.details
    this.cause = options.cause

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Resource not found error (404).
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super({
      code: 404,
      type: 'NOT_FOUND',
      message: `${resource} not found: ${id}`,
      details: { resource, id },
    })
    this.name = 'NotFoundError'
  }
}

/**
 * Request validation error (400).
 */
export class ValidationError extends AppError {
  readonly errors: ValidationErrorField[]

  constructor(errors: ValidationErrorField[]) {
    super({
      code: 400,
      type: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    })
    this.name = 'ValidationError'
    this.errors = errors
  }
}

/**
 * Database operation error (503).
 */
export class DBError extends AppError {
  constructor(operation: string, cause?: Error) {
    super({
      code: 503,
      type: 'DATABASE_ERROR',
      message: `Database error during ${operation}`,
      cause,
      details: { operation },
    })
    this.name = 'DBError'
  }
}

/**
 * Conflict error (409) - e.g., duplicate resource.
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 409,
      type: 'CONFLICT',
      message,
      details,
    })
    this.name = 'ConflictError'
  }
}

/**
 * Bad request error (400) - general invalid request.
 */
export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 400,
      type: 'BAD_REQUEST',
      message,
      details,
    })
    this.name = 'BadRequestError'
  }
}

/**
 * Service unavailable error (503).
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, cause?: Error) {
    super({
      code: 503,
      type: 'SERVICE_UNAVAILABLE',
      message: `Service unavailable: ${service}`,
      cause,
      details: { service },
    })
    this.name = 'ServiceUnavailableError'
  }
}

// ========================================
// ERROR BOUNDARY MIDDLEWARE
// ========================================

/**
 * Error boundary middleware.
 * Catches all errors and returns structured JSON responses.
 *
 * Error handling priority:
 * 1. AppError subclasses: Use error's code and type
 * 2. Effect Schema decode errors: Return 400 validation error
 * 3. Unknown errors: Return 500 internal error (details hidden)
 *
 * Must be placed after requestContextMiddleware.
 */
export const errorBoundary: MiddlewareHandler = async (c, next) => {
  try {
    await next()
  } catch (error) {
    const requestId = c.get('requestId') ?? 'unknown'

    // Handle known application errors
    if (error instanceof AppError) {
      const response = buildErrorResponse(error, requestId)

      // Log at appropriate level
      if (error.code >= 500) {
        logger.error({ request_id: requestId, error: serializeError(error) })
      } else {
        logger.warn({ request_id: requestId, error_type: error.type, message: error.message })
      }

      return c.json(response, error.code as 400 | 404 | 409 | 500 | 503)
    }

    // Handle Effect Schema decode errors
    if (isEffectSchemaError(error)) {
      const response: ErrorResponse = {
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors: extractSchemaErrors(error),
        },
        request_id: requestId,
      }

      logger.warn({ request_id: requestId, error_type: 'VALIDATION_ERROR', cause: error })
      return c.json(response, 400)
    }

    // Handle unknown errors (don't leak internal details)
    logger.error({
      request_id: requestId,
      error_type: 'INTERNAL_ERROR',
      error: serializeError(error),
    })

    const response: ErrorResponse = {
      error: {
        type: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      request_id: requestId,
    }

    return c.json(response, 500)
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Build structured error response from AppError.
 */
const buildErrorResponse = (error: AppError, requestId: string): ErrorResponse => {
  const response: ErrorResponse = {
    error: {
      type: error.type,
      message: error.message,
    },
    request_id: requestId,
  }

  // Include validation errors if present
  if (error instanceof ValidationError) {
    response.error.errors = error.errors
  }

  // Include details if present (non-500 errors only)
  if (error.details && error.code < 500) {
    response.error.details = error.details
  }

  return response
}

/**
 * Check if error is an Effect Schema decode error.
 */
const isEffectSchemaError = (error: unknown): boolean => {
  return (
    error !== null &&
    typeof error === 'object' &&
    '_tag' in error &&
    (error._tag === 'ParseError' || error._tag === 'Type')
  )
}

/**
 * Extract validation errors from Effect Schema error.
 */
const extractSchemaErrors = (error: unknown): ValidationErrorField[] => {
  // Basic extraction - can be enhanced for detailed Effect Schema error paths
  if (error && typeof error === 'object' && 'message' in error) {
    return [{ field: 'body', message: String(error.message) }]
  }
  return [{ field: 'unknown', message: 'Validation failed' }]
}

/**
 * Serialize error for logging.
 */
const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error ? serializeError(error.cause) : error.cause,
    }
  }
  return { value: String(error) }
}

// ========================================
// ERROR FACTORY HELPERS
// ========================================

/**
 * Create NotFoundError for a session.
 */
export const sessionNotFound = (id: string): NotFoundError => {
  return new NotFoundError('Session', id)
}

/**
 * Create NotFoundError for a message.
 */
export const messageNotFound = (id: string): NotFoundError => {
  return new NotFoundError('Message', id)
}

/**
 * Create DBError for a query failure.
 */
export const queryFailed = (operation: string, cause?: Error): DBError => {
  return new DBError(operation, cause)
}
