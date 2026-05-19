import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-xl border border-white/[0.10] bg-[#0F1115]/85 px-3 py-2 text-base ring-offset-background placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#536878]/45 focus-visible:ring-offset-2 focus-visible:border-[#536878]/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
