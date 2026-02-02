/**
 * @module state/ui-store
 * @description UI preferences and layout state with localStorage persistence
 *
 * Persists to localStorage for user preference retention.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Theme preference options
 */
export type Theme = 'light' | 'dark' | 'system'

/**
 * UI preferences state
 */
export interface UIState {
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean
  /** Theme preference */
  theme: Theme
  /** Default page size for tables */
  tablePageSize: number
  /** Message list density */
  messageDensity: 'compact' | 'comfortable' | 'spacious'
}

/**
 * UI store actions
 */
export interface UIActions {
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void
  /** Set theme preference */
  setTheme: (theme: Theme) => void
  /** Set table page size */
  setPageSize: (size: number) => void
  /** Set message density */
  setMessageDensity: (density: 'compact' | 'comfortable' | 'spacious') => void
  /** Reset to defaults */
  resetPreferences: () => void
}

export type UIStore = UIState & UIActions

const initialState: UIState = {
  sidebarCollapsed: false,
  theme: 'system',
  tablePageSize: 50,
  messageDensity: 'comfortable',
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      ...initialState,

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setTheme: (theme) => set({ theme }),

      setPageSize: (size) => set({ tablePageSize: Math.max(10, Math.min(100, size)) }),

      setMessageDensity: (density) => set({ messageDensity: density }),

      resetPreferences: () => set(initialState),
    }),
    {
      name: 'simulacrum-ui-preferences',
      version: 1,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        tablePageSize: state.tablePageSize,
        messageDensity: state.messageDensity,
      }),
    }
  )
)

// ============================================================================
// Selectors
// ============================================================================

export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed
export const selectTheme = (state: UIStore) => state.theme
export const selectTablePageSize = (state: UIStore) => state.tablePageSize
export const selectMessageDensity = (state: UIStore) => state.messageDensity

// ============================================================================
// Computed Selectors
// ============================================================================

export const selectResolvedTheme = (state: UIStore): 'light' | 'dark' => {
  if (state.theme !== 'system') return state.theme
  // Check system preference
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}
