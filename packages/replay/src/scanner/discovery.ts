/**
 * @module scanner/discovery
 * @description Core file discovery functions for Claude Code session artifacts.
 *
 * Uses Node.js fs/promises and glob for efficient directory traversal.
 * All async operations return Effect for composability and error handling.
 */

import { Effect, pipe } from 'effect'
import { FileSystem, Error as PlatformError } from '@effect/platform'
import { NodeFileSystem } from '@effect/platform-node'
import { glob } from 'glob'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

import type {
  SessionFile,
  SubagentFile,
  ToolResultFile,
  ScanResult,
  ScanError,
  ScanOptions,
} from './types.ts'
import { CLAUDE_PATHS } from './types.ts'

// ============================================================================
// REGEX PATTERNS
// ============================================================================

/** UUID v4 format in filename */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Match subagent filename: agent-{7 hex chars}.jsonl */
const SUBAGENT_REGEX = /^agent-([a-f0-9]{7})\.jsonl$/

/** Match tool result filename: toolu_{id}.txt */
const TOOL_RESULT_REGEX = /^(toolu_[a-zA-Z0-9]+)\.txt$/

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Expand a path containing ~ or environment variables.
 *
 * @param path - Path potentially containing ~ or $HOME
 * @returns Absolute path with expansions resolved
 */
export const expandPath = (path: string): string => {
  if (path.startsWith('~')) {
    return path.replace('~', homedir())
  }
  if (path.includes('$HOME')) {
    return path.replace('$HOME', homedir())
  }
  return path
}

/**
 * Decode a Claude Code project path from directory name format.
 *
 * Claude Code encodes paths by replacing / with -
 * Example: "-Users-zer0cell-production" -> "/Users/zer0cell/production"
 *
 * @param encodedPath - Directory name from ~/.claude/projects/
 * @returns Decoded absolute path
 */
export const decodeProjectPath = (encodedPath: string): string => {
  // The path starts with a dash representing the root /
  // Each subsequent dash represents a /
  // We need to be careful: "my-project" should become "/my/project"
  // but we must handle the leading dash as root
  if (encodedPath.startsWith('-')) {
    return '/' + encodedPath.slice(1).replace(/-/g, '/')
  }
  // Edge case: no leading dash (shouldn't happen in practice)
  return encodedPath.replace(/-/g, '/')
}

/**
 * Extract UUID from a session JSONL filename.
 *
 * Validates UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 *
 * @param filename - JSONL filename (with or without extension)
 * @returns UUID string or null if invalid format
 */
export const extractUuid = (filename: string): string | null => {
  const name = filename.replace(/\.jsonl$/i, '')
  return UUID_REGEX.test(name) ? name : null
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

/**
 * Map PlatformError to ScanError
 */
const mapPlatformError =
  (path: string) =>
  (error: PlatformError.PlatformError): ScanError => ({
    type: 'io_error',
    path,
    message: error.message,
    cause: error,
  })

// ============================================================================
// DISCOVERY FUNCTIONS
// ============================================================================

/**
 * Discover all subagent files for a session.
 *
 * Path pattern: {sessionDir}/subagents/agent-{id}.jsonl
 * Agent ID format: 7 hex characters (e.g., "a13a7a3")
 *
 * @param sessionDir - Path to session UUID directory
 * @returns Effect yielding array of SubagentFile
 */
export const discoverSubagents = (
  sessionDir: string
): Effect.Effect<SubagentFile[], ScanError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const subagentsDir = join(sessionDir, 'subagents')

    // Check if subagents directory exists
    const exists = yield* pipe(
      fs.exists(subagentsDir),
      Effect.mapError(mapPlatformError(subagentsDir))
    )

    if (!exists) {
      return []
    }

    // Read directory contents
    const entries = yield* pipe(
      fs.readDirectory(subagentsDir),
      Effect.mapError(mapPlatformError(subagentsDir))
    )

    // Process each file
    const subagents: SubagentFile[] = []
    for (const entry of entries) {
      const match = SUBAGENT_REGEX.exec(entry)
      if (match?.[1]) {
        const filePath = join(subagentsDir, entry)
        const stat = yield* pipe(fs.stat(filePath), Effect.mapError(mapPlatformError(filePath)))

        subagents.push({
          agentId: match[1],
          path: filePath,
          modifiedAt: new Date(Number(stat.mtime)),
          sizeBytes: Number(stat.size),
        })
      }
    }

    return subagents
  })

