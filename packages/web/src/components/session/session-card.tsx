/**
 * @module components/session/session-card
 * @description Card component for displaying session summary
 *
 * Used in grid layouts and session previews.
 */

import { format, formatDistanceToNow } from 'date-fns'
import { FileText, Clock, MessageSquare, Wrench } from 'lucide-react'
import { Badge, Card } from '../ui/index.tsx'
import { cn } from '../../lib/utils.ts'
import type { Session, SessionStatus } from '../types.ts'

/**
 * Session card props
 */
export interface SessionCardProps {
  /** Session data */
  session: Session
  /** Whether the card is selected */
  selected?: boolean
  /** Click handler */
  onClick?: () => void
  /** Additional class names */
  className?: string
}

/**
 * Status badge variant mapping
 */
const statusVariant: Record<SessionStatus, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  pruned: 'secondary',
  compacted: 'destructive',
}

/**
 * Session card component.
 *
 * Displays session summary in a card format with:
 * - Title and project path
 * - Status badge
 * - Message and tool call counts
 * - Start time
 */
export function SessionCard({ session, selected, onClick, className }: SessionCardProps) {
  const shortPath = session.project_path.split('/').slice(-2).join('/')

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-colors',
        'hover:bg-muted/50',
        selected && 'ring-2 ring-ring bg-accent',
        className
      )}
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {/* Header */}
      <div className='flex items-start justify-between gap-2 mb-3'>
        <div className='flex-1 min-w-0'>
          <h3 className='font-medium truncate' title={session.title || 'Untitled'}>
            {session.title || 'Untitled'}
          </h3>
          <div className='flex items-center gap-1 text-sm text-muted-foreground mt-0.5'>
            <FileText className='h-3 w-3' />
            <span className='truncate' title={session.project_path}>
              {shortPath}
            </span>
          </div>
        </div>
        <Badge variant={statusVariant[session.status]}>{session.status}</Badge>
      </div>

      {/* Stats */}
      <div className='flex items-center gap-4 text-sm text-muted-foreground'>
        <div className='flex items-center gap-1'>
          <MessageSquare className='h-4 w-4' />
          <span className='tabular-nums'>{session.total_messages}</span>
        </div>
        <div className='flex items-center gap-1'>
          <Wrench className='h-4 w-4' />
          <span className='tabular-nums'>{session.total_tokens}</span>
        </div>
        <div className='flex items-center gap-1 ml-auto'>
          <Clock className='h-4 w-4' />
          <span title={format(session.started_at, 'PPpp')}>
            {formatDistanceToNow(session.started_at, { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Version tag if available */}
      {session.version && (
        <div className='mt-2'>
          <Badge variant='outline' className='text-xs'>
            {session.version}
          </Badge>
        </div>
      )}
    </Card>
  )
}
