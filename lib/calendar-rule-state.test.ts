import { describe, expect, it } from "vitest"
import { buildCalendarRuleState } from "./calendar-rule-state"
import type { Account, DailyPnL } from "./types"

const account = (overrides: Partial<Account> = {}): Account => ({
  id: "a", name: "Account", firm: "Tradeify", type: "Eval", status: "Active",
  drawdownType: "EOD", accountSize: 50000, balance: 50000, startingBalance: 50000,
  maxBalance: 50000, maxDrawdown: 2000, dailyLossLimit: 0, program: "select_eval", ...overrides,
})
const day = (date: string, pnl: number): DailyPnL => ({ date, pnl, tradesCount: 1, accountId: "a", balance: 50000 + pnl })

describe("calendar rule state", () => {
  it("derives consistency warnings from resolved rules", () => {
    const state = buildCalendarRuleState(account(), [day("2026-08-01", 1000), day("2026-08-02", 2000)])
    expect([...state.consistencyWarnDates]).toEqual(["2026-08-01", "2026-08-02"])
  })

  it("derives funded qualifying-day presentation without TSX thresholds", () => {
    const state = buildCalendarRuleState(account({ type: "PA", program: "select_flex" }), [])
    expect(state.showQualifyingStars).toBe(true)
    expect(state.minQualifyingProfit).toBe(state.rules.winningDayThreshold)
  })
})
