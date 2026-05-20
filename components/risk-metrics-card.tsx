"use client"

import { useMemo, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Trade } from "@/lib/types"
import { loadAllTradeMeta, DISCIPLINE_POSITIVE } from "@/lib/trade-meta"
import { resolveSession, SESSION_LABELS, type SessionId } from "@/lib/sessions"

interface RiskMetricsCardProps {
  trades: Trade[]
}

interface Metric {
  label: string
  value: string
  sub?: string
  color?: "positive" | "negative" | "neutral" | "amber"
  emptyPrompt?: boolean
}

/** Kept for future use; not shown in the main 8-card grid. */
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
  const [bestSession, setBestSession] = useState<{ session: SessionId; pnl: number; winRate: number } | null>(null)
  const [bestSetup, setBestSetup] = useState<{ tag: string; pnl: number; winRate: number; count: number } | null>(null)
  const [lsEdge, setLsEdge] = useState<{ longWr: number; shortWr: number; longPnl: number; shortPnl: number; longCount: number; shortCount: number } | null>(null)
  const [disciplineScore, setDisciplineScore] = useState<{ score: number; taggedCount: number } | null>(null)
  const [hasAnySessionData, setHasAnySessionData] = useState(false)
  const [hasAnySetupData, setHasAnySetupData] = useState(false)
  const [hasAnyDirectionData, setHasAnyDirectionData] = useState(false)

  useEffect(() => {
    if (trades.length === 0) {
      setBestSession(null)
      setBestSetup(null)
      setLsEdge(null)
      setDisciplineScore(null)
      setHasAnySessionData(false)
      setHasAnySetupData(false)
      setHasAnyDirectionData(false)
      return
    }

    const allMeta = loadAllTradeMeta()

    const sessionTrades: Partial<Record<SessionId, Trade[]>> = {}
    for (const t of trades) {
      const session = resolveSession(allMeta[t.id] ?? {})
      if (session) {
        if (!sessionTrades[session]) sessionTrades[session] = []
        sessionTrades[session]!.push(t)
      }
    }
    const sessionEntries = Object.entries(sessionTrades) as [SessionId, Trade[]][]
    setHasAnySessionData(sessionEntries.length > 0)
    if (sessionEntries.length > 0) {
      const best = sessionEntries
        .map(([session, ts]) => ({
          session,
          pnl: ts.reduce((s, t) => s + t.pnl, 0),
          winRate: ts.length > 0 ? Math.round((ts.filter((t) => t.pnl > 0).length / ts.length) * 100) : 0,
        }))
        .sort((a, b) => b.pnl - a.pnl)[0]
      setBestSession(best)
    } else {
      setBestSession(null)
    }

    const setupTrades: Record<string, Trade[]> = {}
    for (const t of trades) {
      const tags = allMeta[t.id]?.setupTags ?? []
      for (const tag of tags) {
        if (!setupTrades[tag]) setupTrades[tag] = []
        setupTrades[tag].push(t)
      }
    }
    const hasSetupData = Object.keys(setupTrades).length > 0
    setHasAnySetupData(hasSetupData)
    if (hasSetupData) {
      const best = Object.entries(setupTrades)
        .map(([tag, ts]) => ({
          tag,
          pnl: ts.reduce((s, t) => s + t.pnl, 0),
          winRate: ts.length > 0 ? Math.round((ts.filter((t) => t.pnl > 0).length / ts.length) * 100) : 0,
          count: ts.length,
        }))
        .filter((e) => e.count >= 1)
        .sort((a, b) => b.pnl - a.pnl)[0]
      setBestSetup(best ?? null)
    } else {
      setBestSetup(null)
    }

    const longTrades = trades.filter((t) => allMeta[t.id]?.direction === "long")
    const shortTrades = trades.filter((t) => allMeta[t.id]?.direction === "short")
    const hasDirectionData = longTrades.length > 0 || shortTrades.length > 0
    setHasAnyDirectionData(hasDirectionData)
    if (hasDirectionData) {
      setLsEdge({
        longWr: longTrades.length > 0 ? Math.round((longTrades.filter((t) => t.pnl > 0).length / longTrades.length) * 100) : 0,
        shortWr: shortTrades.length > 0 ? Math.round((shortTrades.filter((t) => t.pnl > 0).length / shortTrades.length) * 100) : 0,
        longPnl: longTrades.reduce((s, t) => s + t.pnl, 0),
        shortPnl: shortTrades.reduce((s, t) => s + t.pnl, 0),
        longCount: longTrades.length,
        shortCount: shortTrades.length,
      })
    } else {
      setLsEdge(null)
    }

    const taggedTrades = trades.filter((t) => (allMeta[t.id]?.disciplineTags?.length ?? 0) > 0)
    if (taggedTrades.length >= 3) {
      let pos = 0
      let neg = 0
      for (const t of taggedTrades) {
        const tags = allMeta[t.id]?.disciplineTags ?? []
        for (const tag of tags) {
          if (DISCIPLINE_POSITIVE.includes(tag as typeof DISCIPLINE_POSITIVE[number])) pos++
          else neg++
        }
      }
      const total = pos + neg
      const score = total > 0 ? Math.round(((pos - neg) / total + 1) / 2 * 100) : 50
      setDisciplineScore({ score: Math.max(0, Math.min(100, score)), taggedCount: taggedTrades.length })
    } else {
      setDisciplineScore(null)
    }
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

    const fmt = (n: number) =>
      `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

    const empty = (prompt: string): Pick<Metric, "value" | "sub" | "color" | "emptyPrompt"> => ({
      value: prompt,
      sub: undefined,
      color: "neutral",
      emptyPrompt: true,
    })

    const bestSessionMetric: Metric = hasAnySessionData && bestSession
      ? {
          label: "Best Session",
          value: SESSION_LABELS[bestSession.session] ?? bestSession.session,
          sub: `${fmt(bestSession.pnl)} · ${bestSession.winRate}% WR`,
          color: "neutral",
        }
      : { label: "Best Session", ...empty("Tag sessions") }

    const bestSetupMetric: Metric = hasAnySetupData && bestSetup
      ? {
          label: "Best Setup",
          value: bestSetup.tag,
          sub: `${fmt(bestSetup.pnl)} · ${bestSetup.winRate}% WR`,
          color: "neutral",
        }
      : { label: "Best Setup", ...empty("Tag setups") }

    const lsEdgeMetric: Metric = hasAnyDirectionData && lsEdge
      ? (() => {
          const longBetter = lsEdge.longCount > 0 && (lsEdge.shortCount === 0 || lsEdge.longPnl >= lsEdge.shortPnl)
          return {
            label: "L/S Edge",
            value: lsEdge.longCount > 0 && lsEdge.shortCount > 0
              ? `${lsEdge.longWr}% / ${lsEdge.shortWr}%`
              : lsEdge.longCount > 0 ? `L: ${lsEdge.longWr}%` : `S: ${lsEdge.shortWr}%`,
            sub: longBetter ? "Long edge" : "Short edge",
            color: "neutral" as const,
          }
        })()
      : { label: "L/S Edge", ...empty("Add direction") }

    const disciplineMetric: Metric = disciplineScore
      ? (() => {
          const { score } = disciplineScore
          return {
            label: "Discipline",
            value: `${score}`,
            sub: score >= 75 ? "Excellent" : score >= 55 ? "Good" : score >= 40 ? "Improving" : "Needs work",
            color: score >= 75 ? "positive" as const : score >= 55 ? "amber" as const : "negative" as const,
          }
        })()
      : { label: "Discipline", ...empty("Tag trades") }

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
        sub: wins.length > 0 ? `${wins.length} winners` : "No wins yet",
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
      bestSessionMetric,
      bestSetupMetric,
      lsEdgeMetric,
      disciplineMetric,
    ]
  }, [trades, bestSession, bestSetup, lsEdge, disciplineScore, hasAnySessionData, hasAnySetupData, hasAnyDirectionData])

  if (trades.length === 0) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 lg:gap-2 auto-rows-fr">
      {metrics.map((m) => (
        <MetricCard key={m.label} metric={m} />
      ))}
    </div>
  )
}

function MetricCard({ metric: m }: { metric: Metric }) {
  return (
    <div
      className={cn(
        "glass-card rounded-[14px] px-3 py-3 sm:px-4 sm:py-3.5 lg:px-3 lg:py-2 flex flex-col justify-between gap-2 lg:gap-1 min-h-[88px] sm:min-h-[96px] lg:min-h-[72px] h-full transition-colors",
        m.emptyPrompt ? "opacity-65" : "hover:bg-[rgba(83,104,120,0.06)]",
      )}
    >
      <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-[#E5E4E2]/40 leading-tight">
        {m.label}
      </span>
      <div className="flex flex-col gap-0.5 mt-auto">
        <span
          className={cn(
            "font-bold tabular-nums leading-tight",
            m.emptyPrompt
              ? "text-[11px] sm:text-xs font-medium italic text-[#E5E4E2]/35"
              : "text-base sm:text-lg lg:text-base",
            !m.emptyPrompt && m.color === "positive" && "text-emerald-500",
            !m.emptyPrompt && m.color === "negative" && "text-red-500",
            !m.emptyPrompt && m.color === "amber" && "text-amber-400",
            !m.emptyPrompt && m.color === "neutral" && "text-[#E5E4E2]/80",
          )}
        >
          {m.value}
        </span>
        {m.sub && (
          <span className="text-[10px] sm:text-[11px] leading-tight text-[#E5E4E2]/30 truncate">
            {m.sub}
          </span>
        )}
      </div>
    </div>
  )
}
