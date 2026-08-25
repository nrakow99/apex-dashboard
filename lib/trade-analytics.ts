import { DISCIPLINE_NEGATIVE, DISCIPLINE_POSITIVE } from "./trade-meta"
import { hasTradeReview } from "./trades-workspace"
import type { Trade } from "./types"

export interface AnalyticsBreakdownRow {
  label: string
  records: number
  pnl: number
  winRate: number | null
  averagePnl: number
}

export interface DailyAnalyticsPoint {
  date: string
  pnl: number
  cumulativePnl: number
  records: number
}

function breakdown(trades: Trade[], labels: (trade: Trade) => string[]): AnalyticsBreakdownRow[] {
  const groups = new Map<string, Trade[]>()
  for (const trade of trades) {
    for (const label of new Set(labels(trade).filter(Boolean))) {
      groups.set(label, [...(groups.get(label) ?? []), trade])
    }
  }
  return [...groups.entries()]
    .map(([label, records]) => {
      const wins = records.filter((trade) => trade.pnl > 0).length
      const losses = records.filter((trade) => trade.pnl < 0).length
      const pnl = records.reduce((sum, trade) => sum + trade.pnl, 0)
      return { label, records: records.length, pnl, winRate: wins + losses ? (wins / (wins + losses)) * 100 : null, averagePnl: pnl / records.length }
    })
    .sort((a, b) => b.pnl - a.pnl || b.records - a.records || a.label.localeCompare(b.label))
}

export function buildTradeAnalytics(trades: Trade[]) {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const wins = trades.filter((trade) => trade.pnl > 0)
  const losses = trades.filter((trade) => trade.pnl < 0)
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const totalPnl = grossProfit - grossLoss

  const daily = new Map<string, Trade[]>()
  for (const trade of ordered) daily.set(trade.date, [...(daily.get(trade.date) ?? []), trade])
  let cumulativePnl = 0
  const dailySeries: DailyAnalyticsPoint[] = [...daily.entries()].map(([date, records]) => {
    const pnl = records.reduce((sum, trade) => sum + trade.pnl, 0)
    cumulativePnl += pnl
    return { date, pnl, cumulativePnl, records: records.length }
  })

  let lossStreak = 0
  let maxLossStreak = 0
  for (const trade of ordered) {
    if (trade.pnl < 0) {
      lossStreak += 1
      maxLossStreak = Math.max(maxLossStreak, lossStreak)
    } else if (trade.pnl > 0) {
      lossStreak = 0
    }
  }

  const reviewed = trades.filter(hasTradeReview).length
  const withSession = trades.filter((trade) => trade.session).length
  const withSetup = trades.filter((trade) => trade.setupTags?.length).length
  const withProcess = trades.filter((trade) => trade.disciplineTags?.length).length

  return {
    records: trades.length,
    wins: wins.length,
    losses: losses.length,
    flats: trades.length - wins.length - losses.length,
    totalPnl,
    grossProfit,
    grossLoss,
    winRate: wins.length + losses.length ? (wins.length / (wins.length + losses.length)) * 100 : null,
    averageWin: wins.length ? grossProfit / wins.length : null,
    averageLoss: losses.length ? -grossLoss / losses.length : null,
    expectancy: trades.length ? totalPnl / trades.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    maxLossStreak,
    reviewed,
    reviewCoverage: trades.length ? (reviewed / trades.length) * 100 : null,
    metadataCoverage: {
      session: trades.length ? (withSession / trades.length) * 100 : null,
      setup: trades.length ? (withSetup / trades.length) * 100 : null,
      process: trades.length ? (withProcess / trades.length) * 100 : null,
    },
    bestDay: dailySeries.length ? [...dailySeries].sort((a, b) => b.pnl - a.pnl)[0] : null,
    lowestDay: dailySeries.length ? [...dailySeries].sort((a, b) => a.pnl - b.pnl)[0] : null,
    dailySeries,
    bySymbol: breakdown(trades, (trade) => [trade.symbol]),
    bySession: breakdown(trades, (trade) => trade.session ? [trade.session] : []),
    byGrade: breakdown(trades, (trade) => trade.grade ? [trade.grade] : []),
    bySetup: breakdown(trades, (trade) => trade.setupTags ?? []),
    keptProcess: breakdown(trades, (trade) => (trade.disciplineTags ?? []).filter((tag) => (DISCIPLINE_POSITIVE as readonly string[]).includes(tag))),
    processLeaks: breakdown(trades, (trade) => (trade.disciplineTags ?? []).filter((tag) => (DISCIPLINE_NEGATIVE as readonly string[]).includes(tag))),
  }
}

export function filterAnalyticsPeriod(trades: Trade[], days: number | null, asOf: Date = new Date()): Trade[] {
  if (days == null) return trades
  const cutoff = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  cutoff.setDate(cutoff.getDate() - (days - 1))
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`
  return trades.filter((trade) => trade.date >= cutoffKey)
}
