/**
 * @module migrations/001_init
 * @description Initial schema migration.
 *
 * Creates:
 * - 3 enum types (session_status, message_role, queue_operation_type)
 * - 9 tables (sessions, messages, tool_calls, agents, file_history, forks,
 *             progress_events, queue_operations, system_events)
 * - TimescaleDB hypertables with appropriate chunk intervals
 * - BRIN indexes for timestamp columns
 * - Partial indexes for common query patterns
 * - Covering indexes for list queries
 *
 * All operations are idempotent via IF NOT EXISTS / DO $$ EXCEPTION patterns.
 */

import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // ========================================
  // ENUM TYPES (idempotent via EXCEPTION)
  // ========================================

  await sql`
    DO $$ BEGIN
      CREATE TYPE session_status AS ENUM ('active', 'pruned', 'compacted');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `.execute(db)

  await sql`
    DO $$ BEGIN
      CREATE TYPE message_role AS ENUM ('user', 'assistant');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `.execute(db)

  await sql`
    DO $$ BEGIN
      CREATE TYPE queue_operation_type AS ENUM ('enqueue', 'dequeue');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `.execute(db)

  // ========================================
  // SESSIONS TABLE (20-30/day, 1 week chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      project_path TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ,
      status session_status NOT NULL DEFAULT 'active',
      title TEXT,
      custom_title TEXT,

      -- Metadata from JSONL
      version TEXT,
      slug TEXT,
      cwd TEXT,
      git_branch TEXT,
      user_type TEXT,
      parent_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
      is_sidechain BOOLEAN DEFAULT FALSE,
      leaf_uuid UUID,

      -- Aggregates
      total_messages INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,

      -- Timestamps
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT sessions_started_at_check CHECK (started_at IS NOT NULL)
    )
  `.execute(db)

  // BRIN index for timestamp (space-efficient)
  await sql`
    CREATE INDEX IF NOT EXISTS sessions_started_at_brin_idx
    ON sessions USING BRIN(started_at) WITH (pages_per_range = 32)
  `.execute(db)

  // Partial index for active sessions
  await sql`
    CREATE INDEX IF NOT EXISTS sessions_active_idx
    ON sessions(project_path, started_at DESC)
    WHERE status = 'active'
  `.execute(db)

  // Covering index for session list queries
  await sql`
    CREATE INDEX IF NOT EXISTS sessions_list_idx
    ON sessions(project_path, status, started_at DESC)
    INCLUDE (title, slug, total_messages, total_tokens)
  `.execute(db)

  // Parent session lookup
  await sql`
    CREATE INDEX IF NOT EXISTS sessions_parent_session_id_idx
    ON sessions(parent_session_id) WHERE parent_session_id IS NOT NULL
  `.execute(db)

  // TimescaleDB hypertable
  await sql`
    SELECT create_hypertable(
      'sessions',
      'started_at',
      chunk_time_interval => INTERVAL '1 week',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // MESSAGES TABLE (500-1000/day, 1 day chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      timestamp TIMESTAMPTZ NOT NULL,
      role message_role NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER,

      -- Metadata from JSONL
      parent_uuid UUID,
      uuid UUID,
      request_id TEXT,
      message_id TEXT,
      model TEXT,
      stop_reason TEXT,
      stop_sequence TEXT,
      is_meta BOOLEAN DEFAULT FALSE,

      -- Token usage breakdown
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_creation_input_tokens INTEGER,
      cache_read_input_tokens INTEGER,
      ephemeral_5m_input_tokens INTEGER,
      ephemeral_1h_input_tokens INTEGER,
      service_tier TEXT,

      -- Ordering
      sequence_number INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT messages_timestamp_check CHECK (timestamp IS NOT NULL)
    )
  `.execute(db)

  // BRIN index for timestamp
  await sql`
    CREATE INDEX IF NOT EXISTS messages_timestamp_brin_idx
    ON messages USING BRIN(timestamp) WITH (pages_per_range = 32)
  `.execute(db)

  // Session timeline index
  await sql`
    CREATE INDEX IF NOT EXISTS messages_session_timeline_idx
    ON messages(session_id, timestamp ASC)
  `.execute(db)

  // Partial index for assistant messages
  await sql`
    CREATE INDEX IF NOT EXISTS messages_assistant_idx
    ON messages(session_id, timestamp ASC)
    WHERE role = 'assistant'
  `.execute(db)

  // Model analytics index
  await sql`
    CREATE INDEX IF NOT EXISTS messages_model_idx
    ON messages(model, timestamp DESC) WHERE model IS NOT NULL
  `.execute(db)

  // Threading index
  await sql`
    CREATE INDEX IF NOT EXISTS messages_parent_uuid_idx
    ON messages(parent_uuid) WHERE parent_uuid IS NOT NULL
  `.execute(db)

  // TimescaleDB hypertable
  await sql`
    SELECT create_hypertable(
      'messages',
      'timestamp',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // TOOL_CALLS TABLE (30-150/day, 1 day chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

      type TEXT NOT NULL,
      input JSONB NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      duration_ms INTEGER,

      result_file_path TEXT,
      result_truncated BOOLEAN DEFAULT FALSE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT tool_calls_timestamp_check CHECK (timestamp IS NOT NULL)
    )
  `.execute(db)

  // BRIN index for timestamp
  await sql`
    CREATE INDEX IF NOT EXISTS tool_calls_timestamp_brin_idx
    ON tool_calls USING BRIN(timestamp) WITH (pages_per_range = 32)
  `.execute(db)

  // Session tool calls index
  await sql`
    CREATE INDEX IF NOT EXISTS tool_calls_session_idx
    ON tool_calls(session_id, timestamp DESC)
  `.execute(db)

  // Partial indexes per common tool type
  await sql`
    CREATE INDEX IF NOT EXISTS tool_calls_read_idx
    ON tool_calls(session_id, timestamp DESC) WHERE type = 'Read'
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS tool_calls_bash_idx
    ON tool_calls(session_id, timestamp DESC) WHERE type = 'Bash'
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS tool_calls_edit_idx
    ON tool_calls(session_id, timestamp DESC) WHERE type = 'Edit'
  `.execute(db)

  // GIN index for JSONB queries
  await sql`
    CREATE INDEX IF NOT EXISTS tool_calls_input_gin_idx
    ON tool_calls USING GIN(input jsonb_path_ops)
  `.execute(db)

  // TimescaleDB hypertable
  await sql`
    SELECT create_hypertable(
      'tool_calls',
      'timestamp',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // AGENTS TABLE (~0.5/day, 1 month chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS agents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      parent_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,

      agent_id TEXT,
      is_sidechain BOOLEAN DEFAULT TRUE,

      created_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ,

      total_messages INTEGER DEFAULT 0,
      depth INTEGER DEFAULT 1,

      CONSTRAINT agents_created_at_check CHECK (created_at IS NOT NULL)
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS agents_session_id_idx ON agents(session_id)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS agents_agent_id_idx
    ON agents(agent_id) WHERE agent_id IS NOT NULL
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS agents_hierarchy_idx
    ON agents(session_id, parent_agent_id, depth)
  `.execute(db)

  await sql`
    SELECT create_hypertable(
      'agents',
      'created_at',
      chunk_time_interval => INTERVAL '1 month',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // FILE_HISTORY TABLE (~50/day, 1 day chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS file_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
      timestamp TIMESTAMPTZ NOT NULL,

      tracked_files JSONB NOT NULL,
      is_snapshot_update BOOLEAN DEFAULT FALSE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT file_history_timestamp_check CHECK (timestamp IS NOT NULL)
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS file_history_session_idx
    ON file_history(session_id, timestamp DESC)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS file_history_tracked_files_gin_idx
    ON file_history USING GIN(tracked_files)
  `.execute(db)

  await sql`
    SELECT create_hypertable(
      'file_history',
      'timestamp',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // FORKS TABLE (~0/day, 1 month chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS forks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      child_session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      fork_point_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT forks_created_at_check CHECK (created_at IS NOT NULL)
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS forks_parent_session_id_idx ON forks(parent_session_id)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS forks_child_session_id_idx ON forks(child_session_id)
  `.execute(db)

  await sql`
    SELECT create_hypertable(
      'forks',
      'created_at',
      chunk_time_interval => INTERVAL '1 month',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // PROGRESS_EVENTS TABLE (1500-3000/day, 1 day chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS progress_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
      timestamp TIMESTAMPTZ NOT NULL,

      hook_event TEXT,
      hook_name TEXT,
      command TEXT,
      tool_use_id TEXT,
      parent_tool_use_id TEXT,

      uuid UUID,
      parent_uuid UUID,

      CONSTRAINT progress_events_timestamp_check CHECK (timestamp IS NOT NULL)
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS progress_events_timestamp_brin_idx
    ON progress_events USING BRIN(timestamp) WITH (pages_per_range = 32)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS progress_events_session_idx
    ON progress_events(session_id, timestamp DESC)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS progress_events_tool_use_id_idx
    ON progress_events(tool_use_id) WHERE tool_use_id IS NOT NULL
  `.execute(db)

  await sql`
    SELECT create_hypertable(
      'progress_events',
      'timestamp',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // QUEUE_OPERATIONS TABLE (~5/day, 1 month chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS queue_operations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      timestamp TIMESTAMPTZ NOT NULL,

      operation queue_operation_type NOT NULL,
      content TEXT NOT NULL,

      CONSTRAINT queue_operations_timestamp_check CHECK (timestamp IS NOT NULL)
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS queue_operations_session_idx
    ON queue_operations(session_id, timestamp DESC)
  `.execute(db)

  await sql`
    SELECT create_hypertable(
      'queue_operations',
      'timestamp',
      chunk_time_interval => INTERVAL '1 month',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // SYSTEM_EVENTS TABLE (~30/day, 1 week chunks)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS system_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      timestamp TIMESTAMPTZ NOT NULL,

      subtype TEXT NOT NULL,
      duration_ms INTEGER,

      uuid UUID,
      parent_uuid UUID,
      is_meta BOOLEAN DEFAULT FALSE,

      CONSTRAINT system_events_timestamp_check CHECK (timestamp IS NOT NULL)
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS system_events_session_idx
    ON system_events(session_id, timestamp DESC)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS system_events_subtype_idx
    ON system_events(subtype, timestamp DESC)
  `.execute(db)

  await sql`
    SELECT create_hypertable(
      'system_events',
      'timestamp',
      chunk_time_interval => INTERVAL '1 week',
      if_not_exists => TRUE
    )
  `.execute(db)

  // ========================================
  // INGESTION STATE TABLE (cursor tracking)
  // ========================================

  await sql`
    CREATE TABLE IF NOT EXISTS ingestion_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db)
}

// No down migration - forward-only preferred for production safety
