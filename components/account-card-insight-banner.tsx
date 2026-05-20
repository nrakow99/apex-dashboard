"use client"

import { TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AccountCardInsight, AccountInsightTone } from "@/lib/account-card-insight"

interface AccountCardInsightBannerProps {
  insight: AccountCardInsight
  className?: string
}

const toneStyles: Record<AccountInsightTone, { wrap: string; icon: string; text: string }> = {
  neutral: {
    wrap: "bg-[rgba(83,104,120,0.07)] border-[rgba(83,104,120,0.18)]",
    icon: "text-[#94AAB8]",
    text: "text-[#E5E4E2]/55",
  },
  positive: {
    wrap: "bg-emerald-500/[0.06] border-emerald-500/20",
    icon: "text-emerald-400/90",
    text: "text-emerald-300/75",
  },
  warning: {
    wrap: "bg-amber-500/[0.06] border-amber-500/22",
    icon: "text-amber-400/90",
    text: "text-amber-300/80",
  },
  muted: {
    wrap: "bg-white/[0.03] border-white/[0.08]",
    icon: "text-[#E5E4E2]/30",
    text: "text-[#E5E4E2]/38",
  },
}

function InsightIcon({ tone }: { tone: AccountInsightTone }) {
  const className = cn("h-3 w-3 shrink-0", toneStyles[tone].icon)
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
        "flex items-center gap-1.5 py-1.5 px-2 rounded-lg border min-h-0",
        s.wrap,
        className,
      )}
      role="status"
    >
      <InsightIcon tone={insight.tone} />
      <span className={cn("text-[10px] leading-snug", s.text)}>{insight.message}</span>
    </div>
  )
}
