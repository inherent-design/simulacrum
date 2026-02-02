/**
 * @module components/timeline/session-timeline
 * @description Time-series visualization with visx brush and zoom
 *
 * Features:
 * - Stacked bar chart for user/assistant/tool activity (@visx/shape BarStack)
 * - Brush selection for time range filtering (@visx/brush)
 * - Current position indicator (red line)
 * - Click to seek to position
 * - Responsive sizing via container ref
 * - Tooltips on hover (@visx/tooltip)
 * - Mini preview in brush area
 *
 * Replaces deprecated react-timeseries-charts + pondjs.
 */

import { useMemo, useCallback, useRef } from 'react'
import { scaleTime, scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { Brush } from '@visx/brush'
import { Group } from '@visx/group'
import { BarStack } from '@visx/shape'
import { localPoint } from '@visx/event'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'
import { PatternLines } from '@visx/pattern'
import type { Bounds } from '@visx/brush/lib/types'
import type { BrushHandleRenderProps } from '@visx/brush/lib/BrushHandle'
import BaseBrush from '@visx/brush/lib/BaseBrush'
import { format } from 'date-fns'
import { Skeleton } from '../ui/index.tsx'
import { useSessionTimeline } from '../../data/index.ts'
import {
  useTimelineStore,
  selectCurrentTimestamp,
  selectVisibleRange,
  selectBounds,
} from '../../state/index.ts'
import { cn } from '../../lib/utils.ts'
// TimelinePoint from data hooks uses number timestamps (unix ms)

/**
 * Session timeline props
 */
export interface SessionTimelineProps {
  /** Session ID to visualize */
  sessionId: string
  /** Chart height */
  height?: number
  /** Chart width (defaults to container width) */
  width?: number
  /** Additional class names */
  className?: string
  /** Margin configuration */
  margin?: { top: number; right: number; bottom: number; left: number }
}

/**
 * Chart color scheme
 */
const chartColors = {
  user: '#3b82f6', // blue-500
  assistant: '#10b981', // emerald-500
  toolCalls: '#f59e0b', // amber-500
  brushPattern: '#718096',
  brushBackground: '#f7fafc',
  currentPosition: '#ef4444', // red-500
}

/**
 * Processed data point for charting
 */
interface ChartDataPoint {
  date: Date
  user_count: number
  assistant_count: number
  tool_call_count: number
  total: number
}

/**
 * Bar stack keys
 */
const stackKeys = ['user_count', 'assistant_count', 'tool_call_count'] as const
type StackKey = (typeof stackKeys)[number]

/**
 * Color accessor for stacked bars
 */
const colorScale = (key: StackKey): string => {
  switch (key) {
    case 'user_count':
      return chartColors.user
    case 'assistant_count':
      return chartColors.assistant
    case 'tool_call_count':
      return chartColors.toolCalls
  }
}

/**
 * Default margins
 */
const defaultMargin = { top: 20, right: 20, bottom: 60, left: 50 }

/**
 * Brush handle component
 */
function BrushHandle({ x, height, isBrushActive }: BrushHandleRenderProps) {
  const pathWidth = 8
  const pathHeight = 15
  if (!isBrushActive) return null
  return (
    <Group left={x + pathWidth / 2} top={(height - pathHeight) / 2}>
      <path
        fill='#f2f2f2'
        d='M -4.5 0.5 L 3.5 0.5 L 3.5 15.5 L -4.5 15.5 L -4.5 0.5 M -1.5 4 L -1.5 12 M 0.5 4 L 0.5 12'
        stroke='#999999'
        strokeWidth='1'
        style={{ cursor: 'ew-resize' }}
      />
    </Group>
  )
}

/**
 * Session timeline chart with brush selection.
 */
export function SessionTimeline({
  sessionId,
  height = 250,
  width: propWidth,
  className,
  margin = defaultMargin,
}: SessionTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const brushRef = useRef<BaseBrush | null>(null)

  const { data, isLoading } = useSessionTimeline(sessionId)
  const currentTimestamp = useTimelineStore(selectCurrentTimestamp)
  const visibleRange = useTimelineStore(selectVisibleRange)
  const storeBounds = useTimelineStore(selectBounds)
  const setVisibleRange = useTimelineStore((s) => s.setVisibleRange)
  const seek = useTimelineStore((s) => s.seek)
  const setBounds = useTimelineStore((s) => s.setBounds)

  // Tooltip
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, hideTooltip, showTooltip } =
    useTooltip<ChartDataPoint>()

  // Responsive width
  const width = propWidth ?? containerRef.current?.clientWidth ?? 600

  // Inner dimensions
  const xMax = Math.max(width - margin.left - margin.right, 0)
  const yMax = Math.max(height - margin.top - margin.bottom - 40, 0) // -40 for brush
  const brushHeight = 30

  // Process data points
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!data?.points?.length) return []

    return data.points.map((p) => ({
      date: new Date(p.timestamp), // timestamp is number (unix ms)
      user_count: p.user_count,
      assistant_count: p.assistant_count,
      tool_call_count: p.tool_call_count,
      total: p.user_count + p.assistant_count + p.tool_call_count,
    }))
  }, [data?.points])

  // Set store bounds when data loads
  useMemo(() => {
    if (data?.time_range && !storeBounds) {
      setBounds({
        start: new Date(data.time_range.start).getTime(),
        end: new Date(data.time_range.end).getTime(),
      })
    }
  }, [data?.time_range, storeBounds, setBounds])

  // Time domain (full range)
  const timeDomain = useMemo(() => {
    if (chartData.length === 0) return [new Date(), new Date()]
    const dates = chartData.map((d) => d.date)
    return [
      new Date(Math.min(...dates.map((d) => d.getTime()))),
      new Date(Math.max(...dates.map((d) => d.getTime()))),
    ]
  }, [chartData])

  // Visible domain (from brush or full)
  const visibleDomain = useMemo(() => {
    if (visibleRange.start && visibleRange.end) {
      return [new Date(visibleRange.start), new Date(visibleRange.end)]
    }
    return timeDomain
  }, [visibleRange, timeDomain])

  // Filtered data for visible range
  const visibleData = useMemo(() => {
    if (!visibleRange.start || !visibleRange.end) return chartData
    return chartData.filter((d) => {
      const t = d.date.getTime()
      return t >= visibleRange.start && t <= visibleRange.end
    })
  }, [chartData, visibleRange])

  // Scales
  const xScale = useMemo(
    () =>
      scaleTime<number>({
        domain: visibleDomain,
        range: [0, xMax],
      }),
    [visibleDomain, xMax]
  )

  const yMax2 = useMemo(() => Math.max(...visibleData.map((d) => d.total), 1), [visibleData])

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, yMax2 * 1.1],
        range: [yMax, 0],
        nice: true,
      }),
    [yMax2, yMax]
  )

  // Brush scale (always full range)
  const brushXScale = useMemo(
    () =>
      scaleTime<number>({
        domain: timeDomain,
        range: [0, xMax],
      }),
    [timeDomain, xMax]
  )

  // Initial brush position from visible range
  const initialBrushPosition = useMemo(() => {
    if (!visibleRange.start || !visibleRange.end) return undefined
    return {
      start: { x: brushXScale(new Date(visibleRange.start)) },
      end: { x: brushXScale(new Date(visibleRange.end)) },
    }
  }, [visibleRange, brushXScale])

  // Handle brush change
  const handleBrushChange = useCallback(
    (domain: Bounds | null) => {
      if (!domain) {
        setVisibleRange({ start: 0, end: 0 })
        return
      }
      const { x0, x1 } = domain
      const start = brushXScale.invert(x0).getTime()
      const end = brushXScale.invert(x1).getTime()
      setVisibleRange({ start, end })
    },
    [brushXScale, setVisibleRange]
  )

  // Handle click to seek
  const handleChartClick = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event)
      if (!point) return
      const x = point.x - margin.left
      const timestamp = xScale.invert(x).getTime()
      seek(timestamp)
    },
    [xScale, margin.left, seek]
  )

  // Bar width based on data density
  const barWidth = useMemo(() => {
    if (visibleData.length === 0) return 0
    return Math.max(xMax / visibleData.length - 2, 1)
  }, [visibleData.length, xMax])

  if (isLoading) {
    return <SessionTimelineSkeleton height={height} className={className} />
  }

  if (chartData.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center text-muted-foreground', className)}
        style={{ height }}
      >
        No timeline data available
      </div>
    )
  }

  // Current position as pixel offset
  const currentPositionX =
    storeBounds && currentTimestamp > 0 ? xScale(new Date(currentTimestamp)) : null

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <svg width={width} height={height}>
        <PatternLines
          id='brush-pattern'
          height={8}
          width={8}
          stroke={chartColors.brushPattern}
          strokeWidth={1}
          orientation={['diagonal']}
        />

        {/* Main chart area */}
        <Group left={margin.left} top={margin.top}>
          {/* Click overlay for seeking */}
          <rect
            width={xMax}
            height={yMax}
            fill='transparent'
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          />

          {/* Stacked bars */}
          <BarStack<ChartDataPoint, StackKey>
            data={visibleData}
            keys={[...stackKeys]}
            x={(d) => d.date}
            xScale={xScale}
            yScale={yScale}
            color={colorScale}
          >
            {(barStacks) =>
              barStacks.map((barStack) =>
                barStack.bars.map((bar) => (
                  <rect
                    key={`bar-stack-${barStack.index}-${bar.index}`}
                    x={bar.x - barWidth / 2}
                    y={bar.y}
                    width={barWidth}
                    height={bar.height}
                    fill={bar.color}
                    rx={1}
                    onMouseMove={(event) => {
                      const point = localPoint(event)
                      if (!point) return
                      const dataPoint = visibleData[bar.index]
                      if (dataPoint) {
                        showTooltip({
                          tooltipData: dataPoint,
                          tooltipLeft: point.x,
                          tooltipTop: point.y - 10,
                        })
                      }
                    }}
                    onMouseLeave={hideTooltip}
                  />
                ))
              )
            }
          </BarStack>

          {/* Current position indicator */}
          {currentPositionX !== null && currentPositionX >= 0 && currentPositionX <= xMax && (
            <line
              x1={currentPositionX}
              x2={currentPositionX}
              y1={0}
              y2={yMax}
              stroke={chartColors.currentPosition}
              strokeWidth={2}
              pointerEvents='none'
            />
          )}

          {/* Y axis */}
          <AxisLeft
            scale={yScale}
            numTicks={5}
            tickLabelProps={() => ({
              fontSize: 10,
              textAnchor: 'end' as const,
              dy: '0.33em',
              dx: -4,
            })}
          />

          {/* X axis */}
          <AxisBottom
            top={yMax}
            scale={xScale}
            numTicks={Math.min(visibleData.length, 8)}
            tickFormat={(d) => format(d as Date, 'HH:mm')}
            tickLabelProps={() => ({
              fontSize: 10,
              textAnchor: 'middle' as const,
              dy: 4,
            })}
          />
        </Group>

        {/* Brush area */}
        <Group left={margin.left} top={height - brushHeight - margin.bottom + 10}>
          {/* Mini chart preview */}
          {chartData.map((d, i) => {
            const x = brushXScale(d.date)
            const h = (d.total / yMax2) * (brushHeight - 4)
            return (
              <rect
                key={`brush-bar-${i}`}
                x={x - 1}
                y={brushHeight - h - 2}
                width={2}
                height={h}
                fill={chartColors.assistant}
                opacity={0.5}
              />
            )
          })}

          <Brush
            xScale={brushXScale}
            yScale={scaleLinear({ domain: [0, 1], range: [brushHeight, 0] })}
            width={xMax}
            height={brushHeight}
            margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
            handleSize={8}
            innerRef={brushRef}
            resizeTriggerAreas={['left', 'right']}
            brushDirection='horizontal'
            initialBrushPosition={initialBrushPosition}
            onChange={handleBrushChange}
            selectedBoxStyle={{
              fill: 'url(#brush-pattern)',
              stroke: chartColors.brushPattern,
            }}
            useWindowMoveEvents
            renderBrushHandle={(props) => <BrushHandle {...props} />}
          />
        </Group>
      </svg>

      {/* Legend */}
      <div className='flex items-center justify-center gap-4 mt-2 text-sm'>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 rounded' style={{ backgroundColor: chartColors.user }} />
          <span>User</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 rounded' style={{ backgroundColor: chartColors.assistant }} />
          <span>Assistant</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 rounded' style={{ backgroundColor: chartColors.toolCalls }} />
          <span>Tool Calls</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          className='bg-popover text-popover-foreground shadow-md rounded-md p-2 text-xs'
        >
          <div className='font-medium'>{format(tooltipData.date, 'MMM d, HH:mm')}</div>
          <div className='flex items-center gap-1 mt-1'>
            <span style={{ color: chartColors.user }}>User:</span> {tooltipData.user_count}
          </div>
          <div className='flex items-center gap-1'>
            <span style={{ color: chartColors.assistant }}>Assistant:</span>{' '}
            {tooltipData.assistant_count}
          </div>
          <div className='flex items-center gap-1'>
            <span style={{ color: chartColors.toolCalls }}>Tools:</span>{' '}
            {tooltipData.tool_call_count}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  )
}

/**
 * Loading skeleton
 */
function SessionTimelineSkeleton({
  height = 250,
  className,
}: {
  height?: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Skeleton className='w-full' style={{ height: height - 50 }} />
      <Skeleton className='h-10 w-full' />
    </div>
  )
}
