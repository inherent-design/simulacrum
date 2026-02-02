/**
 * @module migrations/003_aggregates
 * @description Continuous aggregates for analytics dashboards.
 *
 * Creates:
 * - daily_message_counts (dashboard analytics)
 * - hourly_tool_call_stats (tool usage analytics)
 * - session_activity_summary (project-level analytics)
 * - daily_model_usage (token/cost analytics)
 *
 * All use materialized_only=true for query performance over realtime.
 * Refresh policies run hourly for high-volume tables, 6-hourly for low-volume.
 */

import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // ========================================
  // DAILY MESSAGE COUNTS
  // ========================================

  await sql`
    CREATE MATERIALIZED VIEW IF NOT EXISTS daily_message_counts
    WITH (timescaledb.continuous, timescaledb.materialized_only=true)
    AS
    SELECT
      time_bucket('1 day', timestamp) AS day,
      session_id,
      role,
      COUNT(*) AS message_count,
      SUM(COALESCE(token_count, 0)) AS total_tokens,
      AVG(COALESCE(token_count, 0))::INTEGER AS avg_tokens_per_message,
      SUM(COALESCE(input_tokens, 0)) AS total_input_tokens,
      SUM(COALESCE(output_tokens, 0)) AS total_output_tokens,
      SUM(COALESCE(cache_read_input_tokens, 0)) AS total_cache_read_tokens,
      SUM(COALESCE(cache_creation_input_tokens, 0)) AS total_cache_creation_tokens
    FROM messages
    GROUP BY day, session_id, role
    WITH NO DATA
  `.execute(db)

  await sql`
    SELECT add_continuous_aggregate_policy(
      'daily_message_counts',
      start_offset => INTERVAL '7 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // HOURLY TOOL CALL STATS
  // ========================================

  await sql`
    CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_tool_call_stats
    WITH (timescaledb.continuous, timescaledb.materialized_only=true)
    AS
    SELECT
      time_bucket('1 hour', timestamp) AS hour,
      type AS tool_type,
      COUNT(*) AS call_count,
      AVG(duration_ms)::INTEGER AS avg_duration_ms,
      MAX(duration_ms) AS max_duration_ms,
      MIN(duration_ms) AS min_duration_ms,
      COUNT(CASE WHEN result_truncated THEN 1 END) AS truncated_count
    FROM tool_calls
    GROUP BY hour, tool_type
    WITH NO DATA
  `.execute(db)

  await sql`
    SELECT add_continuous_aggregate_policy(
      'hourly_tool_call_stats',
      start_offset => INTERVAL '3 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // SESSION ACTIVITY SUMMARY
  // ========================================

  await sql`
    CREATE MATERIALIZED VIEW IF NOT EXISTS session_activity_summary
    WITH (timescaledb.continuous, timescaledb.materialized_only=true)
    AS
    SELECT
      time_bucket('1 day', started_at) AS day,
      project_path,
      status,
      COUNT(*) AS session_count,
      SUM(total_messages) AS total_messages,
      SUM(total_tokens) AS total_tokens,
      AVG(total_messages)::INTEGER AS avg_messages_per_session
    FROM sessions
    GROUP BY day, project_path, status
    WITH NO DATA
  `.execute(db)

  await sql`
    SELECT add_continuous_aggregate_policy(
      'session_activity_summary',
      start_offset => INTERVAL '30 days',
      end_offset => INTERVAL '1 day',
      schedule_interval => INTERVAL '6 hours',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // DAILY MODEL USAGE
  // ========================================

  await sql`
    CREATE MATERIALIZED VIEW IF NOT EXISTS daily_model_usage
    WITH (timescaledb.continuous, timescaledb.materialized_only=true)
    AS
    SELECT
      time_bucket('1 day', timestamp) AS day,
      model,
      COUNT(*) AS message_count,
      SUM(COALESCE(input_tokens, 0)) AS total_input_tokens,
      SUM(COALESCE(output_tokens, 0)) AS total_output_tokens,
      SUM(COALESCE(cache_read_input_tokens, 0)) AS total_cache_read_tokens,
      SUM(COALESCE(cache_creation_input_tokens, 0)) AS total_cache_creation_tokens
    FROM messages
    WHERE model IS NOT NULL
    GROUP BY day, model
    WITH NO DATA
  `.execute(db)

  await sql`
    SELECT add_continuous_aggregate_policy(
      'daily_model_usage',
      start_offset => INTERVAL '7 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `.execute(db)
}

// No down migration - dropping continuous aggregates loses historical data
