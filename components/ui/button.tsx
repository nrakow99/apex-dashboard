import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /* Primary CTA per CLAUDE.md — flat white fill, black text. No gradient, no glow. */
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        /* Destructive — same rule as everywhere else: --loss is reserved for
         * signed P&L, never a button. Structural signal only: bold label +
         * a border a shade brighter than outline's, no hue at all. Callers
         * (e.g. delete confirmations) pair this with an icon for weight. */
        destructive:
          'font-bold border border-[var(--faint)] bg-[var(--raised)] text-[var(--text)] hover:border-[var(--text)] hover:bg-[var(--raised)]/80',
        /* Outline — flat --raised surface, --hairline border */
        outline:
          'border border-[var(--hairline)] bg-[var(--raised)] text-[var(--text)] hover:border-[var(--faint)] hover:bg-[var(--raised)]/80',
        /* Secondary / toggle — quiet flat fill */
        secondary:
          'bg-[var(--raised)] text-[var(--text)] hover:bg-[var(--raised)]/80',
        ghost: 'text-[var(--muted-foreground)] hover:bg-[var(--raised)]/60 hover:text-[var(--text)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-7',
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
