// packages/service/src/middleware/types.ts
import type { Logger } from 'pino'

// ========================================
// WIDE EVENT INTERFACE (P-LOG-001)
// ========================================

/**
 * Wide event structure for request logging.
 * Single context-rich event per request, following observability best practices.
 *
 * Pattern: Build event throughout request lifecycle, emit on completion.
 * References: Spec v2 Section 8.1
 */
export interface WideEvent {
  // Request identification
  timestamp: string
  request_id: string

  // HTTP context
  method: string
  path: string
  status_code: number
  duration_ms: number
  outcome: 'success' | 'error'

  // Service context
  service: string
  version: string
  commit_hash: string
  environment: string

  // Optional domain context (added via addEventContext)
  session_id?: string
  ingestion_id?: string
  user_agent?: string
  content_length?: number

  // Error details (populated on failure)
  error?: {
    type: string
    message: string
    stack?: string
    code?: string
  }
}

// ========================================
// HONO CONTEXT AUGMENTATION
// ========================================

/**
 * Extend Hono's ContextVariableMap to include middleware-provided values.
 * These are available via c.get('key') in route handlers.
 */
declare module 'hono' {
  interface ContextVariableMap {
    /** UUID v4 request identifier, from x-request-id header or generated */
    requestId: string

    /** Partial wide event being built through request lifecycle */
    wideEvent: Partial<WideEvent>

    /** Child logger with request context */
    logger: Logger

    /** Request start time for duration calculation */
    startTime: number
  }
}

// ========================================
// ERROR TYPES
// ========================================

/**
 * Base application error with HTTP status code mapping.
 */
export interface AppErrorOptions {
  code: number
  type: string
  message: string
  cause?: Error
  details?: Record<string, unknown>
}

/**
 * Validation error field details.
 */
export interface ValidationErrorField {
  field: string
  message: string
  received?: unknown
}

/**
 * Structured error response format.
 */
export interface ErrorResponse {
  error: {
    type: string
    message: string
    errors?: ValidationErrorField[]
    details?: Record<string, unknown>
  }
  request_id: string
}