/**
 * Discover all tool result files for a session.
 *
 * Path pattern: {sessionDir}/tool-results/toolu_{id}.txt
 * Tool use ID format: toolu_ prefix followed by alphanumeric ID
 *
 * @param sessionDir - Path to session UUID directory
 * @returns Effect yielding array of ToolResultFile
 */
export const discoverToolResults = (
  sessionDir: string
): Effect.Effect<ToolResultFile[], ScanError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const toolResultsDir = join(sessionDir, 'tool-results')

    // Check if tool-results directory exists
    const exists = yield* pipe(
      fs.exists(toolResultsDir),
      Effect.mapError(mapPlatformError(toolResultsDir))
    )

    if (!exists) {
      return []
    }

    // Read directory contents
    const entries = yield* pipe(
      fs.readDirectory(toolResultsDir),
      Effect.mapError(mapPlatformError(toolResultsDir))
    )

    // Process each file
    const toolResults: ToolResultFile[] = []
    for (const entry of entries) {
      const match = TOOL_RESULT_REGEX.exec(entry)
      if (match?.[1]) {
        const filePath = join(toolResultsDir, entry)
        const stat = yield* pipe(fs.stat(filePath), Effect.mapError(mapPlatformError(filePath)))

        toolResults.push({
          toolUseId: match[1],
          path: filePath,
          sizeBytes: Number(stat.size),
        })
      }
    }

    return toolResults
  })

/**
 * Correlate external artifacts (todos, debug) with a session.
 *
 * Cross-references:
 * - ~/.claude/todos/{uuid}-agent-{id}.json -> session UUID
 * - ~/.claude/debug/{uuid}.txt -> session UUID
 *
 * @param sessionUuid - UUID of the session
 * @param options - Scan options containing base paths
 * @returns Effect yielding { todoFile, debugFile } paths or null
 */
export const correlateArtifacts = (
  sessionUuid: string,
  options?: Pick<ScanOptions, 'basePath'>
): Effect.Effect<
  { todoFile: string | null; debugFile: string | null },
  ScanError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const basePath = expandPath(options?.basePath ?? CLAUDE_PATHS.base)

    // Check for todo file (may have agent suffix)
    const todosDir = join(basePath, 'todos')
    let todoFile: string | null = null

    const todosExists = yield* pipe(
      fs.exists(todosDir),
      Effect.mapError(mapPlatformError(todosDir))
    )

    if (todosExists) {
      const todoPattern = join(todosDir, `${sessionUuid}*.json`)
      const todoMatches = yield* Effect.tryPromise({
        try: () => glob(todoPattern),
        catch: () => ({
          type: 'io_error' as const,
          path: todosDir,
          message: `Failed to glob todos directory`,
        }),
      })
      if (todoMatches.length > 0) {
        todoFile = todoMatches[0] ?? null
      }
    }

    // Check for debug file
    const debugDir = join(basePath, 'debug')
    let debugFile: string | null = null

    const debugExists = yield* pipe(
      fs.exists(debugDir),
      Effect.mapError(mapPlatformError(debugDir))
    )

    if (debugExists) {
      const debugPath = join(debugDir, `${sessionUuid}.txt`)
      const debugFileExists = yield* pipe(
        fs.exists(debugPath),
        Effect.mapError(mapPlatformError(debugPath))
      )
      if (debugFileExists) {
        debugFile = debugPath
      }
    }

    return { todoFile, debugFile }
  })

/**
 * Build a SessionFile from a discovered JSONL file path.
 *
 * Algorithm:
 * 1. Extract UUID from filename
 * 2. Stat the file for size and mtime
 * 3. Check for subagents/ directory
 * 4. Check for tool-results/ directory
 * 5. Cross-reference with ~/.claude/todos/
 * 6. Cross-reference with ~/.claude/debug/
 * 7. Return complete SessionFile
 *
 * @param jsonlPath - Absolute path to main session JSONL file
 * @returns Effect yielding SessionFile or error
 */
