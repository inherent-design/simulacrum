/**
 * @module components/layout/header
 * @description Application header with title and actions
 */

import { Moon, Sun, Search } from 'lucide-react'
import { Button } from '../ui/index.tsx'
import { useUIStore, selectTheme, selectResolvedTheme } from '../../state/index.ts'
import { cn } from '../../lib/utils.ts'

/**
 * Header props
 */
export interface HeaderProps {
  /** Page title */
  title?: string
  /** Additional class names */
  className?: string
}

/**
 * Application header.
 *
 * Shows page title and global actions (theme toggle, search).
 */
export function Header({ title = 'Simulacrum', className }: HeaderProps) {
  const theme = useUIStore(selectTheme)
  const resolvedTheme = useUIStore(selectResolvedTheme)
  const setTheme = useUIStore((s) => s.setTheme)

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark')
    }
  }

  return (
    <header
      className={cn(
        'flex items-center justify-between h-14 px-4 border-b bg-background',
        className
      )}
    >
      <h1 className='text-lg font-semibold'>{title}</h1>

      <div className='flex items-center gap-2'>
        {/* Search button (placeholder) */}
        <Button variant='ghost' size='icon' aria-label='Search'>
          <Search className='h-4 w-4' />
        </Button>

        {/* Theme toggle */}
        <Button variant='ghost' size='icon' onClick={toggleTheme} aria-label='Toggle theme'>
          {resolvedTheme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
        </Button>
      </div>
    </header>
  )
}
