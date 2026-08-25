import { describe, expect, it } from "vitest"
import { buildComplianceItems, summarizeCompliance } from "./compliance-center"
import type { Account } from "./types"

const account: Account = {
  id: "account-1",
  name: "Unknown tier",
  firm: "Apex",
  type: "PA",
  status: "Active",
  drawdownType: "EOD",
  accountSize: 300000,
  balance: 300000,
  startingBalance: 300000,
  maxBalance: 300000,
  maxDrawdown: 7500,
  dailyLossLimit: 0,
}

describe("compliance center", () => {
  it("fails closed when an account has no verified rule set", () => {
    const items = buildComplianceItems({ accounts: [account], trades: [], payouts: [], instrumentSpecs: [], userRiskProfile: null })
    expect(items.some((entry) => entry.id === "account-1:rules" && entry.kind === "blocker")).toBe(true)
    expect(summarizeCompliance(items).blockers).toBe(1)
  })

  it("prompts for setup without inventing account data", () => {
    const items = buildComplianceItems({ accounts: [], trades: [], payouts: [], instrumentSpecs: [], userRiskProfile: null })
    expect(items.map((entry) => entry.id)).toEqual(["workspace:no-account"])
  })

  it("requires a live floor for intraday accounts", () => {
    const items = buildComplianceItems({
      accounts: [{ ...account, accountSize: 50000, drawdownType: "Intraday" }],
      trades: [], payouts: [], instrumentSpecs: [], userRiskProfile: null,
    })
    expect(items.some((entry) => entry.id === "account-1:live-floor")).toBe(true)
  })
})
