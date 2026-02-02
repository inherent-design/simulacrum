/**
 * @module state/timeline-store
 * @description Timeline playback state for session replay visualization
 *
 * Controls for navigating through session history.
 * Timestamp is Unix epoch milliseconds for compatibility with visx/d3 time scales.
 */

import { create } from 'zustand'

/**
 * Timeline playback state
 */
export interface TimelineState {
  /** Current position in timeline (epoch ms) */
  currentTimestamp: number
  /** Whether playback is active */
  isPlaying: boolean
  /** Playback speed multiplier */
  playbackSpeed: 1 | 2 | 4
  /** Visible window in timeline */
  visibleRange: {
    start: number
    end: number
  }
  /** Total timeline bounds (from session data) */
  bounds: {
    start: number
    end: number
  } | null
}

/**
 * Timeline store actions
 */
export interface TimelineActions {
  /** Start playback */
  play: () => void
  /** Pause playback */
  pause: () => void
  /** Toggle play/pause */
  togglePlayback: () => void
  /** Seek to specific timestamp */
  seek: (timestamp: number) => void
  /** Set playback speed */
  setSpeed: (speed: 1 | 2 | 4) => void
  /** Set visible range */
  setVisibleRange: (range: { start: number; end: number }) => void
  /** Set timeline bounds (called when session loads) */
  setBounds: (bounds: { start: number; end: number }) => void
  /** Reset to initial state */
  reset: () => void
}

export type TimelineStore = TimelineState & TimelineActions

const initialState: TimelineState = {
  currentTimestamp: 0,
  isPlaying: false,
  playbackSpeed: 1,
  visibleRange: { start: 0, end: 0 },
  bounds: null,
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  ...initialState,

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

  seek: (timestamp) => {
    const { bounds } = get()
    if (!bounds) {
      set({ currentTimestamp: timestamp })
      return
    }
    // Clamp to bounds
    const clamped = Math.max(bounds.start, Math.min(bounds.end, timestamp))
    set({ currentTimestamp: clamped })
  },

  setSpeed: (speed) => set({ playbackSpeed: speed }),

  setVisibleRange: (range) => set({ visibleRange: range }),

  setBounds: (bounds) =>
    set({
      bounds,
      currentTimestamp: bounds.start,
      visibleRange: bounds,
    }),

  reset: () => set(initialState),
}))

// ============================================================================
// Selectors
// ============================================================================

export const selectCurrentTimestamp = (state: TimelineStore) => state.currentTimestamp
export const selectIsPlaying = (state: TimelineStore) => state.isPlaying
export const selectPlaybackSpeed = (state: TimelineStore) => state.playbackSpeed
export const selectVisibleRange = (state: TimelineStore) => state.visibleRange
export const selectBounds = (state: TimelineStore) => state.bounds

// ============================================================================
// Derived Selectors
// ============================================================================

export const selectProgress = (state: TimelineStore): number => {
  if (!state.bounds) return 0
  const range = state.bounds.end - state.bounds.start
  if (range === 0) return 0
  return (state.currentTimestamp - state.bounds.start) / range
}

export const selectIsAtEnd = (state: TimelineStore): boolean => {
  if (!state.bounds) return false
  return state.currentTimestamp >= state.bounds.end
}
