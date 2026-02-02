/**
 * @module schemas/jsonl
 * @description Effect Schema definitions for JSONL entry parsing
 *
 * Defines schemas for the 8 entry types discovered via faux-ingestion (Phase 2.2):
 * - user: User messages
 * - assistant: Assistant responses with tool_use blocks
 * - summary: Auto-generated session titles
 * - custom-title: User-assigned titles (rare)
 * - file-history-snapshot: File state tracking
 * - progress: Hook execution (60-70% of volume)
 * - queue-operation: User-queued tasks
 * - system: Telemetry events
 */

import { Schema as S, Effect, Either, pipe } from 'effect'
import { QueueOperationType } from './domain.js'

// ============================================================================
// Entry Type Union
// ============================================================================

/**
 * All 8 JSONL entry types.
 */
export const EntryType = S.Literal(
  'user',
  'assistant',
  'summary',
  'custom-title',
  'file-history-snapshot',
  'progress',
  'queue-operation',
  'system'
)
export type EntryType = S.Schema.Type<typeof EntryType>

// ============================================================================
// User Entry Schema
// ============================================================================

/**
 * User message entry from JSONL.
 *
 * Contains user input and session metadata (on first message).
 */
export class UserEntry extends S.Class<UserEntry>('UserEntry')({
  type: S.Literal('user'),
  timestamp: S.String, // ISO 8601

  message: S.Struct({
    role: S.Literal('user'),
    content: S.Union(
      S.String,
      S.Array(
        S.Struct({
          type: S.Literal('text'),
          text: S.String,
        })
      )
    ),
  }),

  // Threading
  uuid: S.optional(S.String),
  parentUuid: S.optional(S.String),
  isSidechain: S.optional(S.Boolean),

  // Session metadata (present on first user message)
  version: S.optional(S.String),
  slug: S.optional(S.String),
  cwd: S.optional(S.String),
  gitBranch: S.optional(S.String),
  userType: S.optional(S.String),
}) {}

// ============================================================================
// Assistant Entry Schema
// ============================================================================

/**
 * Text content block in assistant response.
 */
const TextBlock = S.Struct({
  type: S.Literal('text'),
  text: S.String,
})

/**
 * Tool use content block in assistant response.
 */
const ToolUseBlock = S.Struct({
  type: S.Literal('tool_use'),
  id: S.String, // toolu_xxx
  name: S.String,
  input: S.Record({ key: S.String, value: S.Unknown }),
})

/**
 * Token usage breakdown from Anthropic API.
 */
const UsageInfo = S.Struct({
  input_tokens: S.Number,
  output_tokens: S.Number,
  cache_creation_input_tokens: S.optional(S.Number),
  cache_read_input_tokens: S.optional(S.Number),
  ephemeral_5m_input_tokens: S.optional(S.Number),
  ephemeral_1h_input_tokens: S.optional(S.Number),
  service_tier: S.optional(S.String),
})

/**
 * Assistant message entry from JSONL.
 *
 * Contains model response with optional tool_use blocks.
 */
export class AssistantEntry extends S.Class<AssistantEntry>('AssistantEntry')({
  type: S.Literal('assistant'),
  timestamp: S.String, // ISO 8601
  requestId: S.optional(S.String), // req_xxx

  message: S.Struct({
    id: S.optional(S.String), // msg_xxx
    role: S.Literal('assistant'),
    content: S.Array(S.Union(TextBlock, ToolUseBlock)),
    model: S.optional(S.String),
    stop_reason: S.optional(S.String),
    stop_sequence: S.optional(S.String),
    usage: S.optional(UsageInfo),
  }),

  // Threading
  uuid: S.optional(S.String),
  parentUuid: S.optional(S.String),
  isMeta: S.optional(S.Boolean),
}) {}

// ============================================================================
// Summary Entry Schema
// ============================================================================

/**
 * Summary entry containing auto-generated session title.
 */
export class SummaryEntry extends S.Class<SummaryEntry>('SummaryEntry')({
  type: S.Literal('summary'),
  timestamp: S.String,
  summary: S.String, // Auto-generated title
  leafUuid: S.optional(S.String),
  sessionId: S.optional(S.String),
  parentSessionId: S.optional(S.String),
  isSidechain: S.optional(S.Boolean),
}) {}

// ============================================================================
// Custom Title Entry Schema
// ============================================================================

