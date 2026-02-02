/**
 * @module migrations
 * @description Exports for the migrations module.
 *
 * Provides:
 * - Migration runner (Effect-wrapped, idempotent)
 * - Error types for tagged error handling
 * - Migration interface and result types
 */

export {
  runMigrations,
  getAppliedMigrations,
  MigrationTableError,
  MigrationReadError,
  MigrationExecuteError,
  type MigrationModule,
  type MigrationResult,
} from './runner.ts'
