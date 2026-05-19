"use client"

import { useMemo, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Trade } from "@/lib/types"
import { loadAllTradeMeta } from "@/lib/trade-meta"
import { resolveSession, SESSION_LABELS, type SessionId } from "@/lib/sessions"

interface RiskMetricsCardProps {
  trades: Trade[]
}

interface Metric {
  label: string
  value: string
  sub?: string
  color?: "positive" | "negative" | "neutral" | "amber"
}

function calcConsecutiveLosses(trades: Trade[]): number {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  let max = 0
  let cur = 0
  for (const t of sorted) {
    if (t.pnl < 0) { cur++; max = Math.max(max, cur) }
    else cur = 0
  }
  return max
}

export function RiskMetricsCard({ trades }: RiskMetricsCardProps) {
  // Best session requires localStorage — defer to client to avoid hydration mismatch.
  const [bestSession, setBestSession] = useState<{ session: SessionId; pnl: number } | null>(null)

  useEffect(() => {
    if (trades.length === 0) { setBestSession(null); return }
    const allMeta = loadAllTradeMeta()
    const totals: Partial<Record<SessionId, number>> = {}
    for (const t of trades) {
      const session = resolveSession(allMeta[t.id] ?? {})
      if (session) totals[session] = (totals[session] ?? 0) + t.pnl
    }
    const entries = Object.entries(totals) as [SessionId, number][]
    if (entries.length === 0) { setBestSession(null); return }
    const [session, pnl] = entries.sort(([, a], [, b]) => b - a)[0]
    setBestSession({ session, pnl })
  }, [trades])

  const metrics = useMemo<Metric[]>(() => {
    if (trades.length === 0) return []

    const wins = trades.filter((t) => t.pnl > 0)
    const losses = trades.filter((t) => t.pnl < 0)
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0

    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

    const maxConsecLosses = calcConsecutiveLosses(trades)

    const fmt = (n: number) =>
      `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

    return [
      {
        label: "Win Rate",
        value: `${winRate.toFixed(0)}%`,
        sub: `${wins.length}W / ${losses.length}L`,
        color: winRate >= 55 ? "positive" : winRate >= 40 ? "amber" : "negative",
      },
      {
        label: "Avg Win",
        value: wins.length > 0 ? fmt(avgWin) : "—",
        sub: wins.length > 0 ? `${wins.length} winners` : "—",
        color: "positive",
      },
      {
        label: "Avg Loss",
        value: avgLoss > 0 ? fmt(avgLoss) : "—",
        sub: losses.length > 0 ? `${losses.length} losers` : "No losses",
        color: losses.length > 0 ? "negative" : "neutral",
      },
      {
        label: "Profit Factor",
        value: isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞",
        sub: profitFactor >= 1.5 ? "Strong" : profitFactor >= 1 ? "Positive" : "Needs work",
        color: profitFactor >= 1.5 ? "positive" : profitFactor >= 1 ? "amber" : "negative",
      },
      {
        label: "Best Session",
        // bestSession comes from state — always "—" on server to avoid hydration mismatch
        value: bestSession ? (SESSION_LABELS[bestSession.session] ?? "—") : "—",
        sub: bestSession ? `+${fmt(bestSession.pnl)}` : "Tag sessions",
        color: "neutral",
      },
      {
        label: "Max Consec. Loss",
        value: `${maxConsecLosses}`,
        sub: maxConsecLosses >= 3 ? "Review risk" : maxConsecLosses > 0 ? "Acceptable" : "Clean",
        color: maxConsecLosses >= 3 ? "negative" : maxConsecLosses > 0 ? "amber" : "positive",
      },
    ]
  }, [trades, bestSession])

  if (trades.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="glass-card rounded-[14px] px-2.5 py-2 sm:px-3 sm:py-2.5 flex flex-col gap-0.5 sm:gap-1 hover:bg-[rgba(83,104,120,0.06)] transition-colors"
        >
          <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-[#E5E4E2]/35 leading-tight">
            {m.label}
          </span>
          <span
            className={cn(
              "text-sm sm:text-base font-bold tabular-nums leading-none",
              m.color === "positive" && "text-emerald-500",
              m.color === "negative" && "text-red-500",
              m.color === "amber" && "text-amber-400",
              m.color === "neutral" && "text-[#E5E4E2]/75",
            )}
          >
            {m.value}
          </span>
          {m.sub && (
            <span className="text-[9px] sm:text-[10px] text-[#E5E4E2]/30 leading-tight">{m.sub}</span>
          )}
        </div>
      ))}
    </div>
  )
}
