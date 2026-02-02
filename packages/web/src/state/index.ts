/**
 * @module state
 * @description Zustand state management stores
 *
 * Re-exports all stores and selectors for convenient imports.
 *
 * @example
 * ```typescript
 * import { useSessionStore, selectCurrentSessionId } from '@/state'
 *
 * function MyComponent() {
 *   const sessionId = useSessionStore(selectCurrentSessionId)
 *   // ...
 * }
 * ```
 */

// Session store
export {
  useSessionStore,
  selectCurrentSessionId,
  selectFilters,
  selectProjectPathFilter,
  selectStatusFilter,
  selectDateRangeFilter,
  type SessionStore,
  type SessionState,
  type SessionActions,
  type SessionFilters,
} from './session-store.ts'

// Timeline store
export {
  useTimelineStore,
  selectCurrentTimestamp,
  selectIsPlaying,
  selectPlaybackSpeed,
  selectVisibleRange,
  selectBounds,
  selectProgress,
  selectIsAtEnd,
  type TimelineStore,
  type TimelineState,
  type TimelineActions,
} from './timeline-store.ts'

// UI store
export {
  useUIStore,
  selectSidebarCollapsed,
  selectTheme,
  selectTablePageSize,
  selectMessageDensity,
  selectResolvedTheme,
  type UIStore,
  type UIState,
  type UIActions,
  type Theme,
} from './ui-store.ts'
