/**
 * @module parser/router
 * @description Route decoded entries to appropriate staging tables based on entry type.
 *
 * Uses type-safe pattern matching on the discriminated union entry types.
 *
 * Routing Matrix:
 * | Entry Type           | Staging Table              | Notes                                           |
 * |----------------------|----------------------------|-------------------------------------------------|
 * | user                 | messages_staging           | User messages                                   |
 * | assistant            | messages_staging           | Assistant messages (extract tool_use separately)|
 * | summary              | sessions_staging           | Session title, metadata                         |
 * | custom-title         | sessions_staging           | User-assigned title (rare)                      |
 * | progress             | progress_events_staging    | 60-70% of volume                                |
 * | queue-operation      | queue_operations_staging   | ~5/day                                          |
 * | system               | system_events_staging      | Telemetry                                       |
 * | file-history-snapshot| file_history_staging       | File tracking                                   |
 */

import { Effect, Stream, pipe } from 'effect'
import type { AnyEntry } from '@inherent.design/simulacrum-common'
import type { DecodedEntry } from './decoder.ts'

// ============================================================================
// TABLE NAMES
// ============================================================================

/**
 * Staging table names for routing.
 */
export type StagingTable =
  | 'sessions_staging'
  | 'messages_staging'
  | 'tool_calls_staging'
  | 'progress_events_staging'
  | 'queue_operations_staging'
  | 'system_events_staging'
  | 'file_history_staging'
  | 'skip'

// ============================================================================
// ROUTED ENTRY TYPES
// ============================================================================

/**
 * Entry routed to a specific staging table.
 */
export interface RoutedEntry {
  /** Target staging table */
  table: Exclude<StagingTable, 'skip'>
  /** Transformed row data for insertion */
  row: Record<string, unknown>
  /** Original line number for error correlation */
  lineNum: number
}

/**
 * Entry that was skipped during routing.
 */
export interface SkippedEntry {
  /** Always 'skip' for skipped entries */
  table: 'skip'
  /** Reason for skipping */
  reason: string
  /** Original entry type */
  entryType: string
  /** Original line number */
  lineNum: number
}

/**
 * Result of routing: either a routed entry or a skipped entry.
 */
export type RouteResult = RoutedEntry | SkippedEntry

/**
 * Aggregated entries by table for batch insertion.
 */
export interface PartitionedEntries {
  sessions: Record<string, unknown>[]
  messages: Record<string, unknown>[]
  toolCalls: Record<string, unknown>[]
  progressEvents: Record<string, unknown>[]
  queueOperations: Record<string, unknown>[]
  systemEvents: Record<string, unknown>[]
  fileHistory: Record<string, unknown>[]
  skipped: SkippedEntry[]
}

// ============================================================================
// ROW TRANSFORMATION HELPERS
// ============================================================================

/**
 * Transform user/assistant entry to message row.
 */
const toMessageRow = (entry: AnyEntry, sessionId: string): Record<string, unknown> => {
  if (entry.type === 'user') {
    const content =
      typeof entry.message.content === 'string'
        ? entry.message.content
        : entry.message.content.map((block) => block.text).join('')

    return {
      session_id: sessionId,
      timestamp: entry.timestamp,
      role: 'user',
      content,
      is_meta: false,
      uuid: entry.uuid ?? null,
      parent_uuid: entry.parentUuid ?? null,
    }
  }

  if (entry.type === 'assistant') {
    // Concatenate text blocks
    const content = entry.message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return {
      session_id: sessionId,
      timestamp: entry.timestamp,
      role: 'assistant',
      content,
      is_meta: entry.isMeta ?? false,
      uuid: entry.uuid ?? null,
      parent_uuid: entry.parentUuid ?? null,
      request_id: entry.requestId ?? null,
      message_id: entry.message.id ?? null,
      model: entry.message.model ?? null,
      stop_reason: entry.message.stop_reason ?? null,
      stop_sequence: entry.message.stop_sequence ?? null,
      input_tokens: entry.message.usage?.input_tokens ?? null,
      output_tokens: entry.message.usage?.output_tokens ?? null,
      cache_creation_input_tokens: entry.message.usage?.cache_creation_input_tokens ?? null,
      cache_read_input_tokens: entry.message.usage?.cache_read_input_tokens ?? null,
      ephemeral_5m_input_tokens: entry.message.usage?.ephemeral_5m_input_tokens ?? null,
      ephemeral_1h_input_tokens: entry.message.usage?.ephemeral_1h_input_tokens ?? null,
      service_tier: entry.message.usage?.service_tier ?? null,
    }
  }

  // Unreachable for type safety
  return {}
}

