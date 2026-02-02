/**
 * @module @inherent.design/simulacrum-common
 * @description Common types and utilities for Simulacrum packages
 */

// Types (branded type constructors)
export {
  SessionId,
  MessageId,
  ToolCallId,
  AgentId,
  RequestId,
  AnthropicMessageId,
} from './types/index.js'

// Schemas (Effect Schema definitions)
export {
  // Enums
  SessionStatus,
  MessageRole,
  QueueOperationType,
  // Domain schemas (9 tables)
  Session,
  Message,
  ToolCall,
  Agent,
  FileHistory,
  Fork,
  ProgressEvent,
  QueueOperation,
  SystemEvent,
  // Transport contracts
  PaginationParams,
  ListSessionsRequest,
  ListSessionsResponse,
  GetSessionResponse,
  ListMessagesRequest,
  ListMessagesResponse,
  MessageWithToolCalls,
  TimelinePoint,
  TimelineResponse,
  ListAgentsResponse,
  ListFileHistoryResponse,
  ForkTree,
  GetForksResponse,
  DailyMessageCount,
  DailyAnalyticsResponse,
  HourlyToolCallStat,
  ToolAnalyticsResponse,
  IngestionStartRequest,
  IngestionStartResponse,
  IngestionStatusResponse,
  // JSONL entry types
  EntryType,
  UserEntry,
  AssistantEntry,
  SummaryEntry,
  CustomTitleEntry,
  FileHistorySnapshotEntry,
  ProgressEntry,
  QueueOperationEntry,
  SystemEntry,
  AnyEntry,
  ParseError,
  parseEntry,
  parseEntryEither,
} from './schemas/index.js'