export const discoverSession = (
  jsonlPath: string
): Effect.Effect<SessionFile, ScanError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    // Extract UUID from filename
    const filename = basename(jsonlPath)
    const uuid = extractUuid(filename)
    if (!uuid) {
      return yield* Effect.fail({
        type: 'invalid_format' as const,
        path: jsonlPath,
        message: `Filename is not a valid UUID: ${filename}`,
      })
    }

    // Stat the main file
    const stat = yield* pipe(fs.stat(jsonlPath), Effect.mapError(mapPlatformError(jsonlPath)))

    // Get project path info
    const projectDir = dirname(jsonlPath)
    const projectDirName = basename(projectDir)
    const projectPathDecoded = decodeProjectPath(projectDirName)

    // Check for session artifact directory (same name as UUID)
    const sessionDir = join(projectDir, uuid)

    // Discover subagents - graceful degradation on error
    const subagents = yield* Effect.catchAll(discoverSubagents(sessionDir), () =>
      Effect.succeed([] as SubagentFile[])
    )

    // Discover tool results - graceful degradation on error
    const toolResults = yield* Effect.catchAll(discoverToolResults(sessionDir), () =>
      Effect.succeed([] as ToolResultFile[])
    )

    // Correlate external artifacts - graceful degradation on error
    const { todoFile, debugFile } = yield* Effect.catchAll(correlateArtifacts(uuid), () =>
      Effect.succeed({ todoFile: null, debugFile: null })
    )

    return {
      uuid,
      mainFile: jsonlPath,
      projectPath: projectDir,
      projectPathDecoded,
      modifiedAt: new Date(Number(stat.mtime)),
      sizeBytes: Number(stat.size),
      subagents,
      toolResults,
      todoFile,
      debugFile,
    }
  })

/**
 * Scan a directory for all session JSONL files.
 *
 * Algorithm:
 * 1. Expand base path (resolve ~, env vars)
 * 2. Glob for *.jsonl in all subdirectories
 * 3. Filter to UUID-formatted filenames
 * 4. Build SessionFile for each discovered UUID
 * 5. Sort by modification time (oldest first)
 *
 * @param options - Scan configuration options
 * @returns Effect yielding ScanResult with sessions and errors
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   scanDirectory({ basePath: '~/.claude/projects' }).pipe(
 *     Effect.provide(NodeFileSystem.layer)
 *   )
 * )
 * console.log(`Found ${result.sessions.length} sessions`)
 * ```
 */
export const scanDirectory = (
  options?: ScanOptions
): Effect.Effect<ScanResult, ScanError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const startTime = Date.now()

    // Expand base path
    const basePath = expandPath(options?.basePath ?? CLAUDE_PATHS.projects)

    // Glob for all JSONL files, excluding subagents directory
    const globPattern = join(basePath, '**', '*.jsonl')
    const allFiles = yield* Effect.tryPromise({
      try: () =>
        glob(globPattern, {
          ignore: ['**/subagents/**'],
          nodir: true,
        }),
      catch: (e) => ({
        type: 'io_error' as const,
        path: basePath,
        message: `Failed to glob directory: ${e}`,
        cause: e instanceof Error ? e : undefined,
      }),
    })

    // Filter to UUID filenames only
    const sessionFiles = allFiles.filter((f) => extractUuid(basename(f)) !== null)

    const totalDiscovered = sessionFiles.length
    const sessions: SessionFile[] = []
    const errors: ScanError[] = []

    // Discover each session
    for (const file of sessionFiles) {
      const result = yield* Effect.either(discoverSession(file))
      if (result._tag === 'Right') {
        // Apply since filter
        if (options?.since && result.right.modifiedAt <= options.since) {
          continue
        }
        sessions.push(result.right)
      } else {
        errors.push(result.left)
      }
    }

    // Sort oldest first for chronological ingestion
    sessions.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())

    // Apply limit
    const limitedSessions = options?.limit ? sessions.slice(0, options.limit) : sessions

    const skippedByFilter = totalDiscovered - sessions.length
    const durationMs = Date.now() - startTime

    return {
      sessions: limitedSessions,
      errors,
      totalDiscovered,
      skippedByFilter,
      durationMs,
    }
  })

// ============================================================================
// CONVENIENCE RUNNERS
// ============================================================================

/**
 * Run scanDirectory with NodeFileSystem layer.
 * Convenience function for direct execution.
 */
export const runScanDirectory = (options?: ScanOptions): Promise<ScanResult> =>
  Effect.runPromise(scanDirectory(options).pipe(Effect.provide(NodeFileSystem.layer)))

/**
 * Run discoverSession with NodeFileSystem layer.
 * Convenience function for direct execution.
 */
export const runDiscoverSession = (jsonlPath: string): Promise<SessionFile> =>
  Effect.runPromise(discoverSession(jsonlPath).pipe(Effect.provide(NodeFileSystem.layer)))
