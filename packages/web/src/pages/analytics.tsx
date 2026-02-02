/**
 * @module pages/analytics
 * @description Analytics dashboard page with date range selector
 *
 * Route: /analytics
 *
 * Features:
 * - Date range selector (preset periods)
 * - Daily message counts chart
 * - Tool usage statistics
 * - Model usage breakdown
 * - Refresh button for cache invalidation
 */

import { useState, useCallback, useMemo } from 'react'
import { PageHeader } from './layout.tsx'
import { Button, Card, Skeleton } from '../components/ui/index.tsx'
import { RefreshCw, MessageSquare, Wrench, Bot } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, useDailyAnalytics, useToolAnalytics, useModelUsage } from '../data/index.ts'
import { format } from 'date-fns'

/**
 * Date range presets
 */
const DATE_PRESETS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 14 days', value: 14 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 60 days', value: 60 },
  { label: 'Last 90 days', value: 90 },
] as const

/**
 * Analytics dashboard page.
 */
export function AnalyticsPage() {
  const queryClient = useQueryClient()
  const [days, setDays] = useState<number>(30)

  // Handle date range change
  const handleDaysChange = useCallback((value: number) => {
    setDays(value)
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
  }, [queryClient])

  return (
    <div className='flex flex-col h-full'>
      <PageHeader
        title='Analytics'
        breadcrumbs={[{ label: 'Analytics' }]}
        actions={
          <div className='flex items-center gap-2'>
            {/* Date range selector */}
            <select
              value={days}
              onChange={(e) => handleDaysChange(Number(e.target.value))}
              className='px-3 py-2 border rounded-md bg-background'
            >
              {DATE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>

            {/* Refresh button */}
            <Button variant='ghost' size='icon' onClick={handleRefresh}>
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>
        }
      />

      {/* Dashboard content */}
      <div className='flex-1 overflow-auto p-6'>
        <AnalyticsDashboard days={days} />
      </div>
    </div>
  )
}

/**
 * Analytics dashboard with charts
 */
function AnalyticsDashboard({ days }: { days: number }) {
  const dailyData = useDailyAnalytics({ days })
  const toolData = useToolAnalytics({ days: 7 })
  const modelData = useModelUsage({ days })

  // Aggregate daily data for summary
  const dailySummary = useMemo(() => {
    if (!dailyData.data?.data) return { totalMessages: 0, uniqueSessions: 0 }
    const data = dailyData.data.data
    return {
      totalMessages: data.reduce((sum, d) => sum + d.message_count, 0),
      uniqueSessions: new Set(data.map((d) => d.session_id)).size,
    }
  }, [dailyData.data])

  // Aggregate tool data for summary
  const toolSummary = useMemo(() => {
    if (!toolData.data?.data) return 0
    return toolData.data.data.reduce((sum, d) => sum + d.call_count, 0)
  }, [toolData.data])

  // Transform daily data for chart (aggregate by day)
  const dailyChartData = useMemo(() => {
    if (!dailyData.data?.data) return []
    const byDay = new Map<string, { date: string; message_count: number }>()
    for (const d of dailyData.data.data) {
      const dateKey = format(d.day, 'yyyy-MM-dd')
      const existing = byDay.get(dateKey)
      if (existing) {
        existing.message_count += d.message_count
      } else {
        byDay.set(dateKey, { date: dateKey, message_count: d.message_count })
      }
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyData.data])

  // Transform tool data for list (aggregate by tool type)
  const toolListData = useMemo(() => {
    if (!toolData.data?.data) return []
    const byTool = new Map<
      string,
      { tool_type: string; call_count: number; avg_duration_ms: number; count: number }
    >()
    for (const d of toolData.data.data) {
      const existing = byTool.get(d.tool_type)
      if (existing) {
        existing.call_count += d.call_count
        if (d.avg_duration_ms != null) {
          existing.avg_duration_ms += d.avg_duration_ms
          existing.count += 1
        }
      } else {
        byTool.set(d.tool_type, {
          tool_type: d.tool_type,
          call_count: d.call_count,
          avg_duration_ms: d.avg_duration_ms ?? 0,
          count: d.avg_duration_ms != null ? 1 : 0,
        })
      }
    }
    return Array.from(byTool.values())
      .map((t) => ({
        tool_type: t.tool_type,
        call_count: t.call_count,
        avg_duration_ms: t.count > 0 ? t.avg_duration_ms / t.count : 0,
      }))
      .sort((a, b) => b.call_count - a.call_count)
  }, [toolData.data])

  // Transform model data for list (aggregate by model)
  const modelListData = useMemo(() => {
    if (!modelData.data?.data) return []
    const byModel = new Map<
      string,
      { model: string; message_count: number; total_tokens: number }
    >()
    for (const d of modelData.data.data) {
      const existing = byModel.get(d.model)
      const tokens = d.total_input_tokens + d.total_output_tokens
      if (existing) {
        existing.message_count += d.message_count
        existing.total_tokens += tokens
      } else {
        byModel.set(d.model, {
          model: d.model,
          message_count: d.message_count,
          total_tokens: tokens,
        })
      }
    }
    return Array.from(byModel.values()).sort((a, b) => b.message_count - a.message_count)
  }, [modelData.data])

  return (
    <div className='space-y-6'>
      {/* Summary cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <SummaryCard
          title='Messages'
          icon={MessageSquare}
          value={dailySummary.totalMessages}
          subtitle={`Last ${days} days`}
          isLoading={dailyData.isLoading}
        />
        <SummaryCard
          title='Tool Calls'
          icon={Wrench}
          value={toolSummary}
          subtitle='Last 7 days'
          isLoading={toolData.isLoading}
        />
        <SummaryCard
          title='Sessions'
          icon={Bot}
          value={dailySummary.uniqueSessions}
          subtitle={`Last ${days} days`}
          isLoading={dailyData.isLoading}
        />
      </div>

      {/* Daily activity chart */}
      <Card className='p-6'>
        <h3 className='text-lg font-semibold mb-4'>Daily Activity</h3>
        {dailyData.isLoading ? (
          <Skeleton className='h-[200px] w-full' />
        ) : dailyChartData.length > 0 ? (
          <DailyActivityChart data={dailyChartData} />
        ) : (
          <p className='text-muted-foreground'>No data available</p>
        )}
      </Card>

      {/* Tool usage */}
      <Card className='p-6'>
        <h3 className='text-lg font-semibold mb-4'>Tool Usage (Last 7 Days)</h3>
        {toolData.isLoading ? (
          <Skeleton className='h-[200px] w-full' />
        ) : toolListData.length > 0 ? (
          <ToolUsageList tools={toolListData} />
        ) : (
          <p className='text-muted-foreground'>No data available</p>
        )}
      </Card>

      {/* Model usage */}
      <Card className='p-6'>
        <h3 className='text-lg font-semibold mb-4'>Model Usage</h3>
        {modelData.isLoading ? (
          <Skeleton className='h-[200px] w-full' />
        ) : modelListData.length > 0 ? (
          <ModelUsageList models={modelListData} />
        ) : (
          <p className='text-muted-foreground'>No data available</p>
        )}
      </Card>
    </div>
  )
}

/**
 * Summary card component
 */
function SummaryCard({
  title,
  icon: Icon,
  value,
  subtitle,
  isLoading,
}: {
  title: string
  icon: typeof MessageSquare
  value: number
  subtitle: string
  isLoading: boolean
}) {
  return (
    <Card className='p-6'>
      <div className='flex items-center gap-4'>
        <div className='p-3 rounded-full bg-primary/10'>
          <Icon className='h-6 w-6 text-primary' />
        </div>
        <div>
          <p className='text-sm text-muted-foreground'>{title}</p>
          {isLoading ? (
            <Skeleton className='h-8 w-20 mt-1' />
          ) : (
            <p className='text-2xl font-bold tabular-nums'>{value.toLocaleString()}</p>
          )}
          <p className='text-xs text-muted-foreground'>{subtitle}</p>
        </div>
      </div>
    </Card>
  )
}

/**
 * Daily activity chart (simple bar representation)
 */
function DailyActivityChart({ data }: { data: Array<{ date: string; message_count: number }> }) {
  const maxMessages = Math.max(...data.map((d) => d.message_count), 1)

  return (
    <div className='space-y-2'>
      {data.slice(-14).map((day) => (
        <div key={day.date} className='flex items-center gap-4'>
          <span className='text-sm text-muted-foreground w-20'>
            {format(new Date(day.date), 'MMM d')}
          </span>
          <div className='flex-1 h-6 bg-muted rounded overflow-hidden'>
            <div
              className='h-full bg-primary/60 rounded'
              style={{ width: `${(day.message_count / maxMessages) * 100}%` }}
            />
          </div>
          <span className='text-sm tabular-nums w-16 text-right'>{day.message_count}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Tool usage list
 */
function ToolUsageList({
  tools,
}: {
  tools: Array<{ tool_type: string; call_count: number; avg_duration_ms: number }>
}) {
  const maxCalls = Math.max(...tools.map((t) => t.call_count), 1)

  return (
    <div className='space-y-3'>
      {tools.slice(0, 10).map((tool) => (
        <div key={tool.tool_type} className='flex items-center gap-4'>
          <span className='text-sm font-mono truncate w-32'>{tool.tool_type}</span>
          <div className='flex-1 h-4 bg-muted rounded overflow-hidden'>
            <div
              className='h-full bg-blue-500/60 rounded'
              style={{ width: `${(tool.call_count / maxCalls) * 100}%` }}
            />
          </div>
          <span className='text-sm tabular-nums w-16 text-right'>{tool.call_count}</span>
          <span className='text-xs text-muted-foreground w-20 text-right'>
            {tool.avg_duration_ms.toFixed(0)}ms avg
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Model usage list
 */
function ModelUsageList({
  models,
}: {
  models: Array<{ model: string; message_count: number; total_tokens: number }>
}) {
  const totalCount = models.reduce((sum, m) => sum + m.message_count, 0)

  return (
    <div className='space-y-3'>
      {models.map((model) => (
        <div key={model.model} className='flex items-center gap-4'>
          <span className='text-sm font-mono truncate flex-1'>{model.model}</span>
          <span className='text-sm tabular-nums'>{model.message_count.toLocaleString()} calls</span>
          <span className='text-xs text-muted-foreground w-20 text-right'>
            {totalCount > 0 ? ((model.message_count / totalCount) * 100).toFixed(1) : 0}%
          </span>
        </div>
      ))}
    </div>
  )
}
