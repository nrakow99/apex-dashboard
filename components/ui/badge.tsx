import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-emerald-400/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20',
        secondary:
          'border-cyan-300/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20',
        destructive:
          'border-red-400/35 bg-red-500/15 text-red-300 hover:bg-red-500/20',
        outline: 'border-white/15 bg-slate-900/70 text-slate-200',
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
