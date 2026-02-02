/**
 * @module store/accumulator
 * @description Generic batch accumulator with configurable batch size and auto-flush threshold.
 *
 * Algorithm:
 * 1. Add items to internal buffer
 * 2. When buffer.length >= batchSize, call flushFn
 * 3. Clear buffer after successful flush
 * 4. Track total flushed count
 *
 * Memory model:
 * - Buffer size bounded by batchSize
 * - After flush, buffer is cleared
 * - Works with parser's streaming backpressure
 */

import { Effect, Ref } from 'effect'
import type { StoreBatchConfig, FlushResult, DBError } from './types.ts'
import { DEFAULT_STORE_BATCH_CONFIG } from './types.ts'

// ============================================================================
// ACCUMULATOR TYPES
// ============================================================================

/**
 * Batch accumulator state.
 */
export interface AccumulatorState<T> {
  /** Accumulated items waiting to be flushed */
  items: T[]
  /** Total items flushed so far */
  totalFlushed: number
  /** Number of flush operations performed */
  flushCount: number
}

/**
 * Batch accumulator interface.
 * Collects items until batch size reached, then flushes.
 */
export interface BatchAccumulator<T> {
  /**
   * Add an item to the batch.
   * Returns flush result if batch size reached, otherwise undefined.
   *
   * @param item - Item to add
   * @returns Effect yielding FlushResult if flushed, undefined otherwise
   */
  add: (item: T) => Effect.Effect<FlushResult | undefined, DBError>

  /**
   * Add multiple items to the batch.
   * May trigger multiple flushes if items exceed batch size.
   *
   * @param items - Items to add
   * @returns Effect yielding array of FlushResults for any flushes
   */
  addMany: (items: T[]) => Effect.Effect<FlushResult[], DBError>

  /**
   * Force flush remaining items regardless of batch size.
   *
   * @returns Effect yielding FlushResult (may have 0 insertedCount if empty)
   */
  flush: () => Effect.Effect<FlushResult, DBError>

  /**
   * Get current accumulator state.
   *
   * @returns Effect yielding current AccumulatorState
   */
  getState: () => Effect.Effect<AccumulatorState<T>>

  /**
   * Reset accumulator to initial state.
   * Does NOT flush pending items.
   *
   * @returns Effect yielding void
   */
  reset: () => Effect.Effect<void>
}

// ============================================================================
// ACCUMULATOR FACTORY
// ============================================================================

/**
 * Create a batch accumulator for a staging table.
 *
 * Algorithm:
 * 1. Add items to internal buffer
 * 2. When buffer.length >= batchSize, call flushFn
 * 3. Clear buffer after successful flush
 * 4. Track total flushed count
 *
 * Memory model:
 * - Buffer size bounded by batchSize
 * - After flush, buffer is cleared
 * - Works with parser's streaming backpressure
 *
 * @param tableName - Target staging table for FlushResult
 * @param flushFn - Function to flush items to database
 * @param config - Batch configuration (optional)
 * @returns Effect yielding BatchAccumulator
 *
 * @example
 * ```typescript
 * const messageAccumulator = yield* createBatchAccumulator(
 *   'messages_staging',
 *   (rows) => insertToStaging(db, 'messages_staging', rows),
 *   { batchSize: 1000 }
 * )
 *
 * // Add items (auto-flushes at batch size)
 * const result = yield* messageAccumulator.add(messageRow)
 * if (result) {
 *   console.log(`Flushed ${result.insertedCount} messages`)
 * }
 *
 * // Force flush remaining at end
 * const finalResult = yield* messageAccumulator.flush()
 * ```
 */
export const createBatchAccumulator = <T>(
  tableName: string,
  flushFn: (items: T[]) => Effect.Effect<number, DBError>,
  config: StoreBatchConfig = {}
): Effect.Effect<BatchAccumulator<T>> =>
  Effect.gen(function* () {
    const batchSize = config.batchSize ?? DEFAULT_STORE_BATCH_CONFIG.batchSize

    // Internal state via Ref for atomic updates
    const stateRef = yield* Ref.make<AccumulatorState<T>>({
      items: [],
      totalFlushed: 0,
      flushCount: 0,
    })

    // Internal flush helper
    const doFlush = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      if (state.items.length === 0) {
        return { insertedCount: 0, table: tableName, durationMs: 0 }
      }

      const startTime = Date.now()
      const count = yield* flushFn(state.items)
      const durationMs = Date.now() - startTime

      // Update state after successful flush
      yield* Ref.update(stateRef, (s) => ({
        items: [],
        totalFlushed: s.totalFlushed + count,
        flushCount: s.flushCount + 1,
      }))

      return { insertedCount: count, table: tableName, durationMs }
    })

    const accumulator: BatchAccumulator<T> = {
      add: (item: T) =>
        Effect.gen(function* () {
          // Add item to buffer
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            items: [...s.items, item],
          }))

          // Check if flush needed
          const state = yield* Ref.get(stateRef)
          if (state.items.length >= batchSize) {
            return yield* doFlush
          }

          return undefined
        }),

      addMany: (items: T[]) =>
        Effect.gen(function* () {
          const results: FlushResult[] = []

          for (const item of items) {
            const result = yield* accumulator.add(item)
            if (result) {
              results.push(result)
            }
          }

          return results
        }),

      flush: () => doFlush,

      getState: () => Ref.get(stateRef),

      reset: () =>
        Ref.set(stateRef, {
          items: [],
          totalFlushed: 0,
          flushCount: 0,
        }),
    }

    return accumulator
  })
