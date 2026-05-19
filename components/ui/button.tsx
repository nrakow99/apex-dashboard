import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#536878]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /* Default CTA — emerald, with restrained glow (no neon spread) */
        default:
          'bg-gradient-to-r from-emerald-500 to-teal-500 text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.07)_inset,0_10px_22px_-16px_rgba(16,185,129,0.35)] hover:brightness-105 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.10)_inset,0_12px_24px_-16px_rgba(20,184,166,0.40)]',
        destructive:
          'bg-destructive/90 text-destructive-foreground hover:bg-destructive',
        /* Outline — dark surface, subtle Blue Slate hover edge */
        outline:
          'border border-white/[0.10] bg-[#0F1115]/80 text-[#E5E4E2] hover:border-[#536878]/35 hover:bg-[#111318]/90',
        /* Secondary / toggle — quiet dark fill */
        secondary:
          'bg-[#1A1D24]/90 text-[#E5E4E2] hover:bg-[#1E2229]/90',
        ghost: 'text-slate-400 hover:bg-[#111318]/80 hover:text-[#E5E4E2]',
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