/**
 * Transform progress entry to progress_events row.
 */
const toProgressRow = (entry: AnyEntry, sessionId: string): Record<string, unknown> => {
  if (entry.type !== 'progress') return {}

  return {
    session_id: sessionId,
    timestamp: entry.timestamp,
    hook_event: entry.hookEvent ?? null,
    hook_name: entry.hookName ?? null,
    command: entry.command ?? null,
    tool_use_id: entry.toolUseId ?? null,
    parent_tool_use_id: entry.parentToolUseId ?? null,
    uuid: entry.uuid ?? null,
    parent_uuid: entry.parentUuid ?? null,
  }
}

/**
 * Transform summary entry to session metadata row.
 */
const toSessionMetadataRow = (entry: AnyEntry, sessionId: string): Record<string, unknown> => {
  if (entry.type !== 'summary') return {}

  return {
    id: sessionId,
    title: entry.summary,
    leaf_uuid: entry.leafUuid ?? null,
    parent_session_id: entry.parentSessionId ?? null,
    is_sidechain: entry.isSidechain ?? false,
  }
}

/**
 * Transform file-history-snapshot entry to file_history row.
 */
const toFileHistoryRow = (entry: AnyEntry, sessionId: string): Record<string, unknown> => {
  if (entry.type !== 'file-history-snapshot') return {}

  return {
    session_id: sessionId,
    timestamp: entry.timestamp,
    tracked_files: entry.trackedFiles,
    is_snapshot_update: entry.isSnapshotUpdate ?? false,
  }
}

/**
 * Transform queue-operation entry to queue_operations row.
 */
const toQueueOperationRow = (entry: AnyEntry, sessionId: string): Record<string, unknown> => {
  if (entry.type !== 'queue-operation') return {}

  return {
    session_id: sessionId,
    timestamp: entry.timestamp,
    operation: entry.operation,
    content: entry.content,
  }
}

/**
 * Transform system entry to system_events row.
 */
const toSystemEventRow = (entry: AnyEntry, sessionId: string): Record<string, unknown> => {
  if (entry.type !== 'system') return {}

  return {
    session_id: sessionId,
    timestamp: entry.timestamp,
    subtype: entry.subtype,
    is_meta: entry.isMeta ?? false,
    duration_ms: entry.duration ?? null,
    uuid: entry.uuid ?? null,
    parent_uuid: entry.parentUuid ?? null,
  }
}

// ============================================================================
// ROUTING FUNCTIONS
// ============================================================================

/**
 * Route a single entry to its target staging table.
 *
 * Uses discriminated union matching on entry.type:
 * - 'user', 'assistant' -> messages_staging
 * - 'summary' -> sessions_staging (metadata update)
 * - 'progress' -> progress_events_staging
 * - 'queue-operation' -> queue_operations_staging
 * - 'system' -> system_events_staging
 * - 'file-history-snapshot' -> file_history_staging
 * - 'custom-title' -> sessions_staging (title update)
 *
 * @param decoded - Decoded entry with line metadata
 * @param sessionId - Current session UUID for foreign keys
 * @returns RouteResult with table and transformed row
 *
 * @example
 * ```typescript
 * const result = routeEntry(
 *   { lineNum: 1, entry: { type: 'user', ... } },
 *   'session-uuid'
 * )
 * // result: { table: 'messages_staging', row: {...}, lineNum: 1 }
 * ```
 */
