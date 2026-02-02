/**
 * @module components/layout/main-layout
 * @description Main application layout with sidebar and header
 */

import type { ReactNode } from 'react'
import { Sidebar } from './sidebar.tsx'
import { Header } from './header.tsx'
import { cn } from '../../lib/utils.ts'

/**
 * Main layout props
 */
export interface MainLayoutProps {
  /** Page content */
  children: ReactNode
  /** Page title for header */
  title?: string
  /** Additional class names for main content area */
  className?: string
}

/**
 * Main application layout.
 *
 * Provides sidebar navigation, header, and main content area.
 */
export function MainLayout({ children, title, className }: MainLayoutProps) {
  return (
    <div className='flex h-screen overflow-hidden bg-background'>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className='flex flex-col flex-1 overflow-hidden'>
        {/* Header */}
        <Header title={title} />

        {/* Page content */}
        <main className={cn('flex-1 overflow-auto p-6', className)}>{children}</main>
      </div>
    </div>
  )
}
