/**
 * @module components/message/message-item
 * @description Individual message display with content and tool calls
 */

import { ToolCallCard } from './tool-call-card.tsx'
import type { MessageWithTools, ToolCall } from '../types.ts'

/**
 * Message item props
 */
export interface MessageItemProps {
  /** Message data */
  message: MessageWithTools
  /** Include tool calls inline */
  includeToolCalls?: boolean
}

/**
 * Message item component.
 *
 * Renders message content with optional inline tool calls.
 */
export function MessageItem({ message, includeToolCalls = true }: MessageItemProps) {
  return (
    <div>
      {/* Message content */}
      <div className='prose prose-sm dark:prose-invert max-w-none'>
        <p className='whitespace-pre-wrap break-words'>{message.content}</p>
      </div>

      {/* Tool calls (expandable) */}
      {includeToolCalls && message.tool_calls && message.tool_calls.length > 0 && (
        <div className='mt-2 space-y-1'>
          {message.tool_calls.map((toolCall: ToolCall) => (
            <ToolCallCard key={toolCall.id} toolCall={toolCall} />
          ))}
        </div>
      )}
    </div>
  )
}
