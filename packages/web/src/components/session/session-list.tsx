/**
 * @module components/session/session-list
 * @description Session browser with TanStack Table and virtual scrolling
 *
 * Features:
 * - Virtual scrolling for 782+ sessions
 * - Infinite scroll with automatic load-more
 * - Keyboard navigation (arrow keys, enter)
 * - Sort by any column
 * - Row selection synced with store
 */

import { useMemo, useCallback, useRef, useState, type RefObject } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format, formatDistanceToNow } from 'date-fns'
import { Badge, Skeleton, ScrollArea } from '../ui/index.tsx'
import { useSessionsInfinite, type SessionsQueryParams } from '../../data/index.ts'
import {
  useSessionStore,
  useUIStore,
  selectCurrentSessionId,
  selectTablePageSize,
} from '../../state/index.ts'
import { cn } from '../../lib/utils.ts'
import type { Session, SessionStatus } from '../types.ts'

/**
 * Session list props
 */
export interface SessionListProps {
  /** Additional class names */
  className?: string
  /** Query params for filtering */
  queryParams?: Omit<SessionsQueryParams, 'offset'>
}

/**
 * Column helper for type-safe column definitions
 */
const columnHelper = createColumnHelper<Session>()

/**
 * Status badge variant mapping
 */
const statusVariant: Record<SessionStatus, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  pruned: 'secondary',
  compacted: 'destructive',
}

/**
 * Default column definitions
 */
const defaultColumns = [
  columnHelper.accessor('title', {
    header: 'Title',
    cell: (info) => (
      <span className='font-medium truncate max-w-[200px]' title={info.getValue() || 'Untitled'}>
        {info.getValue() || 'Untitled'}
      </span>
    ),
  }),
  columnHelper.accessor('project_path', {
    header: 'Project',
    cell: (info) => {
      const path = info.getValue()
      const shortPath = path.split('/').slice(-2).join('/')
      return (
        <span className='text-muted-foreground truncate max-w-[150px]' title={path}>
          {shortPath}
        </span>
      )
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <Badge variant={statusVariant[info.getValue()]}>{info.getValue()}</Badge>,
  }),
  columnHelper.accessor('started_at', {
    header: 'Started',
    cell: (info) => {
      const date = info.getValue()
      return (
        <span className='text-sm text-muted-foreground' title={format(date, 'PPpp')}>
          {formatDistanceToNow(date, { addSuffix: true })}
        </span>
      )
    },
  }),
  columnHelper.accessor('total_messages', {
    header: 'Messages',
    cell: (info) => <span className='text-sm tabular-nums'>{info.getValue()}</span>,
  }),
]

/**
 * Session list with virtual scrolling.
 */
export function SessionList({ className, queryParams }: SessionListProps) {
  const currentSessionId = useSessionStore(selectCurrentSessionId)
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession)
  const pageSize = useUIStore(selectTablePageSize)

  // Infinite query for sessions
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useSessionsInfinite({
    limit: pageSize,
    ...queryParams,
  })

  // Flatten pages into single array
  const sessions = useMemo(
    () => (data?.pages.flatMap((page) => page.sessions) ?? []) as Session[],
    [data?.pages]
  )

  // Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'started_at', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Table instance
  const table = useReactTable({
    data: sessions,
    columns: defaultColumns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const { rows } = table.getRowModel()

  // Virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // row height
    overscan: 10,
  })

  // Infinite scroll trigger
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (!containerRefElement) return
      const { scrollHeight, scrollTop, clientHeight } = containerRefElement
      if (scrollHeight - scrollTop - clientHeight < 500 && !isFetchingNextPage && hasNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  )

  // Row click handler
  const handleRowClick = useCallback(
    (sessionId: string) => {
      setCurrentSession(sessionId)
    },
    [setCurrentSession]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, sessionId: string, index: number) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault()
          setCurrentSession(sessionId)
          break
        case 'ArrowDown':
          e.preventDefault()
          if (index < rows.length - 1) {
            const nextRow = rows[index + 1]
            if (nextRow) {
              setCurrentSession(nextRow.original.id)
            }
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (index > 0) {
            const prevRow = rows[index - 1]
            if (prevRow) {
              setCurrentSession(prevRow.original.id)
            }
          }
          break
      }
    },
    [rows, setCurrentSession]
  )

  if (isLoading) {
    return <SessionListSkeleton count={10} className={className} />
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Table header */}
      <div className='flex border-b bg-muted/50'>
        {table.getHeaderGroups().map((headerGroup) => (
          <div key={headerGroup.id} className='flex flex-1'>
            {headerGroup.headers.map((header) => (
              <div
                key={header.id}
                className={cn(
                  'flex items-center px-4 py-2 text-sm font-medium text-muted-foreground',
                  header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground'
                )}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {{
                  asc: ' ^',
                  desc: ' v',
                }[header.column.getIsSorted() as string] ?? null}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Virtual list */}
      <ScrollArea
        ref={parentRef as RefObject<HTMLDivElement>}
        className='flex-1'
        onScrollCapture={(e) => fetchMoreOnBottomReached(e.currentTarget as HTMLDivElement)}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null
            const isSelected = row.original.id === currentSessionId

            return (
              <div
                key={row.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                role='row'
                tabIndex={0}
                aria-selected={isSelected}
                className={cn(
                  'absolute left-0 right-0 flex items-center border-b cursor-pointer',
                  'transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
                  isSelected && 'bg-accent'
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => handleRowClick(row.original.id)}
                onKeyDown={(e) => handleKeyDown(e, row.original.id, virtualRow.index)}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className='px-4 py-2 flex-1'>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className='flex justify-center py-4'>
            <Skeleton className='h-8 w-32' />
          </div>
        )}
      </ScrollArea>

      {/* Footer with count */}
      <div className='flex items-center justify-between px-4 py-2 border-t bg-muted/50 text-sm text-muted-foreground'>
        <span>{sessions.length} sessions loaded</span>
        {hasNextPage && <span>Scroll for more</span>}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for session list
 */
function SessionListSkeleton({ count = 10, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 p-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className='h-12 w-full' />
      ))}
    </div>
  )
}
