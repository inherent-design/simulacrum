/**
 * @module routes
 * @description Route exports for Simulacrum service API.
 *
 * Exports:
 * - Individual route handlers for testing
 * - App factory for application creation
 * - AppType for Hono RPC client
 * - Ingestion control functions
 */

// App factory and type
export { createApp, type AppType } from './app.ts'
export { default as createAppDefault } from './app.ts'

// Individual route handlers (for testing)
export { default as sessions } from './sessions.ts'
export { default as messages } from './messages.ts'
export { default as agents } from './agents.ts'
export { default as health } from './health.ts'
export { default as analytics } from './analytics.ts'
export { default as ingest } from './ingest.ts'

// Ingestion control exports (for replay package integration)
export { updateIngestionProgress, completeIngestion, resetIngestionState } from './ingest.ts'
