/**
 * @module scanner
 * @description Re-export all scanner module exports for clean imports.
 *
 * The scanner module discovers and correlates Claude Code session artifacts
 * from ~/.claude/. It provides the file discovery layer for the ingestion pipeline.
 *
 * @example
 * ```typescript
 * import {
 *   scanDirectory,
 *   sortOldestFirst,
 *   type SessionFile
 * } from '@inherent.design/simulacrum-replay/scanner'
 *
 * const result = await runScanDirectory()
 * console.log(`Discovered ${result.sessions.length} sessions`)
 * ```
 */

// Types
export type {
  SessionFile,
  SubagentFile,
  ToolResultFile,
  ScanResult,
  ScanError,
  ScanOptions,
} from './types.ts'

// Constants
export { CLAUDE_PATHS } from './types.ts'

// Discovery functions
export {
  scanDirectory,
  discoverSession,
  discoverSubagents,
  discoverToolResults,
  correlateArtifacts,
  expandPath,
  decodeProjectPath,
  extractUuid,
  // Convenience runners
  runScanDirectory,
  runDiscoverSession,
} from './discovery.ts'

// Filter/sort functions
export {
  filterByProject,
  filterBySince,
  filterByDateRange,
  sortOldestFirst,
  sortNewestFirst,
  sortByProject,
  applyFilters,
  totalSizeBytes,
  estimateIngestionTime,
  countByProject,
  getDateRange,
} from './filters.ts'
