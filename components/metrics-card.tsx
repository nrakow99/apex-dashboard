"use client"

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
}

export function MetricsCard({ title, value, change, status, subValue }: MetricsCardProps) {
  return (
    <Card className="p-3 sm:p-4 bg-card/50 backdrop-blur border-border/50">
      <div className="space-y-0.5 sm:space-y-1">
        <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
          {title}
        </p>
        <p className={cn(
          "text-lg sm:text-[22px] font-semibold font-mono tracking-tight leading-tight truncate",
          value.startsWith("+") && "text-emerald-500",
          value.startsWith("-") && "text-red-500"
        )}>
          {value}
        </p>
        {change && (
          <p className={cn(
            "text-xs font-mono",
            change.isPositive ? "text-emerald-500/80" : "text-red-500/80"
          )}>
            {change.value}
            {change.percentage && ` (${change.percentage})`}
          </p>
        )}
        {status && (
          <p className={cn(
            "text-[11px]",
            status.isGood ? "text-muted-foreground" : "text-amber-500"
          )}>
            {status.label}
          </p>
        )}
        {subValue && (
          <p className="text-[11px] text-muted-foreground/70 font-mono">
            {subValue}
          </p>
        )}
      </div>
    </Card>
  )
}
