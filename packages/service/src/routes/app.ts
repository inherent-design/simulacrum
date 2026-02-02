/**
 * @module routes/app
 * @description Hono application factory with middleware and route composition.
 *
 * Creates the complete API application by:
 * 1. Creating a Hono instance
 * 2. Applying middleware stack (request context, wide events, error boundary)
 * 3. Mounting all route handlers
 *
 * Exports AppType for Hono RPC client usage in web package.
 */

import { Hono } from 'hono'
import { applyMiddleware } from '../middleware/index.ts'
import sessions from './sessions.ts'
import messages from './messages.ts'
import agents from './agents.ts'
import health from './health.ts'
import analytics from './analytics.ts'
import ingest from './ingest.ts'

// ============================================================================
// Application Factory
// ============================================================================

/**
 * Create the Hono application with all middleware and routes.
 *
 * Middleware order (critical):
 * 1. requestContextMiddleware - Sets up request ID, start time, logger
 * 2. wideEventMiddleware - Builds and emits wide event on completion
 * 3. errorBoundary - Catches errors and returns structured responses
 *
 * Route structure:
 * - /sessions - Session listing and detail
 * - /sessions/:id/messages - Message routes (from messages router)
 * - /sessions/:id/agents - Agent routes (from agents router)
 * - /analytics - Dashboard analytics
 * - /ingest - Ingestion control
 * - /health, /ready - Health checks
 *
 * @returns Configured Hono application
 */
export const createApp = (): Hono => {
  const app = new Hono()

  // Apply middleware stack
  applyMiddleware(app)

  // Mount routes
  // Session routes include timeline, files, forks
  app.route('/sessions', sessions)

  // Message routes mounted under /sessions/:id
  app.route('/sessions', messages)

  // Agent routes mounted under /sessions/:id
  app.route('/sessions', agents)

  // Analytics routes
  app.route('/analytics', analytics)

  // Ingestion control routes
  app.route('/ingest', ingest)

  // Health check routes at root
  app.route('/', health)

  return app
}

// ============================================================================
// Type Exports
// ============================================================================

/**
 * AppType for Hono RPC client.
 *
 * Import this in web package for type-safe API calls:
 *
 * @example
 * // packages/web/src/lib/api.ts
 * import { hc } from 'hono/client'
 * import type { AppType } from '@inherent.design/simulacrum-service'
 *
 * export const api = hc<AppType>('http://localhost:3000')
 *
 * // Usage
 * const res = await api.sessions.$get({ query: { limit: '10' } })
 * const data = await res.json()  // Fully typed
 */
export type AppType = ReturnType<typeof createApp>

// Default export for convenience
export default createApp
