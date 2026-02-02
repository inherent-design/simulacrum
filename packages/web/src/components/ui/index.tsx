/**
 * @module components/ui
 * @description shadcn/ui component re-exports
 *
 * Components are installed via CLI:
 * pnpm dlx shadcn@latest add <component>
 *
 * After installation, export from this file for clean imports.
 *
 * @example Installation (run from web package):
 * ```bash
 * pnpm dlx shadcn@latest add button
 * pnpm dlx shadcn@latest add card
 * pnpm dlx shadcn@latest add dialog
 * # ... etc
 * ```
 *
 * @example Usage after installation:
 * ```typescript
 * import { Button, Card, Dialog } from '@/components/ui'
 * ```
 *
 * Placeholder exports for type checking during scaffold phase.
 * These will be replaced by actual shadcn/ui components during implementation.
 */

// Placeholder components for scaffold phase
// These provide type stubs for component development
// Replace with actual shadcn/ui exports after installation

import type { ComponentProps, ReactNode } from 'react'

// ============================================================================
// Badge
// ============================================================================

export interface BadgeProps extends ComponentProps<'span'> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

export function Badge({ children, className, variant = 'default', ...props }: BadgeProps) {
  void variant
  return (
    <span className={className} {...props}>
      {children}
    </span>
  )
}

// ============================================================================
// Button
// ============================================================================

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

export function Button({ children, className, variant, size, asChild, ...props }: ButtonProps) {
  void variant
  void size
  void asChild
  return (
    <button className={className} {...props}>
      {children}
    </button>
  )
}

// ============================================================================
// Card
// ============================================================================

export interface CardProps extends ComponentProps<'div'> {}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

// ============================================================================
// Collapsible
// ============================================================================

export interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function Collapsible({ children }: CollapsibleProps) {
  return <div>{children}</div>
}

export interface CollapsibleTriggerProps extends ComponentProps<'button'> {}

export function CollapsibleTrigger({ children, className, ...props }: CollapsibleTriggerProps) {
  return (
    <button className={className} {...props}>
      {children}
    </button>
  )
}

export interface CollapsibleContentProps extends ComponentProps<'div'> {}

export function CollapsibleContent({ children, className, ...props }: CollapsibleContentProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

// ============================================================================
// ScrollArea
// ============================================================================

export interface ScrollAreaProps extends ComponentProps<'div'> {}

export const ScrollArea = ({ children, className, ...props }: ScrollAreaProps) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

// ============================================================================
// Skeleton
// ============================================================================

export interface SkeletonProps extends ComponentProps<'div'> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={className} data-testid='skeleton' {...props} />
}

// ============================================================================
// Slider
// ============================================================================

export interface SliderProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange'> {
  value?: number[]
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
}

export function Slider({ className, value, onValueChange, ...props }: SliderProps) {
  void value
  void onValueChange
  return <input type='range' className={className} {...props} />
}

// ============================================================================
// ToggleGroup
// ============================================================================

export interface ToggleGroupProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  type?: 'single' | 'multiple'
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

export function ToggleGroup({ children, className, ...props }: ToggleGroupProps) {
  void props.type
  void props.value
  void props.onValueChange
  void props.disabled
  return <div className={className}>{children}</div>
}

export interface ToggleGroupItemProps extends ComponentProps<'button'> {
  value: string
}

export function ToggleGroupItem({ children, className, ...props }: ToggleGroupItemProps) {
  return (
    <button className={className} {...props}>
      {children}
    </button>
  )
}

// ============================================================================
// Tooltip
// ============================================================================

export interface TooltipProviderProps {
  delayDuration?: number
  children: ReactNode
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>
}

export interface TooltipProps {
  children: ReactNode
}

export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>
}

export interface TooltipTriggerProps extends ComponentProps<'button'> {
  asChild?: boolean
}

export function TooltipTrigger({ children, asChild, ...props }: TooltipTriggerProps) {
  void asChild
  return <span {...props}>{children}</span>
}

export interface TooltipContentProps extends ComponentProps<'div'> {
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function TooltipContent({ children, className, side, ...props }: TooltipContentProps) {
  void side
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}
