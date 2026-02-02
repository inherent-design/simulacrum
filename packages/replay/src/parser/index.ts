/**
 * @module parser
 * @description Re-export all parser module exports for clean imports.
 *
 * The parser module provides memory-bounded JSONL streaming with Effect.Stream
 * for the ingestion pipeline. It handles:
 * - Streaming: Read JSONL files line-by-line with automatic backpressure
 * - Decoding: Parse JSON and validate against entry schemas
 * - Batching: Group entries for efficient batch database inserts
 * - Routing: Direct entries to appropriate staging tables based on type
 * - Progress: Report ingestion progress without blocking the stream
 *
 * @example
 * ```typescript
 * import {
 *   streamJSONL,
 *   decodeStream,
 *   processWithBatching,
 *   routeEntries,
 *   type DecodedEntry
 * } from '@inherent.design/simulacrum-replay/parser'
 *
 * const result = await Effect.runPromise(
 *   pipe(
 *     streamJSONL('/path/to/session.jsonl'),
 *     decodeStream(),
 *     routeEntries('session-uuid'),
 *     partitionByTable
 *   ).pipe(Effect.provide(NodeFileSystem.layer))
 * )
 * ```
 */

// Error types
export { IOError } from './stream.ts'
export { ParseError } from './decoder.ts'

// Stream types and functions
export type { StreamConfig } from './stream.ts'
export { streamJSONL, streamJSONLRaw, getFileSize } from './stream.ts'

// Decoder types and functions
export type { DecodeResult, DecodedEntry } from './decoder.ts'
export {
  decodeEntry,
  decodeEntryEither,
  decodeEntryWithMetadata,
  decodeStream,
  decodeStreamResilient,
} from './decoder.ts'

// Batch types and functions
export type { BatchConfig, BatchResult, ProcessingResult } from './batch.ts'
export {
  DEFAULT_BATCH_CONFIG,
  processWithBatching,
  batchStream,
  processBatchesParallel,
} from './batch.ts'

// Router types and functions
export type {
  StagingTable,
  RoutedEntry,
  SkippedEntry,
  RouteResult,
  PartitionedEntries,
} from './router.ts'
export {
  routeEntry,
  routeEntries,
  partitionByTable,
  isSkipped,
  filterRoutedOnly,
} from './router.ts'

// Progress types and functions
export type { ProgressState, ProgressCallback, ProgressConfig } from './progress.ts'
export {
  createProgressState,
  streamWithProgress,
  recordParsing,
  recordRouting,
  recordBatchInsert,
  getProgress,
  calculatePercentage,
} from './progress.ts'
