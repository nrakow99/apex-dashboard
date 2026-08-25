import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 py-2 text-base ring-offset-background placeholder:text-[var(--faint)] focus-visible:border-[var(--faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--faint)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
