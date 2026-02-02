/**
 * @module migrations/002_staging
 * @description Staging tables for batch ingestion.
 *
 * Creates:
 * - UNLOGGED staging tables (no WAL = 30-50% faster writes)
 * - Flush functions (INSERT INTO SELECT with ON CONFLICT DO NOTHING)
 * - truncate_staging_tables helper function
 *
 * Pattern:
 * 1. Insert into staging tables (fast, no constraints)
 * 2. Call flush function (atomic upsert to production)
 * 3. Staging is truncated automatically in flush function
 */

import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // ========================================
  // SESSIONS STAGING TABLE
  // ========================================

  await sql`
    CREATE UNLOGGED TABLE IF NOT EXISTS sessions_staging (
      id UUID NOT NULL,
      project_path TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active',
      title TEXT,
      custom_title TEXT,
      version TEXT,
      slug TEXT,
      cwd TEXT,
      git_branch TEXT,
      user_type TEXT,
      parent_session_id UUID,
      is_sidechain BOOLEAN DEFAULT FALSE,
      leaf_uuid UUID,
      total_messages INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0
    )
  `.execute(db)

  // ========================================
  // MESSAGES STAGING TABLE
  // ========================================

  await sql`
    CREATE UNLOGGED TABLE IF NOT EXISTS messages_staging (
      id UUID NOT NULL,
      session_id UUID NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER,
      parent_uuid UUID,
      uuid UUID,
      request_id TEXT,
      message_id TEXT,
      model TEXT,
      stop_reason TEXT,
      stop_sequence TEXT,
      is_meta BOOLEAN DEFAULT FALSE,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_creation_input_tokens INTEGER,
      cache_read_input_tokens INTEGER,
      ephemeral_5m_input_tokens INTEGER,
      ephemeral_1h_input_tokens INTEGER,
      service_tier TEXT,
      sequence_number INTEGER
    )
  `.execute(db)

  // ========================================
  // TOOL_CALLS STAGING TABLE
  // ========================================

  await sql`
    CREATE UNLOGGED TABLE IF NOT EXISTS tool_calls_staging (
      id TEXT NOT NULL,
      message_id UUID NOT NULL,
      session_id UUID NOT NULL,
      type TEXT NOT NULL,
      input JSONB NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      duration_ms INTEGER,
      result_file_path TEXT,
      result_truncated BOOLEAN DEFAULT FALSE
    )
  `.execute(db)

  // ========================================
  // PROGRESS_EVENTS STAGING TABLE
  // ========================================

  await sql`
    CREATE UNLOGGED TABLE IF NOT EXISTS progress_events_staging (
      id UUID NOT NULL,
      session_id UUID NOT NULL,
      message_id UUID,
      timestamp TIMESTAMPTZ NOT NULL,
      hook_event TEXT,
      hook_name TEXT,
      command TEXT,
      tool_use_id TEXT,
      parent_tool_use_id TEXT,
      uuid UUID,
      parent_uuid UUID
    )
  `.execute(db)

  // ========================================
  // FLUSH FUNCTIONS
  // ========================================

  // Flush sessions staging to production
  await sql`
    CREATE OR REPLACE FUNCTION flush_sessions_staging()
    RETURNS TABLE(inserted_count BIGINT) AS $$
    BEGIN
      RETURN QUERY
      WITH inserted AS (
        INSERT INTO sessions (
          id, project_path, started_at, ended_at, status, title, custom_title,
          version, slug, cwd, git_branch, user_type, parent_session_id,
          is_sidechain, leaf_uuid, total_messages, total_tokens
        )
        SELECT
          id, project_path, started_at, ended_at, status::session_status, title, custom_title,
          version, slug, cwd, git_branch, user_type, parent_session_id,
          is_sidechain, leaf_uuid, total_messages, total_tokens
        FROM sessions_staging
        ON CONFLICT (id) DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT FROM inserted;

      TRUNCATE sessions_staging;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  // Flush messages staging to production
  await sql`
    CREATE OR REPLACE FUNCTION flush_messages_staging()
    RETURNS TABLE(inserted_count BIGINT) AS $$
    BEGIN
      RETURN QUERY
      WITH inserted AS (
        INSERT INTO messages (
          id, session_id, timestamp, role, content, token_count,
          parent_uuid, uuid, request_id, message_id, model, stop_reason, stop_sequence,
          is_meta, input_tokens, output_tokens, cache_creation_input_tokens,
          cache_read_input_tokens, ephemeral_5m_input_tokens, ephemeral_1h_input_tokens,
          service_tier, sequence_number
        )
        SELECT
          id, session_id, timestamp, role::message_role, content, token_count,
          parent_uuid, uuid, request_id, message_id, model, stop_reason, stop_sequence,
          is_meta, input_tokens, output_tokens, cache_creation_input_tokens,
          cache_read_input_tokens, ephemeral_5m_input_tokens, ephemeral_1h_input_tokens,
          service_tier, sequence_number
        FROM messages_staging
        ON CONFLICT (id) DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT FROM inserted;

      TRUNCATE messages_staging;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  // Flush tool_calls staging to production
  await sql`
    CREATE OR REPLACE FUNCTION flush_tool_calls_staging()
    RETURNS TABLE(inserted_count BIGINT) AS $$
    BEGIN
      RETURN QUERY
      WITH inserted AS (
        INSERT INTO tool_calls (
          id, message_id, session_id, type, input, timestamp,
          duration_ms, result_file_path, result_truncated
        )
        SELECT
          id, message_id, session_id, type, input, timestamp,
          duration_ms, result_file_path, result_truncated
        FROM tool_calls_staging
        ON CONFLICT (id) DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT FROM inserted;

      TRUNCATE tool_calls_staging;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  // Flush progress_events staging to production
  await sql`
    CREATE OR REPLACE FUNCTION flush_progress_events_staging()
    RETURNS TABLE(inserted_count BIGINT) AS $$
    BEGIN
      RETURN QUERY
      WITH inserted AS (
        INSERT INTO progress_events (
          id, session_id, message_id, timestamp, hook_event, hook_name,
          command, tool_use_id, parent_tool_use_id, uuid, parent_uuid
        )
        SELECT
          id, session_id, message_id, timestamp, hook_event, hook_name,
          command, tool_use_id, parent_tool_use_id, uuid, parent_uuid
        FROM progress_events_staging
        ON CONFLICT (id) DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT FROM inserted;

      TRUNCATE progress_events_staging;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  // ========================================
  // HELPER FUNCTION: Truncate all staging tables
  // ========================================

  await sql`
    CREATE OR REPLACE FUNCTION truncate_staging_tables()
    RETURNS void AS $$
    BEGIN
      TRUNCATE sessions_staging;
      TRUNCATE messages_staging;
      TRUNCATE tool_calls_staging;
      TRUNCATE progress_events_staging;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)
}

// No down migration - forward-only preferred
