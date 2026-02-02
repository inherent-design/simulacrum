/**
 * @module schemas
 * @description Re-exports all Effect Schema definitions for clean package imports
 */

// ============================================================================
// Enum Schemas
// ============================================================================

export { SessionStatus, MessageRole, QueueOperationType } from './domain.js'

// ============================================================================
// Domain Schemas (9 tables)
// ============================================================================

export {
  Session,
  Message,
  ToolCall,
  Agent,
  FileHistory,
  Fork,
  ProgressEvent,
  QueueOperation,
  SystemEvent,
} from './domain.js'

// ============================================================================
// Transport Contracts
// ============================================================================

export {
  // Pagination
  PaginationParams,
  // Session API
  ListSessionsRequest,
  ListSessionsResponse,
  GetSessionResponse,
  // Message API
  ListMessagesRequest,
  ListMessagesResponse,
  MessageWithToolCalls,
  // Timeline API
  TimelinePoint,
  TimelineResponse,
  // Agent API
  ListAgentsResponse,
  // File History API
  ListFileHistoryResponse,
  // Fork API
  ForkTree,
  GetForksResponse,
  // Analytics API
  DailyMessageCount,
  DailyAnalyticsResponse,
  HourlyToolCallStat,
  ToolAnalyticsResponse,
  // Ingestion API
  IngestionStartRequest,
  IngestionStartResponse,
  IngestionStatusResponse,
} from './transport.js'

// ============================================================================
// JSONL Entry Types
// ============================================================================

export {
  // Entry type enum
  EntryType,
  // Entry schemas
  UserEntry,
  AssistantEntry,
  SummaryEntry,
  CustomTitleEntry,
  FileHistorySnapshotEntry,
  ProgressEntry,
  QueueOperationEntry,
  SystemEntry,
  // Union type
  AnyEntry,
  // Error type
  ParseError,
  // Parse functions
  parseEntry,
  parseEntryEither,
} from './jsonl.js'
