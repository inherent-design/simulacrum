/**
 * @module state/session-store
 * @description Session navigation and filtering state
 *
 * Tracks currently selected session and list filters.
 * Session data itself comes from TanStack Query (useSessions hook).
 */

import { create } from 'zustand'

/**
 * Session list filter criteria
 */
export interface SessionFilters {
  /** Filter by project path (exact match) */
  projectPath?: string
  /** Filter by session status */
  status?: 'active' | 'pruned' | 'compacted'
  /** Filter by date range */
  dateRange?: {
    start: Date
    end: Date
  }
}

/**
 * Session navigation state
 */
export interface SessionState {
  /** Currently selected session ID */
  currentSessionId: string | null
  /** Active filters for session list */
  filters: SessionFilters
}

/**
 * Session store actions
 */
export interface SessionActions {
  /** Set current session (null to deselect) */
  setCurrentSession: (sessionId: string | null) => void
  /** Update filters (merges with existing) */
  setFilters: (filters: Partial<SessionFilters>) => void
  /** Clear all filters */
  clearFilters: () => void
}

export type SessionStore = SessionState & SessionActions

const initialState: SessionState = {
  currentSessionId: null,
  filters: {},
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  clearFilters: () => set({ filters: {} }),
}))

// ============================================================================
// Selectors (for performance-sensitive components)
// ============================================================================

export const selectCurrentSessionId = (state: SessionStore) => state.currentSessionId
export const selectFilters = (state: SessionStore) => state.filters
export const selectProjectPathFilter = (state: SessionStore) => state.filters.projectPath
export const selectStatusFilter = (state: SessionStore) => state.filters.status
export const selectDateRangeFilter = (state: SessionStore) => state.filters.dateRange
