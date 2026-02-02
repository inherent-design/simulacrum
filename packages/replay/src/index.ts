/**
 * @module @inherent.design/simulacrum-replay
 * @description Claude Code session ingestion CLI and library.
 *
 * Provides scanning, parsing, and storage functionality for
 * ingesting historical Claude Code sessions into PostgreSQL.
 */

// Scanner module - file discovery and artifact correlation
export * from './scanner/index.ts'

// Migrations module - database schema and TimescaleDB setup
export * from './migrations/index.ts'

// Parser module - JSONL streaming, decoding, batching, routing
export * from './parser/index.ts'

// Store module - batch ingestion, staging tables, cursor management
export * from './store/index.ts'
