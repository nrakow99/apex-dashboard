import { describe, expect, it } from "vitest"
import { scopeDecisionWorkspace } from "./workspace-scope"
import type { Account, AccountCost, Payout, Trade } from "./types"

function account(id: string, isDemo: boolean): Account {
  return {
    id,
    name: isDemo ? `DEMO · ${id}` : id,
    isDemo,
    firm: "Apex",
    type: "PA",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 50000,
    balance: 50000,
    startingBalance: 50000,
    maxBalance: 50000,
    maxDrawdown: 2500,
    dailyLossLimit: 0,
  }
}

const trade = (id: string, accountId: string): Trade => ({ id, accountId, date: "2026-08-28", symbol: "NQ", pnl: 100 })
const payout = (id: string, accountId: string): Payout => ({ id, accountId, date: "2026-08-28", amount: 500, payoutNumber: 1 })
const cost = (id: string, accountId: string): AccountCost => ({ id, accountId, date: "2026-08-28", category: "evaluation", amount: 50 })

describe("scopeDecisionWorkspace", () => {
  it("uses demo records only when no real account exists", () => {
    const scoped = scopeDecisionWorkspace(
      [account("demo", true)],
      [trade("dt", "demo")],
      [payout("dp", "demo")],
      [cost("dc", "demo")],
    )
    expect(scoped.isDemoMode).toBe(true)
    expect(scoped.accounts.map(({ id }) => id)).toEqual(["demo"])
    expect(scoped.trades).toHaveLength(1)
    expect(scoped.payouts).toHaveLength(1)
    expect(scoped.accountCosts).toHaveLength(1)
  })

  it("excludes every demo record once a real account exists", () => {
    const scoped = scopeDecisionWorkspace(
      [account("demo", true), account("real", false)],
      [trade("dt", "demo"), trade("rt", "real")],
      [payout("dp", "demo"), payout("rp", "real")],
      [cost("dc", "demo"), cost("rc", "real")],
    )
    expect(scoped.isDemoMode).toBe(false)
    expect(scoped.excludedDemoAccounts).toBe(1)
    expect(scoped.accounts.map(({ id }) => id)).toEqual(["real"])
    expect(scoped.trades.map(({ id }) => id)).toEqual(["rt"])
    expect(scoped.payouts.map(({ id }) => id)).toEqual(["rp"])
    expect(scoped.accountCosts.map(({ id }) => id)).toEqual(["rc"])
  })

  it("returns an empty decision workspace when no accounts exist", () => {
    const scoped = scopeDecisionWorkspace([], [trade("orphan", "missing")], [], [])
    expect(scoped.isDemoMode).toBe(false)
    expect(scoped.accounts).toEqual([])
    expect(scoped.trades).toEqual([])
  })
})
