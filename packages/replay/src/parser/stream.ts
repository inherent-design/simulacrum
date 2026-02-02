/**
 * @module parser/stream
 * @description Core streaming infrastructure using @effect/platform FileSystem
 * with Effect.Stream for line-by-line JSONL processing.
 *
 * Memory-bounded: Only current chunk in memory (64KB default).
 * Pull-based: Downstream controls read rate (automatic backpressure).
 */

import { Effect, Stream, Data, pipe } from 'effect'
import { FileSystem } from '@effect/platform'

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * File I/O error during streaming.
 */
export class IOError extends Data.TaggedError('IOError')<{
  /** Path where error occurred */
  path: string
  /** Operation that failed */
  operation: 'open' | 'read' | 'stat'
  /** Original error */
  cause: unknown
}> {}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * Configuration for JSONL streaming.
 */
export interface StreamConfig {
  /**
   * Chunk size for file reading in bytes.
   * Default: 65536 (64KB)
   */
  chunkSize?: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CHUNK_SIZE = 64 * 1024 // 64KB

// ============================================================================
// STREAMING FUNCTIONS
// ============================================================================

/**
 * Stream a JSONL file line-by-line with automatic backpressure.
 *
 * Algorithm:
 * 1. Open file as byte stream (64KB chunks)
 * 2. Decode bytes to UTF-8 string
 * 3. Split on newlines (handles partial lines at chunk boundaries)
 * 4. Filter empty lines
 * 5. Yield lines with line numbers
 *
 * Memory model:
 * - Only current chunk in memory (64KB default)
 * - Lines yielded immediately after parsing
 * - Pull-based: downstream controls read rate
 *
 * @param filePath - Absolute path to JSONL file
 * @param config - Optional streaming configuration
 * @returns Effect.Stream yielding { lineNum, line } tuples
 *
 * @example
 * ```typescript
 * const lines = streamJSONL('/path/to/session.jsonl')
 * const processed = pipe(
 *   lines,
 *   Stream.mapEffect(({ lineNum, line }) => parseEntry(line)),
 *   Stream.runCollect
 * )
 * ```
 */
export const streamJSONL = (
  filePath: string,
  config: StreamConfig = {}
): Stream.Stream<{ lineNum: number; line: string }, IOError, FileSystem.FileSystem> =>
  pipe(
    // Open file as byte stream
    Stream.unwrap(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        return fs.stream(filePath, {
          chunkSize: config.chunkSize ?? DEFAULT_CHUNK_SIZE,
        })
      }).pipe(
        Effect.mapError(
          (cause) =>
            new IOError({
              path: filePath,
              operation: 'open',
              cause,
            })
        )
      )
    ),

    // Decode bytes to UTF-8 string
    Stream.decodeText('utf-8'),

    // Split on newlines (handles partial lines at chunk boundaries)
    Stream.splitLines,

    // Filter empty lines
    Stream.filter((line) => line.trim().length > 0),

    // Track line numbers via mapAccum
    Stream.mapAccum(0, (lineNum, line) => [lineNum + 1, { lineNum: lineNum + 1, line }]),

    // Map file read errors
    Stream.catchAll((error) =>
      Stream.fail(
        new IOError({
          path: filePath,
          operation: 'read',
          cause: error,
        })
      )
    )
  )

/**
 * Stream a JSONL file as raw strings (no line numbers).
 *
 * Simplified version for cases where line tracking isn't needed.
 *
 * @param filePath - Absolute path to JSONL file
 * @param config - Optional streaming configuration
 * @returns Effect.Stream yielding raw line strings
 */
export const streamJSONLRaw = (
  filePath: string,
  config: StreamConfig = {}
): Stream.Stream<string, IOError, FileSystem.FileSystem> =>
  pipe(
    streamJSONL(filePath, config),
    Stream.map(({ line }) => line)
  )

/**
 * Get file statistics for progress estimation.
 *
 * @param filePath - Absolute path to file
 * @returns Effect yielding file size in bytes
 */
export const getFileSize = (
  filePath: string
): Effect.Effect<number, IOError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const stat = yield* fs.stat(filePath).pipe(
      Effect.mapError(
        (cause) =>
          new IOError({
            path: filePath,
            operation: 'stat',
            cause,
          })
      )
    )
    return Number(stat.size)
  })