/**
 * Custom title entry (user-assigned, rare).
 */
export class CustomTitleEntry extends S.Class<CustomTitleEntry>('CustomTitleEntry')({
  type: S.Literal('custom-title'),
  timestamp: S.String,
  title: S.String, // User-assigned title
}) {}

// ============================================================================
// File History Snapshot Entry Schema
// ============================================================================

/**
 * File history snapshot tracking file state at message boundaries.
 */
export class FileHistorySnapshotEntry extends S.Class<FileHistorySnapshotEntry>(
  'FileHistorySnapshotEntry'
)({
  type: S.Literal('file-history-snapshot'),
  timestamp: S.String,
  trackedFiles: S.Record({ key: S.String, value: S.Unknown }),
  isSnapshotUpdate: S.optional(S.Boolean),
}) {}

// ============================================================================
// Progress Entry Schema
// ============================================================================

/**
 * Progress entry for hook execution events.
 * These constitute 60-70% of JSONL volume.
 */
export class ProgressEntry extends S.Class<ProgressEntry>('ProgressEntry')({
  type: S.Literal('progress'),
  timestamp: S.String,
  hookEvent: S.optional(S.String),
  hookName: S.optional(S.String),
  command: S.optional(S.String),
  toolUseId: S.optional(S.String),
  parentToolUseId: S.optional(S.String),
  uuid: S.optional(S.String),
  parentUuid: S.optional(S.String),
}) {}

// ============================================================================
// Queue Operation Entry Schema
// ============================================================================

/**
 * Queue operation entry for user-queued tasks.
 */
export class QueueOperationEntry extends S.Class<QueueOperationEntry>('QueueOperationEntry')({
  type: S.Literal('queue-operation'),
  timestamp: S.String,
  operation: QueueOperationType,
  content: S.String,
}) {}

// ============================================================================
// System Entry Schema
// ============================================================================

/**
 * System event entry for telemetry (turn_duration, etc.).
 */
export class SystemEntry extends S.Class<SystemEntry>('SystemEntry')({
  type: S.Literal('system'),
  timestamp: S.String,
  subtype: S.String, // e.g., 'turn_duration'
  duration: S.optional(S.Number),
  uuid: S.optional(S.String),
  parentUuid: S.optional(S.String),
  isMeta: S.optional(S.Boolean),
}) {}

// ============================================================================
// Union of All Entry Types
// ============================================================================

/**
 * Union schema of all 8 JSONL entry types.
 */
export const AnyEntry = S.Union(
  UserEntry,
  AssistantEntry,
  SummaryEntry,
  CustomTitleEntry,
  FileHistorySnapshotEntry,
  ProgressEntry,
  QueueOperationEntry,
  SystemEntry
)

export type AnyEntry = S.Schema.Type<typeof AnyEntry>

// ============================================================================
// Parse Error Type
// ============================================================================

/**
 * Error type for JSONL parsing failures.
 */
export class ParseError extends S.TaggedError<ParseError>()('ParseError', {
  line: S.Number,
  content: S.String,
  cause: S.Unknown,
}) {}

// ============================================================================
// Entry Parsing Functions
// ============================================================================

/**
 * Parse a JSONL line to a typed entry.
 * Returns an Effect that can fail with ParseError.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(parseEntry(jsonLine))
 * ```
 */
export const parseEntry = (line: string): Effect.Effect<AnyEntry, ParseError> =>
  pipe(
    // Parse JSON
    Effect.try({
      try: () => JSON.parse(line) as unknown,
      catch: (e) =>
        new ParseError({
          line: 0,
          content: line.slice(0, 100),
          cause: e,
        }),
    }),
    // Decode with schema
    Effect.flatMap((json: unknown) =>
      pipe(
        S.decodeUnknown(AnyEntry)(json),
        Effect.mapError(
          (e) =>
            new ParseError({
              line: 0,
              content: line.slice(0, 100),
              cause: e,
            })
        )
      )
    )
  )

/**
 * Parse entry with error recovery.
 * Returns Either for error accumulation patterns.
 *
 * @example
 * ```typescript
 * const result = parseEntryEither(jsonLine)
 * if (Either.isRight(result)) {
 *   console.log(result.right) // parsed entry
 * }
 * ```
 */
export const parseEntryEither = (line: string): Either.Either<AnyEntry, ParseError> =>
  Effect.runSync(Effect.either(parseEntry(line)))
