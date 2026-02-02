// packages/service/src/middleware/logger.ts
import pino from 'pino'
import type { Logger, LoggerOptions } from 'pino'

// ========================================
// LOGGER CONFIGURATION
// ========================================

/**
 * Service metadata included in all log entries.
 */
const baseContext = {
  service: 'simulacrum-service',
  version: process.env.npm_package_version ?? '0.0.0',
  commit_hash: process.env.COMMIT_HASH ?? 'unknown',
  environment: process.env.NODE_ENV ?? 'development',
}

/**
 * Redaction paths for sensitive data.
 * Matches both top-level and nested fields.
 */
const redactPaths = [
  'password',
  'authorization',
  'cookie',
  'secret',
  'token',
  '*.password',
  '*.authorization',
  '*.cookie',
  '*.secret',
  '*.token',
  'req.headers.authorization',
  'req.headers.cookie',
]

/**
 * Create Pino logger options.
 * Development: pretty printing with colors and timestamps
 * Production: JSON output for log aggregation
 */
const createLoggerOptions = (): LoggerOptions => {
  const isDev = process.env.NODE_ENV === 'development'

  return {
    name: 'simulacrum-service',
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

    base: baseContext,

    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    // Pretty printing for development
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
            singleLine: false,
          },
        }
      : undefined,

    // Serializers for complex objects
    serializers: {
      err: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers?.['user-agent'],
          'content-type': req.headers?.['content-type'],
          'content-length': req.headers?.['content-length'],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  }
}

// ========================================
// LOGGER INSTANCE
// ========================================

/**
 * Root logger instance.
 * Use logger.child({ request_id }) for request-scoped logging.
 */
export const logger: Logger = pino(createLoggerOptions())

/**
 * Create a child logger with additional context.
 * Used by request-context middleware to create request-scoped logger.
 */
export const createChildLogger = (context: Record<string, unknown>): Logger => {
  return logger.child(context)
}

/**
 * Get logger bindings (base context).
 * Useful for including in wide events.
 */
export const getLoggerBindings = (): Record<string, unknown> => {
  return logger.bindings()
}
