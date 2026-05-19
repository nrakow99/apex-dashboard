import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#536878]/40 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-emerald-400/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20',
        secondary:
          'border-[#536878]/35 bg-[#536878]/[0.12] text-[#A0B4BF] hover:bg-[#536878]/[0.18]',
        destructive:
          'border-red-400/35 bg-red-500/15 text-red-300 hover:bg-red-500/20',
        outline: 'border-white/[0.10] bg-[#0F1115]/80 text-[#E5E4E2]',
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
