/**
 * @module types/branded
 * @description Branded type definitions for domain identifiers
 *
 * Provides compile-time type safety for ID types, preventing accidental mixing
 * of semantically different identifiers (e.g., SessionId vs MessageId).
 *
 * @example
 * ```typescript
 * import { SessionId, MessageId } from '@inherent.design/simulacrum-common'
 *
 * const sessionId = SessionId('a1b2c3d4-e5f6-4789-abcd-ef0123456789')
 * const messageId = MessageId('a1b2c3d4-e5f6-4789-abcd-ef0123456789')
 *
 * // TypeScript error: Type 'MessageId' is not assignable to type 'SessionId'
 * function getSession(id: SessionId): void {}
 * getSession(messageId) // Error!
 * ```
 */

import { Brand } from 'effect'

// ============================================================================
// Validation Patterns
// ============================================================================

/**
 * UUID v4 pattern - requires version 4 indicator and proper variant
 * Format: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
 */
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * General UUID pattern - any version
 * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Agent ID pattern - 7 lowercase hex characters
 * Source: Claude Code subagent directory names (agent-a13a7a3.jsonl)
 */
const AGENT_ID_PATTERN = /^[a-f0-9]{7}$/

// ============================================================================
// SessionId
// ============================================================================

/**
 * UUID v4 format identifier for sessions.
 *
 * Used to uniquely identify Claude Code conversation sessions.
 * Validation enforces strict UUID v4 format.
 *
 * @example
 * ```typescript
 * const id = SessionId('a1b2c3d4-e5f6-4789-abcd-ef0123456789')
 * ```
 */
export type SessionId = string & Brand.Brand<'SessionId'>

/**
 * Constructor for SessionId branded type.
 * Validates input is a valid UUID v4 string.
 *
 * @throws {Brand.error} When input is not a valid UUID v4
 */
export const SessionId = Brand.refined<SessionId>(
  (s): s is SessionId => UUID_V4_PATTERN.test(s),
  (s) => Brand.error(`Invalid SessionId UUID: ${s}`)
)

// ============================================================================
// MessageId
// ============================================================================

/**
 * UUID format identifier for messages.
 *
 * Used to uniquely identify messages within a session.
 * Accepts any valid UUID format for compatibility with existing data.
 *
 * @example
 * ```typescript
 * const id = MessageId('a1b2c3d4-e5f6-4789-abcd-ef0123456789')
 * ```
 */
export type MessageId = string & Brand.Brand<'MessageId'>

/**
 * Constructor for MessageId branded type.
 * Validates input is a valid UUID string (any version).
 *
 * @throws {Brand.error} When input is not a valid UUID
 */
export const MessageId = Brand.refined<MessageId>(
  (s): s is MessageId => UUID_PATTERN.test(s),
  (s) => Brand.error(`Invalid MessageId UUID: ${s}`)
)

// ============================================================================
// ToolCallId
// ============================================================================

/**
 * Anthropic tool call identifier with `toolu_` prefix.
 *
 * Source: Anthropic API tool_use blocks
 *
 * @example
 * ```typescript
 * const id = ToolCallId('toolu_01XFDUDYJgAACzvnptvVer6u')
 * ```
 */
export type ToolCallId = string & Brand.Brand<'ToolCallId'>

/**
 * Constructor for ToolCallId branded type.
 * Validates input starts with 'toolu_' prefix.
 *
 * @throws {Brand.error} When input doesn't start with 'toolu_'
 */
export const ToolCallId = Brand.refined<ToolCallId>(
  (s): s is ToolCallId => s.startsWith('toolu_'),
  (s) => Brand.error(`ToolCallId must start with 'toolu_': ${s}`)
)

// ============================================================================
// AgentId
// ============================================================================

/**
 * Short hex identifier for subagents (7 characters).
 *
 * Source: Claude Code subagent directory names (agent-a13a7a3.jsonl)
 *
 * @example
 * ```typescript
 * const id = AgentId('a13a7a3')
 * ```
 */
export type AgentId = string & Brand.Brand<'AgentId'>

/**
 * Constructor for AgentId branded type.
 * Validates input is exactly 7 lowercase hexadecimal characters.
 *
 * @throws {Brand.error} When input is not 7 lowercase hex chars
 */
export const AgentId = Brand.refined<AgentId>(
  (s): s is AgentId => AGENT_ID_PATTERN.test(s),
  (s) => Brand.error(`Invalid AgentId format (expected 7 hex chars): ${s}`)
)

// ============================================================================
// RequestId
// ============================================================================

/**
 * Anthropic API request identifier with `req_` prefix.
 *
 * Source: Anthropic API response headers/metadata
 *
 * @example
 * ```typescript
 * const id = RequestId('req_01XFDUDYJgAACzvnptvVer6u')
 * ```
 */
export type RequestId = string & Brand.Brand<'RequestId'>

/**
 * Constructor for RequestId branded type.
 * Validates input starts with 'req_' prefix.
 *
 * @throws {Brand.error} When input doesn't start with 'req_'
 */
export const RequestId = Brand.refined<RequestId>(
  (s): s is RequestId => s.startsWith('req_'),
  (s) => Brand.error(`RequestId must start with 'req_': ${s}`)
)

// ============================================================================
// AnthropicMessageId
// ============================================================================

/**
 * Anthropic message identifier with `msg_` prefix.
 *
 * Source: Anthropic API message responses
 *
 * @example
 * ```typescript
 * const id = AnthropicMessageId('msg_01XFDUDYJgAACzvnptvVer6u')
 * ```
 */
export type AnthropicMessageId = string & Brand.Brand<'AnthropicMessageId'>

/**
 * Constructor for AnthropicMessageId branded type.
 * Validates input starts with 'msg_' prefix.
 *
 * @throws {Brand.error} When input doesn't start with 'msg_'
 */
export const AnthropicMessageId = Brand.refined<AnthropicMessageId>(
  (s): s is AnthropicMessageId => s.startsWith('msg_'),
  (s) => Brand.error(`AnthropicMessageId must start with 'msg_': ${s}`)
)
