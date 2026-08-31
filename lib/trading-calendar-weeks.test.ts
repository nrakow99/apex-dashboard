import { describe, expect, it } from "vitest"
import type { DailyPnL } from "@/lib/types"
import { buildTradingCalendarWeeks } from "@/lib/trading-calendar-weeks"

function day(date: string, pnl: number, tradesCount = 1): DailyPnL {
  return { date, pnl, tradesCount, accountId: "account-1", balance: 50_000 + pnl }
}

describe("buildTradingCalendarWeeks", () => {
  it("builds Sunday-to-Saturday rows and totals each displayed week", () => {
    const weeks = buildTradingCalendarWeeks(2026, 7, [
      day("2026-08-04", 200, 2),
      day("2026-08-07", -50, 1),
      day("2026-08-09", 75, 1),
    ])

    expect(weeks).toHaveLength(6)
    expect(weeks[0].days.map((cell) => cell.day)).toEqual([null, null, null, null, null, null, 1])
    expect(weeks[1]).toMatchObject({ pnl: 150, tradeCount: 3, activeDays: 2 })
    expect(weeks[2]).toMatchObject({ pnl: 75, tradeCount: 1, activeDays: 1 })
  })

  it("marks a week without recorded trades as unavailable rather than zero", () => {
    const weeks = buildTradingCalendarWeeks(2026, 7, [])

    expect(weeks[0]).toMatchObject({ pnl: null, tradeCount: 0, activeDays: 0 })
  })

  it("shows a real zero when saved trading days net to zero", () => {
    const weeks = buildTradingCalendarWeeks(2026, 7, [
      day("2026-08-04", 125),
      day("2026-08-05", -125),
    ])

    expect(weeks[1]).toMatchObject({ pnl: 0, tradeCount: 2, activeDays: 2 })
  })

  it("excludes daily data outside the displayed month", () => {
    const weeks = buildTradingCalendarWeeks(2026, 7, [
      day("2026-07-31", 900),
      day("2026-08-01", 100),
      day("2026-09-01", 800),
    ])

    expect(weeks[0].pnl).toBe(100)
    expect(weeks.at(-1)?.pnl).toBeNull()
  })
})
