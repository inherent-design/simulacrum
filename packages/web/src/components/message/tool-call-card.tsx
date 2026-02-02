/**
 * @module components/message/tool-call-card
 * @description Expandable card for tool call details
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Badge } from '../ui/index.tsx'
import type { ToolCall } from '../types.ts'

/**
 * Tool call card props
 */
export interface ToolCallCardProps {
  /** Tool call data */
  toolCall: ToolCall
  /** Default expanded state */
  defaultOpen?: boolean
}

/**
 * Tool call card component.
 *
 * Expandable card showing tool type, duration, and input.
 */
export function ToolCallCard({ toolCall, defaultOpen = false }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className='flex items-center gap-2 w-full p-2 rounded bg-muted/50 hover:bg-muted text-sm'>
        {isOpen ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
        <Wrench className='h-4 w-4 text-muted-foreground' />
        <span className='font-mono'>{toolCall.type}</span>
        {toolCall.result_truncated && (
          <Badge variant='outline' className='ml-auto'>
            truncated
          </Badge>
        )}
        {toolCall.duration_ms != null && (
          <span className='text-xs text-muted-foreground'>{toolCall.duration_ms}ms</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='mt-2 p-2 rounded bg-muted/30 text-sm font-mono'>
          {/* Input */}
          <div className='mb-2'>
            <span className='text-xs text-muted-foreground'>Input:</span>
            <pre className='mt-1 overflow-x-auto whitespace-pre-wrap'>
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {/* Result file path if available */}
          {toolCall.result_file_path && (
            <div>
              <span className='text-xs text-muted-foreground'>Result File:</span>
              <pre className='mt-1 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto'>
                {toolCall.result_file_path}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
