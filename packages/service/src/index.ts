/**
 * @module @inherent.design/simulacrum-service
 * @description Hono API backend for simulacrum session replay.
 *
 * Package structure:
 * - db: Kysely database client and query builders
 * - middleware: Hono middleware (logging, error handling, request context)
 * - routes: API route handlers and app factory
 */

// Database layer
export * from './db/index.ts'

// Middleware layer
export * from './middleware/index.ts'

// Routes layer
export * from './routes/index.ts'
