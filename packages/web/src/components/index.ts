/**
 * @module components
 * @description React UI components for Claude Code session exploration
 *
 * Component architecture:
 * - ui/: shadcn/ui primitives (Button, Card, etc.)
 * - session/: Session list, card, and detail views
 * - timeline/: Session timeline with visx and playback controls
 * - message/: Message list with virtual scrolling and tool calls
 * - layout/: Sidebar, header, and main layout
 *
 * @example
 * ```typescript
 * import {
 *   MainLayout,
 *   SessionList,
 *   SessionTimeline,
 *   MessageList,
 *   PlaybackControls,
 * } from '@/components'
 *
 * function SessionPage() {
 *   return (
 *     <MainLayout title="Sessions">
 *       <SessionList />
 *     </MainLayout>
 *   )
 * }
 * ```
 */

// Types
export type {
  Session,
  SessionStatus,
  Message,
  MessageWithTools,
  MessageRole,
  ToolCall,
  Agent,
  TimelinePoint,
  TimelineResponseShape,
} from './types.ts'

// Session components
export { SessionList, type SessionListProps } from './session/index.ts'
export { SessionCard, type SessionCardProps } from './session/index.ts'
export { SessionDetail, type SessionDetailProps } from './session/index.ts'

// Timeline components
export { SessionTimeline, type SessionTimelineProps } from './timeline/index.ts'
export { PlaybackControls, type PlaybackControlsProps } from './timeline/index.ts'

// Message components
export { MessageList, type MessageListProps } from './message/index.ts'
export { MessageItem, type MessageItemProps } from './message/index.ts'
export { ToolCallCard, type ToolCallCardProps } from './message/index.ts'

// Layout components
export { Sidebar, type SidebarProps } from './layout/index.ts'
export { Header, type HeaderProps } from './layout/index.ts'
export { MainLayout, type MainLayoutProps } from './layout/index.ts'

// Re-export UI primitives
export * from './ui/index.tsx'
