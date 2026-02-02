/**
 * @module components/message/message-list
 * @description Virtual list of messages with expandable tool calls
 *
 * Features:
 * - Virtual scrolling for large message counts
 * - Auto-scroll during playback
 * - Expandable tool call details
 * - Role-based visual distinction (user vs assistant)
 * - Timestamp display and current position highlighting
 */

import { useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format } from 'date-fns'
import { User, Bot } from 'lucide-react'
import { ScrollArea, Badge, Skeleton } from '../ui/index.tsx'
import { MessageItem } from './message-item.tsx'
import { useSessionMessagesInfinite } from '../../data/index.ts'
import {
  useTimelineStore,
  useUIStore,
  selectCurrentTimestamp,
  selectMessageDensity,
} from '../../state/index.ts'
import { cn } from '../../lib/utils.ts'
import type { MessageWithTools, MessageRole } from '../types.ts'

/**
 * Message list props
 */
export interface MessageListProps {
  /** Session ID to display messages for */
  sessionId: string
  /** Additional class names */
  className?: string
  /** Include tool calls inline */
  includeToolCalls?: boolean
}

/**
 * Density-based spacing
 */
const densityClasses: Record<string, string> = {
  compact: 'py-2 gap-2',
  comfortable: 'py-3 gap-3',
  spacious: 'py-4 gap-4',
}

/**
 * Role-based styling
 */
const roleStyles: Record<MessageRole, { icon: typeof User; bg: string; border: string }> = {
  user: {
    icon: User,
    bg: 'bg-primary/5',
    border: 'border-l-primary',
  },
  assistant: {
    icon: Bot,
    bg: 'bg-accent/50',
    border: 'border-l-accent-foreground',
  },
}

/**
 * Message list with virtual scrolling.
 */
export function MessageList({ sessionId, className, includeToolCalls = true }: MessageListProps) {
  const currentTimestamp = useTimelineStore(selectCurrentTimestamp)
  const density = useUIStore(selectMessageDensity)

  // Infinite query for messages
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useSessionMessagesInfinite(sessionId, { includeToolCalls })

  // Flatten pages
  const messages = useMemo(
    () => (data?.pages.flatMap((page) => page.messages) ?? []) as MessageWithTools[],
    [data?.pages]
  )

  // Find current message based on timestamp
  const currentMessageIndex = useMemo(() => {
    if (!currentTimestamp || messages.length === 0) return -1
    return messages.findIndex((m, i) => {
      const next = messages[i + 1]
      const msgTime = m.timestamp.getTime()
      const nextTime = next ? next.timestamp.getTime() : Infinity
      return currentTimestamp >= msgTime && currentTimestamp < nextTime
    })
  }, [messages, currentTimestamp])

  // Virtual list
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // estimated row height
    overscan: 5,
  })

  // Auto-scroll to current message during playback
  useEffect(() => {
    if (currentMessageIndex >= 0) {
      virtualizer.scrollToIndex(currentMessageIndex, { align: 'center' })
    }
  }, [currentMessageIndex, virtualizer])

  // Infinite scroll trigger
  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    const { scrollHeight, scrollTop, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 500 && !isFetchingNextPage && hasNextPage) {
      fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (isLoading) {
    return <MessageListSkeleton count={5} className={className} />
  }

  if (messages.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center h-full text-muted-foreground', className)}
      >
        No messages in this session
      </div>
    )
  }

  return (
    <ScrollArea ref={parentRef} className={cn('h-full', className)} onScrollCapture={handleScroll}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index]
          if (!message) return null
          const isCurrent = virtualRow.index === currentMessageIndex
          const style = roleStyles[message.role]
          const Icon = style.icon

          return (
            <div
              key={message.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={cn(
                'absolute left-0 right-0 px-4 border-l-4',
                style.bg,
                style.border,
                densityClasses[density],
                isCurrent && 'ring-2 ring-ring ring-inset'
              )}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Message header */}
              <div className='flex items-center gap-2 mb-2'>
                <Icon className='h-4 w-4 text-muted-foreground' />
                <span className='font-medium capitalize'>{message.role}</span>
                <span className='text-xs text-muted-foreground'>
                  {format(message.timestamp, 'HH:mm:ss')}
                </span>
                {message.model && (
                  <Badge variant='outline' className='text-xs'>
                    {message.model}
                  </Badge>
                )}
              </div>

              {/* Message content */}
              <MessageItem message={message} includeToolCalls={includeToolCalls} />
            </div>
          )
        })}
      </div>

      {/* Loading more */}
      {isFetchingNextPage && (
        <div className='flex justify-center py-4'>
          <Skeleton className='h-20 w-full mx-4' />
        </div>
      )}
    </ScrollArea>
  )
}

/**
 * Loading skeleton
 */
function MessageListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 p-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='space-y-2'>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='h-20 w-full' />
        </div>
      ))}
    </div>
  )
}
