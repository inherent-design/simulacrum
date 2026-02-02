/**
 * @module migrations/004_compression
 * @description Compression policies for TimescaleDB tables.
 *
 * Strategy:
 * - High-volume tables (messages, tool_calls, progress_events, file_history): 7-day compression
 * - Low-volume tables (sessions, system_events): 14-30 day compression
 *
 * Segment by columns used in WHERE clauses for efficient decompression.
 * Order by timestamp DESC for time-range queries.
 */

import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // ========================================
  // MESSAGES: 7-day compression
  // ========================================

  await sql`
    ALTER TABLE messages SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'session_id,role',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `.execute(db)

  await sql`
    SELECT add_compression_policy(
      'messages',
      compress_after => INTERVAL '7 days',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // TOOL_CALLS: 7-day compression
  // ========================================

  await sql`
    ALTER TABLE tool_calls SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'session_id,type',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `.execute(db)

  await sql`
    SELECT add_compression_policy(
      'tool_calls',
      compress_after => INTERVAL '7 days',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // PROGRESS_EVENTS: 7-day compression (highest volume)
  // ========================================

  await sql`
    ALTER TABLE progress_events SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'session_id',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `.execute(db)

  await sql`
    SELECT add_compression_policy(
      'progress_events',
      compress_after => INTERVAL '7 days',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // FILE_HISTORY: 7-day compression
  // ========================================

  await sql`
    ALTER TABLE file_history SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'session_id',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `.execute(db)

  await sql`
    SELECT add_compression_policy(
      'file_history',
      compress_after => INTERVAL '7 days',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // SESSIONS: 30-day compression
  // ========================================

  await sql`
    ALTER TABLE sessions SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'project_path,status',
      timescaledb.compress_orderby = 'started_at DESC'
    )
  `.execute(db)

  await sql`
    SELECT add_compression_policy(
      'sessions',
      compress_after => INTERVAL '30 days',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // SYSTEM_EVENTS: 14-day compression
  // ========================================

  await sql`
    ALTER TABLE system_events SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'session_id,subtype',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `.execute(db)

  await sql`
    SELECT add_compression_policy(
      'system_events',
      compress_after => INTERVAL '14 days',
      if_not_exists => TRUE
    )
  `.execute(db)
}

// No down migration - cannot easily remove compression policies safely
