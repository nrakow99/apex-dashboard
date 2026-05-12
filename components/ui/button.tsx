import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_12px_24px_-16px_rgba(16,185,129,0.7)] hover:brightness-105 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_14px_28px_-16px_rgba(20,184,166,0.72)]',
        destructive:
          'bg-destructive/90 text-destructive-foreground hover:bg-destructive',
        outline:
          'border border-white/15 bg-slate-900/55 text-slate-100 hover:border-cyan-300/25 hover:bg-slate-900/80',
        secondary:
          'bg-slate-800/80 text-secondary-foreground hover:bg-slate-700/80',
        ghost: 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 rounded-xl px-7',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
