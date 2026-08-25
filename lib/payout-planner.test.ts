import { describe, expect, it } from "vitest"
import { simulatePayoutImpact } from "./payout-planner"
import type { Account } from "./types"

const account: Account = {
  id: "a1", name: "Apex PA", firm: "Apex", type: "PA", status: "Active", drawdownType: "EOD",
  accountSize: 50000, balance: 50000, startingBalance: 50000, maxBalance: 50000,
  maxDrawdown: 2500, dailyLossLimit: 0,
}

describe("payout impact planner", () => {
  it("refuses to simulate a request before eligibility is complete", () => {
    const result = simulatePayoutImpact(account, [], [], 500, "2026-08-24")
    expect(result.available).toBe(false)
  })

  it("fails closed for unsupported account sizes", () => {
    const result = simulatePayoutImpact({ ...account, accountSize: 300000 }, [], [], 500, "2026-08-24")
    expect(result).toEqual({ available: false, impact: null, reason: "A verified payout scenario is unavailable for this account configuration." })
  })
})
