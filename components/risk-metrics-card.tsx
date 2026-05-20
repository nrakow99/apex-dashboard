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
  // Session/setup data requires localStorage — defer to avoid hydration mismatch.
  const [bestSession, setBestSession] = useState<{ session: SessionId; pnl: number; winRate: number } | null>(null)
  const [bestSetup, setBestSetup] = useState<{ tag: string; pnl: number; winRate: number; count: number } | null>(null)
  const [lsEdge, setLsEdge] = useState<{ longWr: number; shortWr: number; longPnl: number; shortPnl: number; longCount: number; shortCount: number } | null>(null)
  const [disciplineScore, setDisciplineScore] = useState<{ score: number; taggedCount: number } | null>(null)
  const [hasAnySetupData, setHasAnySetupData] = useState(false)
  const [hasAnyDirectionData, setHasAnyDirectionData] = useState(false)

  useEffect(() => {
    if (trades.length === 0) {
      setBestSession(null)
      setBestSetup(null)
      setLsEdge(null)
      return
    }

    const allMeta = loadAllTradeMeta()

    // ── Best Session ─────────────────────────────────────────────────────────
    const sessionTrades: Partial<Record<SessionId, Trade[]>> = {}
    for (const t of trades) {
      const session = resolveSession(allMeta[t.id] ?? {})
      if (session) {
        if (!sessionTrades[session]) sessionTrades[session] = []
        sessionTrades[session]!.push(t)
      }
    }
    const sessionEntries = Object.entries(sessionTrades) as [SessionId, Trade[]][]
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

    // ── Best Setup ───────────────────────────────────────────────────────────
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

    // ── Long vs Short Edge ───────────────────────────────────────────────────
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

    // ── Discipline Score ─────────────────────────────────────────────────
    // Score = (pos - neg) mapped onto 0-100. Only shown when ≥3 tagged trades.
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

    const maxConsecLosses = calcConsecutiveLosses(trades)

    const fmt = (n: number) =>
      `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

    const base: Metric[] = [
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
        value: bestSession ? (SESSION_LABELS[bestSession.session] ?? "—") : "—",
        sub: bestSession ? `${fmt(bestSession.pnl)} · ${bestSession.winRate}% WR` : "Tag sessions",
        color: "neutral",
      },
      {
        label: "Max Consec. Loss",
        value: `${maxConsecLosses}`,
        sub: maxConsecLosses >= 3 ? "Review risk" : maxConsecLosses > 0 ? "Acceptable" : "Clean",
        color: maxConsecLosses >= 3 ? "negative" : maxConsecLosses > 0 ? "amber" : "positive",
      },
    ]

    // Best Setup — only when data exists
    if (hasAnySetupData && bestSetup) {
      base.push({
        label: "Best Setup",
        value: bestSetup.tag,
        sub: `${fmt(bestSetup.pnl)} · ${bestSetup.winRate}% WR`,
        color: "neutral",
      })
    } else if (!hasAnySetupData && trades.length >= 3) {
      base.push({
        label: "Best Setup",
        value: "—",
        sub: "Tag setups to unlock",
        color: "neutral",
        emptyPrompt: true,
      })
    }

    // L/S Edge — only when direction data exists
    if (hasAnyDirectionData && lsEdge) {
      const longBetter = lsEdge.longCount > 0 && (lsEdge.shortCount === 0 || lsEdge.longPnl >= lsEdge.shortPnl)
      base.push({
        label: "L/S Edge",
        value: lsEdge.longCount > 0 && lsEdge.shortCount > 0
          ? `${lsEdge.longWr}% / ${lsEdge.shortWr}%`
          : lsEdge.longCount > 0 ? `L: ${lsEdge.longWr}%` : `S: ${lsEdge.shortWr}%`,
        sub: longBetter ? "Long edge" : "Short edge",
        color: "neutral",
      })
    }

    // Discipline Score — only when ≥3 trades are tagged
    if (disciplineScore) {
      const { score } = disciplineScore
      base.push({
        label: "Discipline",
        value: `${score}`,
        sub: score >= 75 ? "Excellent" : score >= 55 ? "Good" : score >= 40 ? "Improving" : "Needs work",
        color: score >= 75 ? "positive" : score >= 55 ? "amber" : "negative",
      })
    } else if (trades.length >= 3) {
      base.push({
        label: "Discipline",
        value: "—",
        sub: "Tag trades to unlock",
        color: "neutral",
        emptyPrompt: true,
      })
    }

    return base
  }, [trades, bestSession, bestSetup, lsEdge, disciplineScore, hasAnySetupData, hasAnyDirectionData])

  if (trades.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={cn(
            "glass-card rounded-[14px] px-2.5 py-2 sm:px-3 sm:py-2.5 flex flex-col gap-0.5 sm:gap-1 transition-colors",
            m.emptyPrompt
              ? "opacity-60"
              : "hover:bg-[rgba(83,104,120,0.06)]",
          )}
        >
          <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-[#E5E4E2]/35 leading-tight">
            {m.label}
          </span>
          <span
            className={cn(
              "text-sm sm:text-base font-bold tabular-nums leading-none",
              m.emptyPrompt && "text-[#E5E4E2]/25 text-xs! font-normal!",
              !m.emptyPrompt && m.color === "positive" && "text-emerald-500",
              !m.emptyPrompt && m.color === "negative" && "text-red-500",
              !m.emptyPrompt && m.color === "amber" && "text-amber-400",
              !m.emptyPrompt && m.color === "neutral" && "text-[#E5E4E2]/75",
            )}
          >
            {m.value}
          </span>
          {m.sub && (
            <span className={cn(
              "text-[9px] sm:text-[10px] leading-tight",
              m.emptyPrompt ? "text-[#E5E4E2]/22 italic" : "text-[#E5E4E2]/30"
            )}>
              {m.sub}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
