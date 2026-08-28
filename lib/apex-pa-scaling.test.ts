import { describe, expect, it } from "vitest"
import { getApexPaScalingTier } from "./apex-pa-scaling"
import type { Account } from "./types"

function apexPa(accountSize: number): Account {
  return {
    id: String(accountSize), name: `Apex ${accountSize}`, firm: "Apex", type: "PA",
    status: "Active", drawdownType: "EOD", accountSize, balance: accountSize,
    startingBalance: accountSize, maxBalance: accountSize, maxDrawdown: 0, dailyLossLimit: 0,
  }
}

describe("getApexPaScalingTier", () => {
  it("resolves an exact verified account size", () => {
    expect(getApexPaScalingTier(apexPa(50000), { currentBalance: 51500 }))
      .toMatchObject({ level: 2, dailyLossLimit: 1000, maxContracts: 3 })
  })

  it("refuses to clamp unsupported account sizes", () => {
    expect(getApexPaScalingTier(apexPa(250000), { currentBalance: 260000 })).toBeNull()
  })

  it("does not resolve scaling for non-Apex or evaluation accounts", () => {
    expect(getApexPaScalingTier({ ...apexPa(50000), firm: "Lucid" }, { currentBalance: 51000 })).toBeNull()
    expect(getApexPaScalingTier({ ...apexPa(50000), type: "Eval" }, { currentBalance: 51000 })).toBeNull()
  })
})
