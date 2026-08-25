import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-[2px] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--faint)] focus:ring-offset-1',
  {
    variants: {
      variant: {
        default: 'border-[var(--hairline)] bg-[var(--raised)] text-[var(--text)] hover:border-[var(--faint)]',
        secondary: 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]',
        destructive: 'border-[var(--faint)] bg-[var(--raised)] text-[var(--text)] hover:border-[var(--text)]',
        outline: 'border-[var(--hairline)] bg-transparent text-[var(--muted)] hover:text-[var(--text)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
