"use client"

import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricsCardProps {
  className?: string
  title: string
  value: string
  change?: {
    value: string
    percentage?: string
    isPositive: boolean
  }
  status?: {
    label: string
    isGood: boolean
  }
  subValue?: string // Optional secondary value (e.g., projected floor)
  /** e.g. manual edit control aligned with title row */
  titleAction?: ReactNode
}

export function MetricsCard({ className, title, value, change, status, subValue, titleAction }: MetricsCardProps) {
  return (
    <Card className={cn("h-full rounded-none border-[var(--hairline)] bg-[#101012] p-4 sm:p-5", className)}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-1.5">
          <p className="min-w-0 flex-1 text-[10px] font-medium uppercase leading-tight tracking-[0.16em] text-[var(--muted)] line-clamp-2">
            {title}
          </p>
          {titleAction ? <span className="shrink-0">{titleAction}</span> : null}
        </div>
        <p className={cn(
          "truncate font-mono text-xl font-medium leading-none tracking-[-0.04em] sm:text-2xl",
          value.startsWith("+") && "text-[var(--gain)]",
          value.startsWith("-") && "text-[var(--loss)]"
        )}>
          {value}
        </p>
        {/* change.isPositive still drives no visual — every caller passes
            descriptive/status text here ("of $X goal", "3/5 required"), never
            a signed figure, so red/green was color without a sign in front
            of it. Plain --muted-foreground, same as subValue below. */}
        {change && (
          <p className="font-mono text-[11px] text-[var(--muted)]">
            {change.value}
            {change.percentage && ` (${change.percentage})`}
          </p>
        )}
        {status && (
          <p className={cn(
            "text-[11px]",
            status.isGood ? "text-[var(--muted)]" : "font-medium text-[var(--text)]"
          )}>
            {status.label}
          </p>
        )}
        {subValue && (
          <p className="font-mono text-[11px] text-[var(--muted)]">
            {subValue}
          </p>
        )}
      </div>
    </Card>
  )
}
