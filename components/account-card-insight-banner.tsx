"use client"

import { TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AccountCardInsight, AccountInsightTone } from "@/lib/account-card-insight"

interface AccountCardInsightBannerProps {
  insight: AccountCardInsight
  className?: string
}

/**
 * Structural tone system — no chromatic background per tone. Every tone
 * renders on the same flat --raised / --hairline surface; the signal comes
 * from icon shape + label weight only (position/size/weight, per CLAUDE.md).
 */
const toneStyles: Record<AccountInsightTone, { text: string; weight: string }> = {
  neutral: { text: "text-[var(--muted-foreground)]", weight: "font-normal" },
  positive: { text: "text-[var(--text)]", weight: "font-medium" },
  warning: { text: "text-[var(--text)]", weight: "font-semibold" },
  muted: { text: "text-[var(--faint)]", weight: "font-normal" },
}

function InsightIcon({ tone }: { tone: AccountInsightTone }) {
  const className = cn(
    "h-3 w-3 shrink-0",
    tone === "muted" ? "text-[var(--faint)]" : "text-[var(--text)]",
  )
  if (tone === "positive") return <CheckCircle2 className={className} aria-hidden />
  if (tone === "warning") return <AlertTriangle className={className} aria-hidden />
  if (tone === "muted") return <Info className={className} aria-hidden />
  return <TrendingUp className={className} aria-hidden />
}

export function AccountCardInsightBanner({ insight, className }: AccountCardInsightBannerProps) {
  const s = toneStyles[insight.tone]

  return (
    <div
      className={cn(
        "flex min-h-0 items-center gap-2 rounded-[2px] border px-3 py-2.5",
        "border-[var(--hairline)] bg-[var(--raised)]",
        className,
      )}
      role="status"
    >
      <InsightIcon tone={insight.tone} />
      <span className={cn("text-[11px] leading-snug", s.text, s.weight)}>{insight.message}</span>
    </div>
  )
}
