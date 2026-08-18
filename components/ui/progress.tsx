'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from '@/lib/utils'

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      // Flat track per CLAUDE.md: --raised fill, --hairline border, 2px radius.
      'relative h-4 w-full overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]',
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      // Flat fill — no gradient. Progress is signaled by the bar's length
      // (position/size), never by color.
      className="h-full w-full flex-1 rounded-[2px] bg-[var(--text)] transition-all duration-500"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
