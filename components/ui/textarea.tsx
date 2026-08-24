import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-[9px] border border-[#303034] bg-[#171719] px-3 py-2 text-base ring-offset-background placeholder:text-[#5B5B61] focus-visible:border-[#5A5A60] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5A5A60] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
