/**
 * @module pages/layout
 * @description Root application layout with sidebar and theme management
 *
 * Features:
 * - Collapsible sidebar (persisted in ui-store)
 * - Theme application to document (dark mode)
 * - Responsive main content area
 * - Header with breadcrumbs
 */

import { useEffect, type ReactNode } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Sidebar } from '../components/layout/sidebar.tsx'
import { useUIStore, selectResolvedTheme, selectSidebarCollapsed } from '../state/index.ts'
import { cn } from '../lib/utils.ts'

/**
 * Breadcrumb item for navigation trail
 */
export interface BreadcrumbItem {
  label: string
  href?: string
}

/**
 * Root layout component.
 *
 * Features:
 * - Collapsible sidebar (persisted in ui-store)
 * - Theme application to document
 * - Responsive main content area
 */
export function RootLayout() {
  const resolvedTheme = useUIStore(selectResolvedTheme)
  const sidebarCollapsed = useUIStore(selectSidebarCollapsed)

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolvedTheme])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      // Force re-render by touching theme state
      useUIStore.getState().setTheme(useUIStore.getState().theme)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <div className='flex h-screen bg-background text-foreground'>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {/* Page content (nested routes) */}
        <div className='flex-1 overflow-auto'>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

/**
 * Page header with breadcrumbs.
 * Used by individual pages for consistent header styling.
 */
export function PageHeader({
  title,
  breadcrumbs = [],
  actions,
}: {
  title: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
}) {
  return (
    <header className='sticky top-0 z-10 flex items-center justify-between h-14 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='flex items-center gap-2'>
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className='flex items-center gap-1 text-sm text-muted-foreground'>
            {breadcrumbs.map((item, index) => (
              <span key={index} className='flex items-center gap-1'>
                {item.href ? (
                  <a href={item.href} className='hover:text-foreground'>
                    {item.label}
                  </a>
                ) : (
                  <span>{item.label}</span>
                )}
                {index < breadcrumbs.length - 1 && (
                  <span className='text-muted-foreground/50'>/</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Page title */}
        <h1 className='text-lg font-semibold'>{title}</h1>
      </div>

      {/* Action buttons */}
      {actions && <div className='flex items-center gap-2'>{actions}</div>}
    </header>
  )
}
