/**
 * @module scanner/filters
 * @description Filtering and sorting utilities for session lists.
 *
 * Pure functions for composable session filtering and sorting.
 * All functions return new arrays (no mutation).
 */

import { minimatch } from 'minimatch'

import type { SessionFile, ScanOptions } from './types.ts'

// ============================================================================
// PROJECT FILTERING
// ============================================================================

/**
 * Filter sessions by project path pattern.
 *
 * Supports:
 * - Exact match: "/Users/zer0cell/production"
 * - Glob patterns: "**\/production\/*"
 * - Partial match: "production" (matches any path containing "production")
 *
 * @param sessions - Array of sessions to filter
 * @param pattern - Project path pattern (glob or exact)
 * @returns Filtered array of sessions
 *
 * @example
 * ```typescript
 * // Filter to production project only
 * const prodSessions = filterByProject(sessions, '/Users/zer0cell/production')
 *
 * // Filter to any project containing "simulacrum"
 * const simSessions = filterByProject(sessions, '**\/simulacrum\/**')
 * ```
 */
export const filterByProject = (sessions: SessionFile[], pattern: string): SessionFile[] => {
  return sessions.filter((session) => {
    // Try exact match first
    if (session.projectPathDecoded === pattern) {
      return true
    }

    // Try glob pattern match
    if (minimatch(session.projectPathDecoded, pattern, { matchBase: true })) {
      return true
    }

    // Try partial string match (case-insensitive)
    if (session.projectPathDecoded.toLowerCase().includes(pattern.toLowerCase())) {
      return true
    }

    return false
  })
}

// ============================================================================
// DATE FILTERING
// ============================================================================

/**
 * Filter sessions modified after a given date.
 *
 * Used for incremental ingestion: only process sessions
 * that have been updated since the last ingestion run.
 *
 * @param sessions - Array of sessions to filter
 * @param since - Minimum modification date (exclusive)
 * @returns Sessions modified after `since`
 *
 * @example
 * ```typescript
 * // Only sessions modified in the last 24 hours
 * const recentSessions = filterBySince(sessions, new Date(Date.now() - 86400000))
 * ```
 */
export const filterBySince = (sessions: SessionFile[], since: Date): SessionFile[] => {
  const sinceTime = since.getTime()
  return sessions.filter((session) => session.modifiedAt.getTime() > sinceTime)
}

/**
 * Filter sessions modified within a date range.
 *
 * @param sessions - Array of sessions to filter
 * @param start - Start of range (inclusive)
 * @param end - End of range (inclusive)
 * @returns Sessions modified within range
 */
export const filterByDateRange = (
  sessions: SessionFile[],
  start: Date,
  end: Date
): SessionFile[] => {
  const startTime = start.getTime()
  const endTime = end.getTime()
  return sessions.filter((session) => {
    const mtime = session.modifiedAt.getTime()
    return mtime >= startTime && mtime <= endTime
  })
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort sessions by modification time, oldest first.
 *
 * This is the required order for ingestion to preserve
 * chronological message ordering and parent-child relationships.
 *
 * @param sessions - Array of sessions to sort
 * @returns New array sorted oldest-first (does not mutate input)
 */
export const sortOldestFirst = (sessions: SessionFile[]): SessionFile[] => {
  return [...sessions].sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())
}

/**
 * Sort sessions by modification time, newest first.
 *
 * Useful for UI display where recent sessions are more relevant.
 *
 * @param sessions - Array of sessions to sort
 * @returns New array sorted newest-first (does not mutate input)
 */
export const sortNewestFirst = (sessions: SessionFile[]): SessionFile[] => {
  return [...sessions].sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
}

/**
 * Sort sessions by project path, then by modification time.
 *
 * Groups sessions by project for batch processing.
 *
 * @param sessions - Array of sessions to sort
 * @returns New array sorted by project, then oldest-first within project
 */
export const sortByProject = (sessions: SessionFile[]): SessionFile[] => {
  return [...sessions].sort((a, b) => {
    const projectCompare = a.projectPathDecoded.localeCompare(b.projectPathDecoded)
    if (projectCompare !== 0) {
      return projectCompare
    }
    return a.modifiedAt.getTime() - b.modifiedAt.getTime()
  })
}

// ============================================================================
// COMBINED FILTER/SORT
// ============================================================================

/**
 * Apply all filters from ScanOptions and sort oldest-first.
 *
 * This is the main entry point for applying user-specified
 * filtering criteria before ingestion.
 *
 * @param sessions - Array of sessions to process
 * @param options - Scan options with filter criteria
 * @returns Filtered and sorted sessions
 */
export const applyFilters = (sessions: SessionFile[], options: ScanOptions): SessionFile[] => {
  let result = [...sessions]

  // Apply project filter
  if (options.projectFilter) {
    result = filterByProject(result, options.projectFilter)
  }

  // Apply since filter
  if (options.since) {
    result = filterBySince(result, options.since)
  }

  // Sort oldest first for chronological ingestion
  result = sortOldestFirst(result)

  // Apply limit
  if (options.limit && options.limit > 0) {
    result = result.slice(0, options.limit)
  }

  return result
}

// ============================================================================
// SIZE ESTIMATION
// ============================================================================

/**
 * Calculate total size of all session files for progress estimation.
 *
 * Includes main JSONL + all subagents + all tool results.
 *
 * @param sessions - Array of sessions
 * @returns Total size in bytes
 */
export const totalSizeBytes = (sessions: SessionFile[]): number => {
  return sessions.reduce((total, session) => {
    // Main file size
    let size = session.sizeBytes

    // Subagent sizes
    for (const subagent of session.subagents) {
      size += subagent.sizeBytes
    }

    // Tool result sizes
    for (const toolResult of session.toolResults) {
      size += toolResult.sizeBytes
    }

    return total + size
  }, 0)
}

/**
 * Estimate ingestion time based on file sizes.
 *
 * Uses empirical rate of ~1MB/second for JSONL parsing + DB writes.
 *
 * @param sessions - Array of sessions
 * @returns Estimated duration in milliseconds
 */
export const estimateIngestionTime = (sessions: SessionFile[]): number => {
  const totalBytes = totalSizeBytes(sessions)
  // Empirical rate: ~1MB/second for JSONL parsing + DB writes
  const bytesPerMs = 1024 // 1KB per millisecond = 1MB per second
  return Math.ceil(totalBytes / bytesPerMs)
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Count sessions by project path.
 *
 * @param sessions - Array of sessions
 * @returns Map of project path to session count
 */
export const countByProject = (sessions: SessionFile[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const session of sessions) {
    const current = counts.get(session.projectPathDecoded) ?? 0
    counts.set(session.projectPathDecoded, current + 1)
  }
  return counts
}

/**
 * Get date range of sessions.
 *
 * @param sessions - Array of sessions
 * @returns { earliest, latest } dates or null if empty
 */
export const getDateRange = (sessions: SessionFile[]): { earliest: Date; latest: Date } | null => {
  if (sessions.length === 0) {
    return null
  }

  let earliest = sessions[0]!.modifiedAt
  let latest = sessions[0]!.modifiedAt

  for (const session of sessions) {
    if (session.modifiedAt < earliest) {
      earliest = session.modifiedAt
    }
    if (session.modifiedAt > latest) {
      latest = session.modifiedAt
    }
  }

  return { earliest, latest }
}
