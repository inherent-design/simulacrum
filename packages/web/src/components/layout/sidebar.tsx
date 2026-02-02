/**
 * @module components/layout/sidebar
 * @description Navigation sidebar with collapsible sections
 *
 * Features:
 * - Collapsible with animation
 * - Main navigation links
 * - Project tree with session counts
 * - Expandable project folders
 * - Tooltips when collapsed
 * - Current session highlighting
 */

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Settings,
  BarChart3,
  Home,
  Menu,
} from 'lucide-react'
import {
  Button,
  ScrollArea,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/index.tsx'
import { useSessions } from '../../data/index.ts'
import {
  useUIStore,
  useSessionStore,
  selectSidebarCollapsed,
  selectCurrentSessionId,
} from '../../state/index.ts'
import { cn } from '../../lib/utils.ts'

/**
 * Sidebar props
 */
export interface SidebarProps {
  /** Additional class names */
  className?: string
}

/**
 * Navigation item
 */
interface NavItem {
  id: string
  label: string
  icon: typeof Home
  href: string
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'sessions', label: 'Sessions', icon: FileText, href: '/sessions' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
]

/**
 * Build project tree from session paths
 */
function buildProjectTree(
  sessions: readonly { id: string; project_path: string; title?: string | null | undefined }[]
) {
  const tree: Record<string, Array<{ id: string; title: string }>> = {}

  for (const session of sessions) {
    const path = session.project_path
    if (!tree[path]) {
      tree[path] = []
    }
    tree[path].push({
      id: session.id,
      title: session.title || session.id.slice(0, 8),
    })
  }

  return Object.entries(tree)
    .map(([path, items]) => ({
      path,
      shortPath: path.split('/').slice(-2).join('/'),
      sessions: items,
    }))
    .sort((a, b) => b.sessions.length - a.sessions.length)
}

/**
 * Navigation sidebar.
 */
export function Sidebar({ className }: SidebarProps) {
  const collapsed = useUIStore(selectSidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const currentSessionId = useSessionStore(selectCurrentSessionId)
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession)

  // Fetch sessions for project tree
  const { data } = useSessions({ limit: 100 })

  // Build project tree
  const projectTree = useMemo(
    () => (data?.sessions ? buildProjectTree(data.sessions) : []),
    [data?.sessions]
  )

  // Track expanded projects
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const toggleProject = (path: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        className={cn('flex flex-col h-full border-r bg-card', className)}
        animate={{
          width: collapsed ? 64 : 256,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className='flex items-center justify-between h-14 px-4 border-b'>
          {!collapsed && <span className='font-semibold text-lg'>Simulacrum</span>}
          <Button
            variant='ghost'
            size='icon'
            onClick={toggleSidebar}
            className={cn(collapsed && 'mx-auto')}
          >
            <Menu className='h-4 w-4' />
          </Button>
        </div>

        {/* Main navigation */}
        <nav className='flex flex-col gap-1 p-2'>
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Separator */}
        <div className='h-px bg-border mx-2' />

        {/* Project tree */}
        {!collapsed && (
          <div className='flex-1 overflow-hidden'>
            <div className='p-2 text-sm font-medium text-muted-foreground'>Projects</div>
            <ScrollArea className='h-full'>
              <div className='p-2 space-y-1'>
                {projectTree.map((project) => (
                  <Collapsible
                    key={project.path}
                    open={expandedProjects.has(project.path)}
                    onOpenChange={() => toggleProject(project.path)}
                  >
                    <CollapsibleTrigger className='flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted text-sm'>
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 transition-transform',
                          expandedProjects.has(project.path) && 'rotate-90'
                        )}
                      />
                      {expandedProjects.has(project.path) ? (
                        <FolderOpen className='h-4 w-4' />
                      ) : (
                        <Folder className='h-4 w-4' />
                      )}
                      <span className='truncate flex-1 text-left' title={project.path}>
                        {project.shortPath}
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        {project.sessions.length}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className='ml-6 space-y-1'>
                        {project.sessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => setCurrentSession(session.id)}
                            className={cn(
                              'flex items-center gap-2 w-full p-2 rounded-md text-sm hover:bg-muted',
                              session.id === currentSessionId && 'bg-accent'
                            )}
                          >
                            <FileText className='h-4 w-4 text-muted-foreground' />
                            <span className='truncate' title={session.title}>
                              {session.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </motion.aside>
    </TooltipProvider>
  )
}

/**
 * Navigation button with tooltip when collapsed
 */
function NavButton({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon

  const button = (
    <Button
      variant='ghost'
      className={cn('w-full justify-start gap-2', collapsed && 'justify-center')}
      asChild
    >
      <a href={item.href}>
        <Icon className='h-4 w-4' />
        {!collapsed && <span>{item.label}</span>}
      </a>
    </Button>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side='right'>{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return button
}
