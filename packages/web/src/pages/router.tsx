/**
 * @module pages/router
 * @description TanStack Router configuration
 *
 * Route tree:
 * /                    -> redirect to /sessions
 * /sessions            -> SessionsPage
 * /sessions/:sessionId -> SessionDetailPage
 * /analytics           -> AnalyticsPage
 * /settings            -> SettingsPage
 * *                    -> NotFoundPage (catch-all)
 */

import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { RootLayout } from './layout.tsx'
import { SessionsPage } from './sessions.tsx'
import { SessionDetailPage } from './session-detail.tsx'
import { AnalyticsPage } from './analytics.tsx'
import { SettingsPage } from './settings.tsx'
import { NotFoundPage } from './not-found.tsx'

/**
 * Root route with layout
 */
const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

/**
 * Index route - redirects to sessions
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/sessions' })
  },
})

/**
 * Sessions list route
 */
const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: SessionsPage,
})

/**
 * Session detail route
 */
const sessionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  component: SessionDetailPage,
})

/**
 * Analytics route
 */
const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: AnalyticsPage,
})

/**
 * Settings route
 */
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

/**
 * Route tree
 */
const routeTree = rootRoute.addChildren([
  indexRoute,
  sessionsRoute,
  sessionDetailRoute,
  analyticsRoute,
  settingsRoute,
])

/**
 * Router instance
 */
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultNotFoundComponent: NotFoundPage,
})

/**
 * Type declaration for router
 */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
