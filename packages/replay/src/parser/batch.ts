/**
 * @module parser/batch
 * @description Batch processing with Stream.grouped for efficient database inserts.
 *
 * Provides controlled concurrency and backpressure handling.
 * Memory bound: Max (concurrency * batchSize) entries in flight.
 */

import { Effect, Stream, Chunk, pipe } from 'effect'
import type { DecodedEntry } from './decoder.ts'
import type { ParseError } from './decoder.ts'
import type { IOError } from './stream.ts'

// ============================================================================
// BATCH CONFIGURATION
// ============================================================================

/**
 * Configuration for batch processing.
 */
export interface BatchConfig {
  /**
   * Number of entries per batch.
   * Default: 1000
   */
  batchSize?: number

  /**
   * Maximum concurrent batch operations.
   * Default: 4
   */
  concurrency?: number
}

/**
 * Default batch configuration.
 * Tuned for balance of memory usage and throughput.
 */
export const DEFAULT_BATCH_CONFIG: Required<BatchConfig> = {
  batchSize: 1000,
  concurrency: 4,
}

// ============================================================================
// BATCH TYPES
// ============================================================================

/**
 * Result of processing a single batch.
 */
export interface BatchResult {
  /** Number of entries processed in batch */
  entriesProcessed: number
  /** Batch sequence number (0-indexed) */
  batchNumber: number
  /** Processing duration in milliseconds */
  durationMs: number
}

/**
 * Aggregated result of processing all batches.
 */
export interface ProcessingResult {
  /** Total entries processed */
  totalProcessed: number
  /** Total batches processed */
  totalBatches: number
  /** Total processing duration in milliseconds */
  totalDurationMs: number
  /** Errors accumulated during processing */
  errors: ParseError[]
}

// ============================================================================
// BATCH FUNCTIONS
// ============================================================================

/**
 * Process a stream with batching and controlled concurrency.
 *
 * Algorithm:
 * 1. Group entries into batches of batchSize
 * 2. Convert Chunk to Array for handler
 * 3. Process batches with controlled concurrency
 * 4. Accumulate results
 *
 * Backpressure: Won't read more entries until batch handlers complete.
 * Memory bound: Max (concurrency * batchSize) entries in flight.
 *
 * @param stream - Stream of decoded entries
 * @param handler - Batch handler function (e.g., DB insert)
 * @param config - Batch configuration
 * @returns Effect yielding ProcessingResult
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   processWithBatching(
 *     entries,
 *     (batch) => batchInsertMessages(db, batch),
 *     { batchSize: 1000, concurrency: 4 }
 *   )
 * )
 * ```
 */
export const processWithBatching = <E, R>(
  stream: Stream.Stream<DecodedEntry, E, R>,
  handler: (batch: DecodedEntry[]) => Effect.Effect<number, E>,
  config: BatchConfig = {}
): Effect.Effect<ProcessingResult, E | IOError | ParseError, R> => {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_CONFIG.batchSize
  const concurrency = config.concurrency ?? DEFAULT_BATCH_CONFIG.concurrency
  const startTime = Date.now()

  return pipe(
    stream,

    // Collect into batches of batchSize
    Stream.grouped(batchSize),

    // Convert Chunk to Array for handler
    Stream.map(Chunk.toArray),

    // Process batches with controlled concurrency
    // Backpressure: won't read more until batches complete
    Stream.mapEffect((batch) => handler(batch), { concurrency }),

    // Accumulate stats
    Stream.runFold(
      { totalProcessed: 0, totalBatches: 0, errors: [] as ParseError[] },
      (stats, inserted) => ({
        totalProcessed: stats.totalProcessed + inserted,
        totalBatches: stats.totalBatches + 1,
        errors: stats.errors,
      })
    ),

    // Add duration
    Effect.map((stats) => ({
      ...stats,
      totalDurationMs: Date.now() - startTime,
    }))
  )
}

/**
 * Create a batched stream without processing.
 *
 * Groups entries into batches for downstream processing.
 *
 * @param config - Batch configuration
 * @returns Stream transformer that groups entries
 */
export const batchStream =
  (config: BatchConfig = {}) =>
  <E, R>(stream: Stream.Stream<DecodedEntry, E, R>): Stream.Stream<DecodedEntry[], E, R> =>
    pipe(
      stream,
      Stream.grouped(config.batchSize ?? DEFAULT_BATCH_CONFIG.batchSize),
      Stream.map(Chunk.toArray)
    )

/**
 * Process batches with parallel execution.
 *
 * Processes multiple batches concurrently with controlled parallelism.
 *
 * @param handler - Batch handler function
 * @param config - Batch configuration
 * @returns Stream transformer that processes batches
 */
export const processBatchesParallel =
  <E>(
    handler: (batch: DecodedEntry[]) => Effect.Effect<BatchResult, E>,
    config: BatchConfig = {}
  ) =>
  <R>(stream: Stream.Stream<DecodedEntry[], E, R>): Stream.Stream<BatchResult, E, R> => {
    const concurrency = config.concurrency ?? DEFAULT_BATCH_CONFIG.concurrency
    return pipe(stream, Stream.mapEffect(handler, { concurrency }))
  }
