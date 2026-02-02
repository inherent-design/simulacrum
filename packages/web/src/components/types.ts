/**
 * @module components/types
 * @description Component-level type re-exports from common schemas
 *
 * These types re-export from the common package schemas for use in components.
 * Components should use these types for props, but the actual data from hooks
 * will be Effect Schema typed and can be used directly.
 */

import { Schema as S } from 'effect'
import {
  Session as DomainSession,
  Message as DomainMessage,
  ToolCall as DomainToolCall,
  Agent as DomainAgent,
  SessionStatus as DomainSessionStatus,
  MessageRole as DomainMessageRole,
} from '@inherent.design/simulacrum-common'
import {
  TimelinePoint as TransportTimelinePoint,
  MessageWithToolCalls,
} from '@inherent.design/simulacrum-common'

// Re-export schema types for component use
export type SessionStatus = S.Schema.Type<typeof DomainSessionStatus>
export type MessageRole = S.Schema.Type<typeof DomainMessageRole>

// Session type from schema
export type Session = S.Schema.Type<typeof DomainSession>

// Message type from schema
export type Message = S.Schema.Type<typeof DomainMessage>

// Message with tool calls from transport
export type MessageWithTools = S.Schema.Type<typeof MessageWithToolCalls>

// Tool call type from schema
export type ToolCall = S.Schema.Type<typeof DomainToolCall>

// Agent type from schema
export type Agent = S.Schema.Type<typeof DomainAgent>

// Timeline point from transport
export type TimelinePoint = S.Schema.Type<typeof TransportTimelinePoint>

/**
 * Timeline response shape (matches transport.TimelineResponse)
 */
export interface TimelineResponseShape {
  session_id: string
  points: readonly TimelinePoint[]
  time_range: {
    start: number
    end: number
  }
}
