/**
 * @module pages/not-found
 * @description 404 Not Found page
 *
 * Displayed when user navigates to an unknown route.
 */

import { useNavigate } from '@tanstack/react-router'
import { Button } from '../components/ui/index.tsx'
import { Home, ArrowLeft } from 'lucide-react'

/**
 * Not Found page.
 */
export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className='flex flex-col items-center justify-center h-screen gap-6 p-6'>
      <div className='text-center space-y-2'>
        <h1 className='text-6xl font-bold text-muted-foreground'>404</h1>
        <h2 className='text-2xl font-semibold'>Page Not Found</h2>
        <p className='text-muted-foreground max-w-md'>
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <div className='flex items-center gap-4'>
        <Button variant='outline' onClick={() => navigate({ to: '/sessions' })}>
          <Home className='h-4 w-4 mr-2' />
          Go to Sessions
        </Button>
        <Button variant='ghost' onClick={() => window.history.back()}>
          <ArrowLeft className='h-4 w-4 mr-2' />
          Go Back
        </Button>
      </div>
    </div>
  )
}
