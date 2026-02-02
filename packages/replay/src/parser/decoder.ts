/**
 * @module parser/decoder
 * @description Entry decoding with JSON parsing and schema validation.
 *
 * Uses common/schemas/jsonl.ts for type-safe parsing with error recovery.
 * Provides both fail-fast and error-accumulation strategies.
 */

import { Effect, Either, Data, Stream, pipe } from 'effect'
import { Schema as S } from 'effect'
import { AnyEntry } from '@inherent.design/simulacrum-common'

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error during JSON parsing or schema validation.
 */
export class ParseError extends Data.TaggedError('ParseError')<{
  /** Line number where error occurred (1-indexed) */
  line: number
  /** First 100 chars of line content for debugging */
  content: string
  /** Original error (JSON.parse or schema decode error) */
  cause: unknown
}> {}

// ============================================================================
// DECODING TYPES
// ============================================================================

/**
 * Result of decoding a single line.
 * Either a parsed entry or an error with context.
 */
export type DecodeResult = Either.Either<AnyEntry, ParseError>

/**
 * Decoded entry with line metadata.
 */
export interface DecodedEntry {
  /** Original line number in file */
  lineNum: number
  /** Parsed and validated entry */
  entry: AnyEntry
}

// ============================================================================
// DECODING FUNCTIONS
// ============================================================================

/**
 * Decode a single JSONL line to a typed entry.
 *
 * Algorithm:
 * 1. Parse JSON string to object
 * 2. Decode with AnyEntry schema (discriminated union)
 * 3. Return typed entry or ParseError
 *
 * @param lineNum - Line number for error context (1-indexed)
 * @param line - Raw JSON string
 * @returns Effect yielding typed entry or ParseError
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   decodeEntry(1, '{"type":"user","timestamp":"...","message":{...}}')
 * )
 * // result: UserEntry
 * ```
 */
export const decodeEntry = (lineNum: number, line: string): Effect.Effect<AnyEntry, ParseError> =>
  pipe(
    // Step 1: Parse JSON
    Effect.try({
      try: () => JSON.parse(line) as unknown,
      catch: (cause) =>
        new ParseError({
          line: lineNum,
          content: line.slice(0, 100),
          cause,
        }),
    }),
    // Step 2: Decode with schema
    Effect.flatMap((json) =>
      pipe(
        S.decodeUnknown(AnyEntry)(json),
        Effect.mapError(
          (cause) =>
            new ParseError({
              line: lineNum,
              content: line.slice(0, 100),
              cause,
            })
        )
      )
    )
  )

/**
 * Decode entry with Either for error accumulation.
 *
 * Returns Either instead of failing, allowing stream to continue
 * processing after malformed lines.
 *
 * @param lineNum - Line number for error context
 * @param line - Raw JSON string
 * @returns Either<AnyEntry, ParseError>
 */
export const decodeEntryEither = (
  lineNum: number,
  line: string
): Either.Either<AnyEntry, ParseError> => Effect.runSync(Effect.either(decodeEntry(lineNum, line)))

/**
 * Decode entry with full metadata.
 *
 * Wraps decodeEntry to include line number in output.
 *
 * @param lineNum - Line number
 * @param line - Raw JSON string
 * @returns Effect yielding DecodedEntry
 */
export const decodeEntryWithMetadata = (
  lineNum: number,
  line: string
): Effect.Effect<DecodedEntry, ParseError> =>
  pipe(
    decodeEntry(lineNum, line),
    Effect.map((entry) => ({ lineNum, entry }))
  )

/**
 * Create a stream transformer that decodes JSONL lines.
 *
 * Applies decodeEntry to each line in the stream.
 * Errors propagate and stop the stream.
 *
 * @returns Stream transformer from lines to entries
 */
export const decodeStream =
  () =>
  <E, R>(
    stream: Stream.Stream<{ lineNum: number; line: string }, E, R>
  ): Stream.Stream<DecodedEntry, E | ParseError, R> =>
    pipe(
      stream,
      Stream.mapEffect(({ lineNum, line }) => decodeEntryWithMetadata(lineNum, line))
    )

/**
 * Create a resilient stream transformer with error recovery.
 *
 * Uses Either to accumulate errors without stopping.
 * Malformed lines become Left values in the output.
 *
 * @returns Stream transformer yielding Either<DecodedEntry, ParseError>
 */
export const decodeStreamResilient =
  () =>
  <E, R>(
    stream: Stream.Stream<{ lineNum: number; line: string }, E, R>
  ): Stream.Stream<Either.Either<DecodedEntry, ParseError>, E, R> =>
    pipe(
      stream,
      Stream.map(({ lineNum, line }) => {
        const result = decodeEntryEither(lineNum, line)
        return Either.map(result, (entry) => ({ lineNum, entry }))
      })
    )
