/**
 * @module components/session/session-detail
 * @description Detailed session view with metadata and actions
 *
 * Shows full session information including:
 * - Complete metadata
 * - Session timeline
 * - Message list
 * - Agent list
 */

import { format, formatDuration, intervalToDuration } from 'date-fns'
import { Calendar, Clock, GitBranch, Folder, MessageSquare, Wrench, Bot, Hash } from 'lucide-react'
import { Badge, Card, Skeleton } from '../ui/index.tsx'
import { useSession, useSessionAgents } from '../../data/index.ts'
import { cn } from '../../lib/utils.ts'
import type { SessionStatus, Agent } from '../types.ts'

/**
 * Session detail props
 */
export interface SessionDetailProps {
  /** Session ID to display */
  sessionId: string
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
 * Metadata item component
 */
function MetadataItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar
  label: string
  value: string | null | undefined
}) {
  if (!value) return null

  return (
    <div className='flex items-start gap-2'>
      <Icon className='h-4 w-4 text-muted-foreground mt-0.5' />
      <div>
        <div className='text-xs text-muted-foreground'>{label}</div>
        <div className='text-sm font-medium'>{value}</div>
      </div>
    </div>
  )
}

/**
 * Session detail component.
 *
 * Displays full session metadata and provides navigation
 * to messages, timeline, and agents.
 */
export function SessionDetail({ sessionId, className }: SessionDetailProps) {
  const { data: sessionData, isLoading: sessionLoading } = useSession(sessionId)
  const { data: agentsData, isLoading: agentsLoading } = useSessionAgents(sessionId)

  if (sessionLoading) {
    return <SessionDetailSkeleton className={className} />
  }

  if (!sessionData) {
    return (
      <div
        className={cn('flex items-center justify-center h-full text-muted-foreground', className)}
      >
        Session not found
      </div>
    )
  }

  const session = sessionData.session
  const agentsList = agentsData?.agents ?? []

  // Calculate duration if session has ended
  const duration =
    session.started_at && session.ended_at
      ? formatDuration(
          intervalToDuration({
            start: new Date(session.started_at),
            end: new Date(session.ended_at),
          }),
          { format: ['hours', 'minutes'] }
        )
      : null

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex-1 min-w-0'>
            <h1 className='text-2xl font-semibold truncate'>
              {session.title || 'Untitled Session'}
            </h1>
            <p className='text-muted-foreground truncate mt-1' title={session.project_path}>
              {session.project_path}
            </p>
          </div>
          <Badge variant={statusVariant[session.status as SessionStatus]} className='shrink-0'>
            {session.status}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <Card className='p-4'>
          <div className='flex items-center gap-2'>
            <MessageSquare className='h-5 w-5 text-primary' />
            <span className='text-2xl font-bold tabular-nums'>{sessionData.message_count}</span>
          </div>
          <p className='text-sm text-muted-foreground mt-1'>Messages</p>
        </Card>

        <Card className='p-4'>
          <div className='flex items-center gap-2'>
            <Wrench className='h-5 w-5 text-amber-500' />
            <span className='text-2xl font-bold tabular-nums'>{sessionData.tool_call_count}</span>
          </div>
          <p className='text-sm text-muted-foreground mt-1'>Tool Calls</p>
        </Card>

        <Card className='p-4'>
          <div className='flex items-center gap-2'>
            <Bot className='h-5 w-5 text-emerald-500' />
            <span className='text-2xl font-bold tabular-nums'>
              {agentsLoading ? '-' : agentsList.length}
            </span>
          </div>
          <p className='text-sm text-muted-foreground mt-1'>Agents</p>
        </Card>

        <Card className='p-4'>
          <div className='flex items-center gap-2'>
            <Hash className='h-5 w-5 text-purple-500' />
            <span className='text-2xl font-bold tabular-nums'>
              {session.total_tokens?.toLocaleString() ?? '-'}
            </span>
          </div>
          <p className='text-sm text-muted-foreground mt-1'>Tokens</p>
        </Card>
      </div>

      {/* Metadata */}
      <Card className='p-4'>
        <h2 className='font-medium mb-4'>Session Details</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          <MetadataItem
            icon={Calendar}
            label='Started'
            value={session.started_at ? format(new Date(session.started_at), 'PPpp') : null}
          />
          <MetadataItem
            icon={Clock}
            label='Duration'
            value={duration || (session.status === 'active' ? 'In progress' : null)}
          />
          <MetadataItem icon={Folder} label='Working Directory' value={session.cwd} />
          <MetadataItem icon={GitBranch} label='Git Branch' value={session.git_branch} />
          <MetadataItem icon={Bot} label='Model' value={null} />
          <MetadataItem icon={Hash} label='Version' value={session.version} />
        </div>
      </Card>

      {/* Agents List */}
      {!agentsLoading && agentsList.length > 0 && (
        <Card className='p-4'>
          <h2 className='font-medium mb-4'>Subagents ({agentsList.length})</h2>
          <div className='space-y-2'>
            {agentsList.map((agent: Agent) => (
              <div
                key={agent.id}
                className='flex items-center justify-between p-2 rounded bg-muted/50'
              >
                <div className='flex items-center gap-2'>
                  <Bot className='h-4 w-4 text-muted-foreground' />
                  <span className='font-mono text-sm'>{agent.agent_id ?? 'unknown'}</span>
                </div>
                <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                  <span>{agent.total_messages} messages</span>
                  <span>{format(new Date(agent.created_at), 'HH:mm:ss')}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/**
 * Loading skeleton for session detail
 */
function SessionDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-48 mt-2' />
      </div>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-24' />
        ))}
      </div>
      <Skeleton className='h-48' />
    </div>
  )
}
