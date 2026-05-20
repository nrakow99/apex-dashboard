"use client"

import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricsCardProps {
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

export function MetricsCard({ title, value, change, status, subValue, titleAction }: MetricsCardProps) {
  return (
    <Card className="p-2 sm:p-3.5 lg:p-2.5 rounded-[18px] sm:rounded-[20px] glass-card glass-card-hover h-full">
      <div className="space-y-0.5 sm:space-y-1 lg:space-y-0.5">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-[9px] sm:text-[11px] lg:text-[10px] font-medium text-slate-500 uppercase tracking-[0.10em] sm:tracking-[0.14em] min-w-0 flex-1 leading-tight line-clamp-2">
            {title}
          </p>
          {titleAction ? <span className="shrink-0">{titleAction}</span> : null}
        </div>
        <p className={cn(
          "text-[15px] sm:text-[20px] lg:text-[18px] font-semibold font-mono tracking-tight leading-tight truncate",
          value.startsWith("+") && "text-emerald-500",
          value.startsWith("-") && "text-red-500"
        )}>
          {value}
        </p>
        {change && (
          <p className={cn(
            "text-[10px] sm:text-xs font-mono",
            change.isPositive ? "text-emerald-500/80" : "text-red-500/80"
          )}>
            {change.value}
            {change.percentage && ` (${change.percentage})`}
          </p>
        )}
        {status && (
          <p className={cn(
            "text-[10px] sm:text-[11px]",
            status.isGood ? "text-muted-foreground" : "text-amber-500"
          )}>
            {status.label}
          </p>
        )}
        {subValue && (
          <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 font-mono">
            {subValue}
          </p>
        )}
      </div>
    </Card>
  )
}
