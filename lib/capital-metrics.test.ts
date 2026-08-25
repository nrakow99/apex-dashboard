import { describe, expect, it } from "vitest"
import { buildCapitalMetrics } from "./capital-metrics"
import type { Account, AccountCost, Payout } from "./types"

const funded: Account = {
  id: "pa", name: "Funded", firm: "Apex", type: "PA", previousType: "Eval", status: "Active", drawdownType: "EOD",
  accountSize: 50000, balance: 50000, startingBalance: 50000, maxBalance: 50000, maxDrawdown: 2500, dailyLossLimit: 0,
  activationStartDate: "2026-08-01",
}

describe("capital metrics", () => {
  it("calculates only fully known payout proceeds", () => {
    const payouts: Payout[] = [{ id: "p1", accountId: "pa", date: "2026-08-11", amount: 1000, payoutNumber: 1, traderReceived: 900, firmSplit: 100 }]
    const result = buildCapitalMetrics([funded], payouts)
    expect(result.traderProceeds).toBe(900)
    expect(result.trackedConversionRate).toBe(1)
    expect(result.averageDaysToFirstPayout).toBe(10)
  })

  it("withholds partial net proceeds", () => {
    const payouts: Payout[] = [
      { id: "p1", accountId: "pa", date: "2026-08-11", amount: 1000, payoutNumber: 1, traderReceived: 900, firmSplit: 100 },
      { id: "p2", accountId: "pa", date: "2026-08-20", amount: 500, payoutNumber: 2 },
    ]
    expect(buildCapitalMetrics([funded], payouts).traderProceeds).toBeNull()
  })

  it("calculates tracked net proceeds and return only when cost data is available", () => {
    const payouts: Payout[] = [{ id: "p1", accountId: "pa", date: "2026-08-11", amount: 1000, payoutNumber: 1, traderReceived: 900, firmSplit: 100 }]
    const costs: AccountCost[] = [{ id: "c1", accountId: "pa", date: "2026-07-20", category: "evaluation", amount: 100 }]
    const result = buildCapitalMetrics([funded], payouts, costs)
    expect(result.trackedCosts).toBe(100)
    expect(result.trackedNetProceeds).toBe(800)
    expect(result.returnOnCosts).toBe(8)
    expect(buildCapitalMetrics([funded], payouts).trackedCosts).toBeNull()
  })
})
