/**
 * @module db
 * @description Database client, types, and query builders for Hono API backend.
 *
 * Exports:
 * - Client factory and connection management
 * - Database types and row type aliases
 * - Query builders for sessions, messages, agents, timeline
 * - Singleton instance for application use
 */

// Client
export { createDbClient, createPoolConfig, checkConnection, closeConnection } from './client.ts'
export type { DbConfig } from './client.ts'

// Types
export type {
  Database,
  // Core table types
  SessionsTable,
  MessagesTable,
  ToolCallsTable,
  AgentsTable,
  FileHistoryTable,
  ForksTable,
  ProgressEventsTable,
  QueueOperationsTable,
  SystemEventsTable,
  IngestionStateTable,
  // Staging table types
  SessionsStagingTable,
  MessagesStagingTable,
  ToolCallsStagingTable,
  ProgressEventsStagingTable,
  // View types
  DailyMessageCountsView,
  HourlyToolCallStatsView,
  SessionActivitySummaryView,
  DailyModelUsageView,
  // Row type aliases
  SessionRow,
  NewSession,
  SessionUpdate,
  MessageRow,
  NewMessage,
  MessageUpdate,
  ToolCallRow,
  NewToolCall,
  AgentRow,
  NewAgent,
  FileHistoryRow,
  NewFileHistory,
  ForkRow,
  NewFork,
  ProgressEventRow,
  NewProgressEvent,
  QueueOperationRow,
  NewQueueOperation,
  SystemEventRow,
  NewSystemEvent,
} from './types.ts'

// Queries
export {
  getSessions,
  getSessionById,
  getMessagesBySession,
  getAgentsBySession,
  getAgentHierarchy,
  getTimelineData,
  getDailyMessageCounts,
  getHourlyToolCallStats,
  truncateStagingTables,
  flushStagingTables,
} from './queries.ts'
export type {
  PaginationParams,
  PaginatedResult,
  SessionFilters,
  SessionWithCounts,
  MessageFilters,
  MessageWithToolCalls,
  TimelinePoint,
  TimelineData,
  FlushResult,
} from './queries.ts'

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

import { createDbClient } from './client.ts'
import type { Kysely } from 'kysely'
import type { Database } from './types.ts'

let dbInstance: Kysely<Database> | null = null

/**
 * Get or create the singleton database client.
 * Uses environment variables for configuration.
 *
 * Environment variables:
 * - DB_HOST (default: localhost)
 * - DB_PORT (default: 5432)
 * - DB_NAME (default: simulacrum)
 * - DB_USER (default: postgres)
 * - DB_PASSWORD (default: postgres)
 *
 * @returns Kysely database client instance
 */
export const db = (): Kysely<Database> => {
  if (!dbInstance) {
    dbInstance = createDbClient()
  }
  return dbInstance
}

/**
 * Reset the singleton instance.
 * Use in tests or when reconfiguring.
 *
 * @returns Promise that resolves when connection is closed
 */
export const resetDb = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.destroy()
    dbInstance = null
  }
}
