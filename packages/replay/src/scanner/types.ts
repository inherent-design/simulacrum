/**
 * @module scanner/types
 * @description TypeScript types and interfaces for the scanner module.
 *
 * These types are internal to the replay package and not exported from common.
 * They define the file discovery layer for the ingestion pipeline.
 */

// ============================================================================
// SESSION FILE TYPES
// ============================================================================

/**
 * Represents a discovered session with all correlated artifacts.
 * Created by discoverSession() after scanning a session UUID directory.
 */
export interface SessionFile {
  /** UUID of the session (extracted from filename) */
  uuid: string

  /** Path to main session JSONL file */
  mainFile: string

  /** Absolute path to project directory (e.g., ~/.claude/projects/-Users-zer0cell-production) */
  projectPath: string

  /** Original project path decoded from directory name (e.g., /Users/zer0cell/production) */
  projectPathDecoded: string

  /** File modification time of main JSONL (used for ordering) */
  modifiedAt: Date

  /** File size in bytes (for progress estimation) */
  sizeBytes: number

  /** List of discovered subagent JSONL files */
  subagents: SubagentFile[]

  /** List of discovered tool-result files */
  toolResults: ToolResultFile[]

  /** Path to todo file if exists */
  todoFile: string | null

  /** Path to debug log if exists */
  debugFile: string | null
}

/**
 * Represents a subagent JSONL file within a session.
 * Found in: ~/.claude/projects/{path}/{uuid}/subagents/agent-{id}.jsonl
 */
export interface SubagentFile {
  /** Short agent ID (7 hex chars, e.g., "a13a7a3") */
  agentId: string

  /** Full path to subagent JSONL file */
  path: string

  /** File modification time */
  modifiedAt: Date

  /** File size in bytes */
  sizeBytes: number
}

/**
 * Represents a tool result file within a session.
 * Found in: ~/.claude/projects/{path}/{uuid}/tool-results/toolu_{id}.txt
 */
export interface ToolResultFile {
  /** Tool use ID (toolu_XXXXX format) */
  toolUseId: string

  /** Full path to tool result file */
  path: string

  /** File size in bytes */
  sizeBytes: number
}

// ============================================================================
// SCAN RESULT TYPES
// ============================================================================

/**
 * Result of scanning a directory for sessions.
 */
export interface ScanResult {
  /** Successfully discovered sessions */
  sessions: SessionFile[]

  /** Errors encountered during scanning (non-fatal) */
  errors: ScanError[]

  /** Total sessions found before filtering */
  totalDiscovered: number

  /** Sessions skipped by filters */
  skippedByFilter: number

  /** Scan duration in milliseconds */
  durationMs: number
}

/**
 * Error encountered during scanning.
 * Non-fatal: scanning continues with other sessions.
 */
export interface ScanError {
  /** Error type for categorization */
  type: 'io_error' | 'parse_error' | 'permission_error' | 'invalid_format'

  /** Path where error occurred */
  path: string

  /** Human-readable error message */
  message: string

  /** Original error if available */
  cause?: Error
}

// ============================================================================
// SCAN OPTIONS
// ============================================================================

/**
 * Options for configuring the session scan.
 */
export interface ScanOptions {
  /**
   * Base path to scan for sessions.
   * Default: ~/.claude/projects
   */
  basePath?: string

  /**
   * Filter sessions by project path pattern.
   * Supports glob patterns (e.g., "**\/production\/*")
   * If undefined, all projects are included.
   */
  projectFilter?: string

  /**
   * Only include sessions modified after this date.
   * Used for incremental ingestion.
   */
  since?: Date

  /**
   * Maximum number of sessions to return.
   * Useful for testing or batch processing.
   */
  limit?: number

  /**
   * Include sessions without subagents/tool-results.
   * Default: true
   */
  includeOrphans?: boolean
}

// ============================================================================
// PATH CONSTANTS
// ============================================================================

/**
 * Default paths for Claude Code artifacts.
 * Platform-specific resolution handled at runtime.
 */
export const CLAUDE_PATHS = {
  /** Base directory for all Claude Code data */
  base: '~/.claude',

  /** Session transcripts directory */
  projects: '~/.claude/projects',

  /** Todo files directory */
  todos: '~/.claude/todos',

  /** Debug logs directory */
  debug: '~/.claude/debug',

  /** Global history file */
  history: '~/.claude/history.jsonl',

  /** Stats cache file */
  statsCache: '~/.claude/stats-cache.json',
} as const
