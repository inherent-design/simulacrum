/**
 * @module parser/progress
 * @description Progress reporting during streaming without blocking.
 *
 * Uses Ref for atomic state updates. Progress reporting is non-blocking (fire-and-forget).
 */

import { Effect, Stream, Ref, pipe } from 'effect'

// ============================================================================
// PROGRESS TYPES
// ============================================================================

/**
 * Current progress state during ingestion.
 */
export interface ProgressState {
  /** Total lines read from file */
  linesRead: number
  /** Entries successfully parsed */
  entriesParsed: number
  /** Entries that failed parsing */
  parseErrors: number
  /** Entries routed to tables */
  entriesRouted: number
  /** Entries skipped during routing */
  entriesSkipped: number
  /** Batches processed */
  batchesProcessed: number
  /** Rows inserted to DB */
  rowsInserted: number
  /** Last progress report timestamp */
  lastReportTime: number
  /** Session being processed */
  currentSession: string | null
  /** Processing start time */
  startTime: number
}

/**
 * Progress callback type.
 */
export type ProgressCallback = (state: ProgressState) => Effect.Effect<void>

/**
 * Configuration for progress reporting.
 */
export interface ProgressConfig {
  /**
   * Minimum interval between progress reports in milliseconds.
   * Default: 1000 (1 second)
   */
  reportInterval?: number

  /**
   * Callback to invoke on progress updates.
   * Default: No-op
   */
  onProgress?: ProgressCallback
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_REPORT_INTERVAL = 1000 // 1 second

// ============================================================================
// PROGRESS FUNCTIONS
// ============================================================================

/**
 * Create a new progress state reference.
 *
 * @param sessionId - Current session identifier
 * @returns Effect yielding Ref<ProgressState>
 */
export const createProgressState = (sessionId: string): Effect.Effect<Ref.Ref<ProgressState>> =>
  Ref.make<ProgressState>({
    linesRead: 0,
    entriesParsed: 0,
    parseErrors: 0,
    entriesRouted: 0,
    entriesSkipped: 0,
    batchesProcessed: 0,
    rowsInserted: 0,
    lastReportTime: Date.now(),
    currentSession: sessionId,
    startTime: Date.now(),
  })

/**
 * Add progress tracking to a stream.
 *
 * Tracks entries passing through and reports progress at configured interval.
 * Progress reporting is non-blocking (fire-and-forget).
 *
 * @param state - Progress state reference
 * @param config - Progress configuration
 * @returns Stream transformer that tracks progress
 *
 * @example
 * ```typescript
 * const state = yield* createProgressState('session-id')
 * const tracked = pipe(
 *   entries,
 *   streamWithProgress(state, {
 *     reportInterval: 1000,
 *     onProgress: (s) => Effect.sync(() => console.log(`Processed ${s.entriesParsed}`))
 *   })
 * )
 * ```
 */
export const streamWithProgress =
  <T>(state: Ref.Ref<ProgressState>, config: ProgressConfig = {}) =>
  <E, R>(stream: Stream.Stream<T, E, R>): Stream.Stream<T, E, R> => {
    const reportInterval = config.reportInterval ?? DEFAULT_REPORT_INTERVAL
    const onProgress = config.onProgress ?? (() => Effect.void)

    return pipe(
      stream,

      // Update count on each entry
      Stream.tap(() =>
        Ref.update(state, (s) => ({
          ...s,
          entriesParsed: s.entriesParsed + 1,
        }))
      ),

      // Periodic progress reporting
      Stream.tap(() =>
        Effect.gen(function* () {
          const current = yield* Ref.get(state)
          const now = Date.now()

          if (now - current.lastReportTime > reportInterval) {
            yield* Ref.set(state, { ...current, lastReportTime: now })
            yield* onProgress(current)
          }
        })
      )
    )
  }

/**
 * Update progress state after parsing.
 *
 * @param state - Progress state reference
 * @param parsed - Number of entries parsed
 * @param errors - Number of parse errors
 */
export const recordParsing = (
  state: Ref.Ref<ProgressState>,
  parsed: number,
  errors: number
): Effect.Effect<void> =>
  Ref.update(state, (s) => ({
    ...s,
    entriesParsed: s.entriesParsed + parsed,
    parseErrors: s.parseErrors + errors,
  }))

/**
 * Update progress state after routing.
 *
 * @param state - Progress state reference
 * @param routed - Number of entries routed
 * @param skipped - Number of entries skipped
 */
export const recordRouting = (
  state: Ref.Ref<ProgressState>,
  routed: number,
  skipped: number
): Effect.Effect<void> =>
  Ref.update(state, (s) => ({
    ...s,
    entriesRouted: s.entriesRouted + routed,
    entriesSkipped: s.entriesSkipped + skipped,
  }))

/**
 * Update progress state after batch insert.
 *
 * @param state - Progress state reference
 * @param inserted - Number of rows inserted
 */
export const recordBatchInsert = (
  state: Ref.Ref<ProgressState>,
  inserted: number
): Effect.Effect<void> =>
  Ref.update(state, (s) => ({
    ...s,
    batchesProcessed: s.batchesProcessed + 1,
    rowsInserted: s.rowsInserted + inserted,
  }))

/**
 * Get current progress state snapshot.
 *
 * @param state - Progress state reference
 * @returns Effect yielding current ProgressState
 */
export const getProgress = (state: Ref.Ref<ProgressState>): Effect.Effect<ProgressState> =>
  Ref.get(state)

/**
 * Calculate progress percentage based on file size.
 *
 * @param state - Current progress state
 * @param totalBytes - Total file size in bytes
 * @param avgBytesPerLine - Average bytes per line (default: 500)
 * @returns Estimated percentage (0-100)
 */
export const calculatePercentage = (
  state: ProgressState,
  totalBytes: number,
  avgBytesPerLine: number = 500
): number => {
  const estimatedLines = totalBytes / avgBytesPerLine
  const percentage = (state.linesRead / estimatedLines) * 100
  return Math.min(100, Math.round(percentage))
}
