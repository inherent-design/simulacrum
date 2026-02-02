/**
 * @module components/timeline/playback-controls
 * @description Timeline playback controls for session replay
 *
 * Features:
 * - Play/pause toggle
 * - Speed selector (1x, 2x, 4x)
 * - Seek slider with current position
 * - Skip forward/backward buttons
 * - Timestamp display
 */

import { useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import {
  Button,
  Slider,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/index.tsx'
import { format } from 'date-fns'
import {
  useTimelineStore,
  selectIsPlaying,
  selectPlaybackSpeed,
  selectCurrentTimestamp,
  selectBounds,
  selectProgress,
} from '../../state/index.ts'
import { cn } from '../../lib/utils.ts'

/**
 * Playback controls props
 */
export interface PlaybackControlsProps {
  /** Additional class names */
  className?: string
}

/**
 * Timeline playback controls.
 */
export function PlaybackControls({ className }: PlaybackControlsProps) {
  const isPlaying = useTimelineStore(selectIsPlaying)
  const speed = useTimelineStore(selectPlaybackSpeed)
  const currentTimestamp = useTimelineStore(selectCurrentTimestamp)
  const bounds = useTimelineStore(selectBounds)
  const progress = useTimelineStore(selectProgress)
  const togglePlayback = useTimelineStore((s) => s.togglePlayback)
  const setSpeed = useTimelineStore((s) => s.setSpeed)
  const seek = useTimelineStore((s) => s.seek)

  // Handle slider change
  const handleSliderChange = useCallback(
    (value: number[]) => {
      if (!bounds || !value[0]) return
      const newTimestamp = bounds.start + (value[0] / 100) * (bounds.end - bounds.start)
      seek(newTimestamp)
    },
    [bounds, seek]
  )

  // Skip forward/back by 10 seconds (in simulated time)
  const handleSkip = useCallback(
    (direction: 'forward' | 'backward') => {
      const delta = direction === 'forward' ? 10000 : -10000
      seek(currentTimestamp + delta)
    },
    [currentTimestamp, seek]
  )

  // Handle speed change
  const handleSpeedChange = useCallback(
    (value: string) => {
      if (value) {
        setSpeed(Number(value) as 1 | 2 | 4)
      }
    },
    [setSpeed]
  )

  const disabled = !bounds

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-4 p-4 bg-background border rounded-lg', className)}>
        {/* Skip backward */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              disabled={disabled}
              onClick={() => handleSkip('backward')}
            >
              <SkipBack className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Skip back 10s</TooltipContent>
        </Tooltip>

        {/* Play/Pause */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline' size='icon' disabled={disabled} onClick={togglePlayback}>
              {isPlaying ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isPlaying ? 'Pause' : 'Play'}</TooltipContent>
        </Tooltip>

        {/* Skip forward */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              disabled={disabled}
              onClick={() => handleSkip('forward')}
            >
              <SkipForward className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Skip forward 10s</TooltipContent>
        </Tooltip>

        {/* Current time */}
        <div className='min-w-[80px] text-sm font-mono text-center'>
          {bounds ? format(new Date(currentTimestamp), 'HH:mm:ss') : '--:--:--'}
        </div>

        {/* Seek slider */}
        <div className='flex-1'>
          <Slider
            value={[progress * 100]}
            max={100}
            step={0.1}
            disabled={disabled}
            onValueChange={handleSliderChange}
            className='w-full'
          />
        </div>

        {/* Duration */}
        <div className='min-w-[80px] text-sm font-mono text-center text-muted-foreground'>
          {bounds ? format(new Date(bounds.end), 'HH:mm:ss') : '--:--:--'}
        </div>

        {/* Speed selector */}
        <ToggleGroup
          type='single'
          value={String(speed)}
          onValueChange={handleSpeedChange}
          disabled={disabled}
        >
          <ToggleGroupItem value='1' aria-label='1x speed'>
            1x
          </ToggleGroupItem>
          <ToggleGroupItem value='2' aria-label='2x speed'>
            2x
          </ToggleGroupItem>
          <ToggleGroupItem value='4' aria-label='4x speed'>
            4x
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </TooltipProvider>
  )
}
