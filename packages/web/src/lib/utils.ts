/**
 * @module lib/utils
 * @description Utility functions for component styling
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge class names with Tailwind CSS conflict resolution.
 *
 * @example
 * ```typescript
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4'
 * cn('text-red-500', className) // => 'text-red-500 ...'
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
