/**
 * @module pages
 * @description Route pages for the Simulacrum web application
 *
 * This module exports:
 * - Router instance and configuration
 * - Page components for each route
 * - Layout components (RootLayout, PageHeader)
 *
 * Route structure:
 * /                    -> redirect to /sessions
 * /sessions            -> SessionsPage (session list with filters)
 * /sessions/:sessionId -> SessionDetailPage (timeline, messages, agents)
 * /analytics           -> AnalyticsPage (dashboard with charts)
 * /settings            -> SettingsPage (preferences)
 * *                    -> NotFoundPage (404)
 *
 * @example
 * ```typescript
 * import { router } from '@/pages'
 * import { RouterProvider } from '@tanstack/react-router'
 *
 * function App() {
 *   return <RouterProvider router={router} />
 * }
 * ```
 */

// Router
export { router } from './router.tsx'

// Layout components
export { RootLayout, PageHeader, type BreadcrumbItem } from './layout.tsx'

// Page components
export { SessionsPage } from './sessions.tsx'
export { SessionDetailPage } from './session-detail.tsx'
export { AnalyticsPage } from './analytics.tsx'
export { SettingsPage } from './settings.tsx'
export { NotFoundPage } from './not-found.tsx'
