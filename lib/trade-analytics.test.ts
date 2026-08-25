import { describe, expect, it } from "vitest"
import { buildTradeAnalytics, filterAnalyticsPeriod } from "./trade-analytics"
import type { Trade } from "./types"

const trades: Trade[] = [
  { id: "1", accountId: "a", date: "2026-08-01", symbol: "NQ", pnl: 300, session: "ny_am", setupTags: ["FVG"], disciplineTags: ["Followed Plan"] },
  { id: "2", accountId: "a", date: "2026-08-01", symbol: "ES", pnl: -100, session: "ny_am", disciplineTags: ["Forced Entry"] },
  { id: "3", accountId: "a", date: "2026-08-03", symbol: "NQ", pnl: -50, setupTags: ["FVG"] },
]

describe("trade analytics", () => {
  it("computes factual performance metrics and daily cumulative P&L", () => {
    const result = buildTradeAnalytics(trades)
    expect(result.totalPnl).toBe(150)
    expect(result.winRate).toBeCloseTo(33.333)
    expect(result.averageWin).toBe(300)
    expect(result.averageLoss).toBe(-75)
    expect(result.profitFactor).toBe(2)
    expect(result.dailySeries).toEqual([
      { date: "2026-08-01", pnl: 200, cumulativePnl: 200, records: 2 },
      { date: "2026-08-03", pnl: -50, cumulativePnl: 150, records: 1 },
    ])
  })

  it("reports unavailable rates instead of fake zeros when data is absent", () => {
    const result = buildTradeAnalytics([])
    expect(result.winRate).toBeNull()
    expect(result.profitFactor).toBeNull()
    expect(result.expectancy).toBeNull()
    expect(result.bestDay).toBeNull()
  })

  it("builds multi-label setup and process breakdowns from tagged records", () => {
    const result = buildTradeAnalytics(trades)
    expect(result.bySetup[0]).toMatchObject({ label: "FVG", records: 2, pnl: 250 })
    expect(result.keptProcess[0]).toMatchObject({ label: "Followed Plan", records: 1, pnl: 300 })
    expect(result.processLeaks[0]).toMatchObject({ label: "Forced Entry", records: 1, pnl: -100 })
  })

  it("filters calendar periods inclusively without touching source data", () => {
    expect(filterAnalyticsPeriod(trades, 3, new Date(2026, 7, 3))).toHaveLength(3)
    expect(filterAnalyticsPeriod(trades, 2, new Date(2026, 7, 3)).map((trade) => trade.id)).toEqual(["3"])
    expect(filterAnalyticsPeriod(trades, null)).toBe(trades)
  })
})
