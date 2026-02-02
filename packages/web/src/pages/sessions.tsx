/**
 * @module pages/sessions
 * @description Session list page with filtering controls
 *
 * Route: /sessions
 *
 * Features:
 * - Searchable session list with virtual scrolling
 * - Filter by project path
 * - Filter by status (active/pruned/compacted)
 * - Navigate to session detail on selection
 */

import { useCallback, useState } from 'react'
import { SessionList } from '../components/session/session-list.tsx'
import { PageHeader } from './layout.tsx'
import { Button } from '../components/ui/index.tsx'
import { useSessionStore, selectFilters } from '../state/index.ts'
import { RefreshCw, Filter, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../data/index.ts'

/**
 * Sessions list page.
 */
export function SessionsPage() {
  const queryClient = useQueryClient()
  const filters = useSessionStore(selectFilters)
  const { setFilters, clearFilters } = useSessionStore()

  const [showFilters, setShowFilters] = useState(false)
  const [projectPathInput, setProjectPathInput] = useState(filters.projectPath || '')
  const [statusInput, setStatusInput] = useState<string>(filters.status || 'all')

  // Handle filter application
  const handleApplyFilters = useCallback(() => {
    setFilters({
      projectPath: projectPathInput || undefined,
      status:
        statusInput === 'all' ? undefined : (statusInput as 'active' | 'pruned' | 'compacted'),
    })
  }, [projectPathInput, statusInput, setFilters])

  // Handle status filter change
  const handleStatusChange = useCallback((value: string) => {
    setStatusInput(value)
  }, [])

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    clearFilters()
    setProjectPathInput('')
    setStatusInput('all')
  }, [clearFilters])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all })
  }, [queryClient])

  const hasActiveFilters = filters.projectPath || filters.status

  return (
    <div className='flex flex-col h-full'>
      <PageHeader
        title='Sessions'
        breadcrumbs={[{ label: 'Sessions' }]}
        actions={
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'text-primary' : ''}
            >
              <Filter className='h-4 w-4' />
            </Button>
            <Button variant='ghost' size='icon' onClick={handleRefresh}>
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>
        }
      />

      {/* Filter panel */}
      {showFilters && (
        <div className='flex items-center gap-4 p-4 border-b bg-muted/30'>
          {/* Project path filter */}
          <div className='flex-1 max-w-sm'>
            <input
              type='text'
              placeholder='Filter by project path...'
              value={projectPathInput}
              onChange={(e) => setProjectPathInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className='w-full px-3 py-2 border rounded-md bg-background'
            />
          </div>

          {/* Status filter */}
          <select
            value={statusInput}
            onChange={(e) => handleStatusChange(e.target.value)}
            className='px-3 py-2 border rounded-md bg-background'
          >
            <option value='all'>All statuses</option>
            <option value='active'>Active</option>
            <option value='pruned'>Pruned</option>
            <option value='compacted'>Compacted</option>
          </select>

          {/* Apply/Clear buttons */}
          <Button variant='secondary' onClick={handleApplyFilters}>
            Apply
          </Button>
          {hasActiveFilters && (
            <Button variant='ghost' size='icon' onClick={handleClearFilters}>
              <X className='h-4 w-4' />
            </Button>
          )}
        </div>
      )}

      {/* Session list */}
      <div className='flex-1 overflow-hidden'>
        <SessionList
          queryParams={{
            projectPath: filters.projectPath,
            status: filters.status,
          }}
          className='h-full'
        />
      </div>
    </div>
  )
}
