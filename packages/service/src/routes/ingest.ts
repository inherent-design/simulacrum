/**
 * @module routes/ingest
 * @description Ingestion control API for starting and monitoring ingestion jobs.
 *
 * Endpoints:
 * - POST /ingest/start - Start ingestion job
 * - GET /ingest/status - Get current ingestion status
 *
 * Note: Database rows return plain strings while Schema expects branded types.
 * Actual validation happens via effectValidator on request parameters.
 */

import { Hono } from 'hono'
import { effectValidator } from '@hono/effect-validator'
import { IngestionStartRequest } from '@inherent.design/simulacrum-common'
import { addIngestionContext, logger } from '../middleware/index.ts'

// ============================================================================
// Ingestion State
// ============================================================================

/**
 * In-memory ingestion state.
 * Production: Use Redis or database for persistence.
 */
interface IngestionState {
  id: string
  status: 'running' | 'completed' | 'failed' | 'idle'
  progress: {
    sessions_discovered: number
    sessions_processed: number
    messages_inserted: number
    tool_calls_inserted: number
    errors: number
  }
  started_at: Date | null
  completed_at: Date | null
  error: string | null
}

let ingestionState: IngestionState = {
  id: '',
  status: 'idle',
  progress: {
    sessions_discovered: 0,
    sessions_processed: 0,
    messages_inserted: 0,
    tool_calls_inserted: 0,
    errors: 0,
  },
  started_at: null,
  completed_at: null,
  error: null,
}

const ingest = new Hono()

// ============================================================================
// POST /ingest/start - Start ingestion job
// ============================================================================

/**
 * Start a new ingestion job.
 *
 * Body parameters:
 * - source_path: Override source directory (default: ~/.claude/projects)
 * - project_filter: Filter projects by path pattern
 * - since: Only ingest sessions after this date
 * - dry_run: 'true' to simulate without writing
 *
 * Returns 'already_running' if ingestion is in progress.
 */
ingest.post('/start', effectValidator('json', IngestionStartRequest), async (c) => {
  const body = c.req.valid('json')

  // Check if already running
  if (ingestionState.status === 'running') {
    const response = {
      ingestion_id: ingestionState.id,
      status: 'already_running' as const,
      estimated_sessions: undefined,
    }
    return c.json(response)
  }

  // Generate new ingestion ID
  const ingestionId = crypto.randomUUID()

  // Reset state
  ingestionState = {
    id: ingestionId,
    status: 'running',
    progress: {
      sessions_discovered: 0,
      sessions_processed: 0,
      messages_inserted: 0,
      tool_calls_inserted: 0,
      errors: 0,
    },
    started_at: new Date(),
    completed_at: null,
    error: null,
  }

  // Add context to wide event
  addIngestionContext(c, ingestionId)

  // Log ingestion start
  logger.info(
    {
      ingestion_id: ingestionId,
      source_path: body.source_path,
      project_filter: body.project_filter,
      since: body.since,
      dry_run: body.dry_run,
    },
    'Starting ingestion'
  )

  // TODO: Trigger actual ingestion in background
  // This would call the replay package's ingestion service

  const response = {
    ingestion_id: ingestionId,
    status: 'started' as const,
    estimated_sessions: undefined, // Could estimate from file count
  }

  return c.json(response)
})

// ============================================================================
// GET /ingest/status - Get ingestion status
// ============================================================================

/**
 * Get current ingestion job status and progress.
 */
ingest.get('/status', async (c) => {
  // Add context if there's an active ingestion
  if (ingestionState.id) {
    addIngestionContext(c, ingestionState.id)
  }

  const response = {
    ingestion_id: ingestionState.id || 'none',
    status: ingestionState.status,
    progress: ingestionState.progress,
    started_at: ingestionState.started_at,
    completed_at: ingestionState.completed_at,
    error: ingestionState.error,
  }

  return c.json(response)
})

// ============================================================================
// State Management Exports
// ============================================================================

/**
 * Update ingestion progress (called by replay package).
 */
export const updateIngestionProgress = (updates: Partial<IngestionState['progress']>): void => {
  Object.assign(ingestionState.progress, updates)
}

/**
 * Complete ingestion (called by replay package).
 */
export const completeIngestion = (success: boolean, error?: string): void => {
  ingestionState.status = success ? 'completed' : 'failed'
  ingestionState.completed_at = new Date()
  if (error) {
    ingestionState.error = error
  }
}

/**
 * Reset ingestion state (for testing).
 */
export const resetIngestionState = (): void => {
  ingestionState = {
    id: '',
    status: 'idle',
    progress: {
      sessions_discovered: 0,
      sessions_processed: 0,
      messages_inserted: 0,
      tool_calls_inserted: 0,
      errors: 0,
    },
    started_at: null,
    completed_at: null,
    error: null,
  }
}

export default ingest
