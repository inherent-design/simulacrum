/**
 * @module pages/settings
 * @description User preferences page with theme and table settings
 *
 * Route: /settings
 *
 * Features:
 * - Theme selection (light/dark/system)
 * - Table page size adjustment
 * - Message density preference
 * - Reset to defaults
 */

import { PageHeader } from './layout.tsx'
import { Card, Button, Slider, ToggleGroup, ToggleGroupItem } from '../components/ui/index.tsx'
import {
  useUIStore,
  selectTheme,
  selectTablePageSize,
  selectMessageDensity,
  type Theme,
} from '../state/index.ts'
import { Sun, Moon, Monitor, RotateCcw } from 'lucide-react'

/**
 * Settings page.
 */
export function SettingsPage() {
  const theme = useUIStore(selectTheme)
  const tablePageSize = useUIStore(selectTablePageSize)
  const messageDensity = useUIStore(selectMessageDensity)
  const { setTheme, setPageSize, setMessageDensity, resetPreferences } = useUIStore()

  return (
    <div className='flex flex-col h-full'>
      <PageHeader
        title='Settings'
        breadcrumbs={[{ label: 'Settings' }]}
        actions={
          <Button variant='ghost' size='sm' onClick={resetPreferences}>
            <RotateCcw className='h-4 w-4 mr-2' />
            Reset to Defaults
          </Button>
        }
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-2xl space-y-6'>
          {/* Appearance Section */}
          <Card className='p-6'>
            <h2 className='text-lg font-semibold mb-4'>Appearance</h2>

            {/* Theme */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Theme</label>
              <p className='text-sm text-muted-foreground'>Select your preferred color theme</p>
              <ToggleGroup
                type='single'
                value={theme}
                onValueChange={(value) => value && setTheme(value as Theme)}
                className='justify-start'
              >
                <ToggleGroupItem value='light' aria-label='Light theme'>
                  <Sun className='h-4 w-4 mr-2' />
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem value='dark' aria-label='Dark theme'>
                  <Moon className='h-4 w-4 mr-2' />
                  Dark
                </ToggleGroupItem>
                <ToggleGroupItem value='system' aria-label='System theme'>
                  <Monitor className='h-4 w-4 mr-2' />
                  System
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </Card>

          {/* Data Display Section */}
          <Card className='p-6'>
            <h2 className='text-lg font-semibold mb-4'>Data Display</h2>

            {/* Table page size */}
            <div className='space-y-4'>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <label className='text-sm font-medium'>Table Page Size</label>
                  <span className='text-sm text-muted-foreground'>{tablePageSize} items</span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  Number of items to load per page in session lists
                </p>
                <Slider
                  value={[tablePageSize]}
                  onValueChange={([value]) => value !== undefined && setPageSize(value)}
                  min={10}
                  max={100}
                  step={10}
                  className='w-full'
                />
                <div className='flex justify-between text-xs text-muted-foreground'>
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>

              <div className='h-px bg-border' />

              {/* Message density */}
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Message Density</label>
                <p className='text-sm text-muted-foreground'>
                  Spacing between messages in the timeline view
                </p>
                <select
                  value={messageDensity}
                  onChange={(e) =>
                    setMessageDensity(e.target.value as 'compact' | 'comfortable' | 'spacious')
                  }
                  className='w-[200px] px-3 py-2 border rounded-md bg-background'
                >
                  <option value='compact'>Compact</option>
                  <option value='comfortable'>Comfortable</option>
                  <option value='spacious'>Spacious</option>
                </select>
              </div>
            </div>
          </Card>

          {/* About Section */}
          <Card className='p-6'>
            <h2 className='text-lg font-semibold mb-4'>About</h2>
            <div className='space-y-2 text-sm'>
              <p>
                <span className='text-muted-foreground'>Application:</span> Simulacrum
              </p>
              <p>
                <span className='text-muted-foreground'>Description:</span> Claude Code session
                replay tool
              </p>
              <p>
                <span className='text-muted-foreground'>Package:</span>{' '}
                @inherent.design/simulacrum-web
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
