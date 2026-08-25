import { describe, expect, it } from "vitest"
import { buildTodayAccounts } from "./today-dashboard"
import type { Account, Trade } from "./types"

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "account-1",
    name: "Apex 50K",
    firm: "Apex",
    type: "Eval",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 50000,
    balance: 50000,
    startingBalance: 50000,
    maxBalance: 50000,
    maxDrawdown: 2000,
    dailyLossLimit: 1000,
    ...overrides,
  }
}

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    accountId: "account-1",
    date: "2026-08-23",
    symbol: "NQ",
    pnl: -250,
    ...overrides,
  }
}

describe("buildTodayAccounts", () => {
  it("uses resolved rules for daily and total loss room", () => {
    const [row] = buildTodayAccounts([account()], [trade()], [], "2026-08-23")

    expect(row.rulesAvailable).toBe(true)
    expect(row.todayPnl).toBe(-250)
    expect(row.tradeCountToday).toBe(1)
    expect(row.drawdownRemaining).toBe(1750)
    expect(row.dailyRemaining).toBe(750)
  })

  it("uses a manual intraday drawdown snapshot when one exists", () => {
    const [row] = buildTodayAccounts(
      [account({ drawdownType: "Intraday", manualDrawdownRemaining: 420 })],
      [],
      [],
      "2026-08-23",
    )

    expect(row.drawdownRemaining).toBe(420)
    expect(row.drawdownPercent).toBeCloseTo(0.21)
  })

  it("keeps trade P&L but marks rule-derived values unavailable for an invalid account", () => {
    const invalid = account({ firm: "Alpha", alphaTier: null })
    const [row] = buildTodayAccounts([invalid], [trade()], [], "2026-08-23")

    expect(row.todayPnl).toBe(-250)
    expect(row.tradeCountToday).toBe(1)
    expect(row.rulesAvailable).toBe(false)
    expect(row.drawdownRemaining).toBeNull()
    expect(row.drawdownPercent).toBeNull()
    expect(row.payoutMissing).toEqual(["Rule configuration required"])
  })
})
