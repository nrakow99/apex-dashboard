import { describe, expect, it } from "vitest"
import { buildDataHealth } from "./data-health"
import type { Account, Payout, Trade } from "./types"

const account: Account = {
  id: "a1", name: "Account", firm: "Lucid", type: "Eval", status: "Active", drawdownType: "EOD",
  accountSize: 50000, balance: 50000, startingBalance: 50000, maxBalance: 50000, maxDrawdown: 2000, dailyLossLimit: 0,
}

describe("data health", () => {
  it("flags duplicate candidates and orphaned records", () => {
    const trade: Trade = { id: "t1", accountId: "a1", date: "2026-08-24", symbol: "NQ", pnl: 100 }
    const payouts: Payout[] = [{ id: "p1", accountId: "missing", date: "2026-08-24", amount: 500, payoutNumber: 1 }]
    const report = buildDataHealth([account], [trade, { ...trade, id: "t2" }], payouts)
    expect(report.possibleDuplicateGroups).toBe(1)
    expect(report.possibleDuplicateRecords).toBe(2)
    expect(report.orphanedPayouts).toBe(1)
  })

  it("counts unsupported rule configurations", () => {
    expect(buildDataHealth([{ ...account, accountSize: 300000 }], [], []).unsupportedRuleAccounts).toBe(1)
  })
})
