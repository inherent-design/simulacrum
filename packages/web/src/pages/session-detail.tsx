/**
 * @module pages/session-detail
 * @description Session detail page with timeline, messages, and playback controls
 *
 * Route: /sessions/:sessionId
 *
 * Features:
 * - Session metadata header
 * - Timeline visualization with brush selection
 * - Message timeline with virtual scrolling
 * - Playback controls for replay
 * - Tabbed views (Messages, Agents, Files)
 */

import { useEffect, useCallback, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { MessageList } from '../components/message/message-list.tsx'
import { SessionTimeline } from '../components/timeline/session-timeline.tsx'
import { PlaybackControls } from '../components/timeline/playback-controls.tsx'
import { PageHeader } from './layout.tsx'
import { Button, Badge, Skeleton } from '../components/ui/index.tsx'
import { useSession, useSessionAgents } from '../data/index.ts'
import { useSessionStore, useTimelineStore } from '../state/index.ts'
import { ArrowLeft, Users, Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '../lib/utils.ts'
import type { Agent } from '../components/types.ts'

/**
 * Session detail page.
 */
export function SessionDetailPage() {
  const params = useParams({ strict: false })
  const sessionId = params.sessionId as string
  const navigate = useNavigate()
  const { setCurrentSession } = useSessionStore()
  const { reset: resetTimeline, setBounds } = useTimelineStore()

  // Sync route param to store
  useEffect(() => {
    if (sessionId) {
      setCurrentSession(sessionId)
    }
    return () => {
      resetTimeline()
    }
  }, [sessionId, setCurrentSession, resetTimeline])

  // Fetch session detail
  const { data, isLoading, isError, error } = useSession(sessionId)

  // Set timeline bounds when session data loads
  useEffect(() => {
    if (data?.session) {
      const start = new Date(data.session.started_at).getTime()
      const end = data.session.ended_at ? new Date(data.session.ended_at).getTime() : Date.now()
      setBounds({ start, end })
    }
  }, [data?.session, setBounds])

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate({ to: '/sessions' })
  }, [navigate])

  if (isLoading) {
    return <SessionDetailSkeleton />
  }

  if (isError) {
    return (
      <div className='flex flex-col items-center justify-center h-full gap-4'>
        <p className='text-destructive'>Failed to load session</p>
        <p className='text-sm text-muted-foreground'>{error?.message}</p>
        <Button onClick={handleBack}>Back to Sessions</Button>
      </div>
    )
  }

  if (!data?.session) {
    return (
      <div className='flex flex-col items-center justify-center h-full gap-4'>
        <p className='text-muted-foreground'>Session not found</p>
        <Button onClick={handleBack}>Back to Sessions</Button>
      </div>
    )
  }

  const { session, message_count, agent_count, tool_call_count } = data
  const projectPath = session.project_path.split('/').slice(-2).join('/')

  return (
    <div className='flex flex-col h-full'>
      <PageHeader
        title={session.title || 'Untitled Session'}
        breadcrumbs={[
          { label: 'Sessions', href: '/sessions' },
          { label: session.title || sessionId.slice(0, 8) },
        ]}
        actions={
          <Button variant='ghost' size='sm' onClick={handleBack}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back
          </Button>
        }
      />

      {/* Session metadata */}
      <div className='flex items-center gap-4 px-6 py-3 border-b bg-muted/30'>
        <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
          {session.status}
        </Badge>

        <div className='flex items-center gap-1 text-sm text-muted-foreground'>
          <Clock className='h-4 w-4' />
          <span title={format(new Date(session.started_at), 'PPpp')}>
            {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
          </span>
        </div>

        <span className='text-sm text-muted-foreground' title={session.project_path}>
          {projectPath}
        </span>

        <div className='flex items-center gap-4 ml-auto text-sm'>
          <span>{message_count} messages</span>
          <span className='flex items-center gap-1'>
            <Users className='h-4 w-4' />
            {agent_count} agents
          </span>
          <span>{tool_call_count} tool calls</span>
        </div>
      </div>

      {/* Timeline chart */}
      <div className='px-6 py-4 border-b'>
        <SessionTimeline sessionId={sessionId} height={150} />
      </div>

      {/* Playback controls */}
      <div className='px-6 py-2 border-b'>
        <PlaybackControls />
      </div>

      {/* Tabbed content */}
      <div className='flex-1 overflow-hidden flex flex-col'>
        <TabNav sessionId={sessionId} agentCount={agent_count} />
      </div>
    </div>
  )
}

/**
 * Tab navigation component
 */
function TabNav({ sessionId, agentCount }: { sessionId: string; agentCount: number }) {
  const [activeTab, setActiveTab] = useState<'messages' | 'agents' | 'files'>('messages')
  const { data: agentsData } = useSessionAgents(sessionId)

  return (
    <>
      {/* Tab headers */}
      <div className='flex border-b px-6'>
        <button
          onClick={() => setActiveTab('messages')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'messages'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground'
          )}
        >
          Messages
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'agents'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground'
          )}
        >
          Agents ({agentCount})
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'files'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground'
          )}
        >
          Files
        </button>
      </div>

      {/* Tab content */}
      <div className='flex-1 overflow-hidden'>
        {activeTab === 'messages' && (
          <MessageList sessionId={sessionId} includeToolCalls className='h-full' />
        )}

        {activeTab === 'agents' && (
          <div className='p-6 overflow-auto h-full'>
            <AgentsList agents={agentsData?.agents ?? []} />
          </div>
        )}

        {activeTab === 'files' && (
          <div className='p-6'>
            <p className='text-muted-foreground'>File history coming soon...</p>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Agents list component
 */
function AgentsList({ agents }: { agents: readonly Agent[] }) {
  if (agents.length === 0) {
    return <p className='text-muted-foreground'>No subagents in this session</p>
  }

  return (
    <div className='space-y-2'>
      {agents.map((agent) => (
        <div key={agent.id} className='flex items-center gap-4 p-3 rounded-lg border bg-card'>
          <Users className='h-5 w-5 text-muted-foreground' />
          <div>
            <p className='font-mono text-sm'>{agent.agent_id ?? agent.id.slice(0, 8)}</p>
            <p className='text-sm text-muted-foreground'>
              Depth: {agent.depth} | Messages: {agent.total_messages}
            </p>
          </div>
          <span className='ml-auto text-sm text-muted-foreground'>
            {format(new Date(agent.created_at), 'HH:mm:ss')}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Loading skeleton
 */
function SessionDetailSkeleton() {
  return (
    <div className='flex flex-col h-full'>
      <div className='h-14 border-b' />
      <div className='flex items-center gap-4 px-6 py-3 border-b'>
        <Skeleton className='h-6 w-16' />
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-4 w-48 ml-auto' />
      </div>
      <div className='px-6 py-4 border-b'>
        <Skeleton className='h-[150px] w-full' />
      </div>
      <div className='px-6 py-2 border-b'>
        <Skeleton className='h-12 w-full' />
      </div>
      <div className='flex-1 p-6'>
        <div className='space-y-4'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-20 w-full' />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