export const routeEntry = (decoded: DecodedEntry, sessionId: string): RouteResult => {
  const { lineNum, entry } = decoded

  switch (entry.type) {
    case 'user':
    case 'assistant':
      return {
        table: 'messages_staging',
        row: toMessageRow(entry, sessionId),
        lineNum,
      }

    case 'progress':
      return {
        table: 'progress_events_staging',
        row: toProgressRow(entry, sessionId),
        lineNum,
      }

    case 'summary':
      return {
        table: 'sessions_staging',
        row: toSessionMetadataRow(entry, sessionId),
        lineNum,
      }

    case 'file-history-snapshot':
      return {
        table: 'file_history_staging',
        row: toFileHistoryRow(entry, sessionId),
        lineNum,
      }

    case 'queue-operation':
      return {
        table: 'queue_operations_staging',
        row: toQueueOperationRow(entry, sessionId),
        lineNum,
      }

    case 'system':
      return {
        table: 'system_events_staging',
        row: toSystemEventRow(entry, sessionId),
        lineNum,
      }

    case 'custom-title':
      return {
        table: 'sessions_staging',
        row: { custom_title: entry.title },
        lineNum,
      }

    default: {
      // Exhaustive check - unknown entry types
      const _exhaustiveCheck: never = entry
      return {
        table: 'skip',
        reason: `Unknown entry type: ${(entry as { type?: string }).type ?? 'undefined'}`,
        entryType: (entry as { type?: string }).type ?? 'undefined',
        lineNum,
      }
    }
  }
}

/**
 * Route a stream of entries to staging tables.
 *
 * Transforms each entry and adds session context.
 *
 * @param sessionId - Current session UUID
 * @returns Stream transformer from DecodedEntry to RouteResult
 */
export const routeEntries =
  (sessionId: string) =>
  <E, R>(stream: Stream.Stream<DecodedEntry, E, R>): Stream.Stream<RouteResult, E, R> =>
    pipe(
      stream,
      Stream.map((decoded) => routeEntry(decoded, sessionId))
    )

/**
 * Partition routed entries by table.
 *
 * Collects all routed entries and groups by target table.
 * Useful for batch-per-table insertion strategy.
 *
 * @param routedStream - Stream of routed entries
 * @returns Effect yielding PartitionedEntries
 */
export const partitionByTable = <E, R>(
  routedStream: Stream.Stream<RouteResult, E, R>
): Effect.Effect<PartitionedEntries, E, R> =>
  pipe(
    routedStream,
    Stream.runFold(
      {
        sessions: [],
        messages: [],
        toolCalls: [],
        progressEvents: [],
        queueOperations: [],
        systemEvents: [],
        fileHistory: [],
        skipped: [],
      } as PartitionedEntries,
      (acc, result) => {
        if (result.table === 'skip') {
          return { ...acc, skipped: [...acc.skipped, result] }
        }
        switch (result.table) {
          case 'sessions_staging':
            return { ...acc, sessions: [...acc.sessions, result.row] }
          case 'messages_staging':
            return { ...acc, messages: [...acc.messages, result.row] }
          case 'tool_calls_staging':
            return { ...acc, toolCalls: [...acc.toolCalls, result.row] }
          case 'progress_events_staging':
            return { ...acc, progressEvents: [...acc.progressEvents, result.row] }
          case 'queue_operations_staging':
            return { ...acc, queueOperations: [...acc.queueOperations, result.row] }
          case 'system_events_staging':
            return { ...acc, systemEvents: [...acc.systemEvents, result.row] }
          case 'file_history_staging':
            return { ...acc, fileHistory: [...acc.fileHistory, result.row] }
          default:
            return acc
        }
      }
    )
  )

/**
 * Check if a route result is a skipped entry.
 *
 * Type guard for filtering skipped entries.
 *
 * @param result - Route result to check
 * @returns True if entry was skipped
 */
export const isSkipped = (result: RouteResult): result is SkippedEntry => result.table === 'skip'

/**
 * Filter stream to only routed entries (exclude skipped).
 *
 * @returns Stream transformer that filters out skipped entries
 */
export const filterRoutedOnly =
  () =>
  <E, R>(stream: Stream.Stream<RouteResult, E, R>): Stream.Stream<RoutedEntry, E, R> =>
    pipe(
      stream,
      Stream.filter((result): result is RoutedEntry => !isSkipped(result))
    )
