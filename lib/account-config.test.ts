import { describe, expect, it } from "vitest"
import {
  assertSupportedAccountConfiguration,
  inferLegacyTradeifyProgram,
  initialTradeifyProgram,
  supportedAccountSizes,
} from "./account-config"
import type { Firm } from "./types"

describe("account configuration metadata", () => {
  it("uses one exact size source for firm and Alpha-tier options", () => {
    expect(supportedAccountSizes("Apex")).toEqual([25000, 50000, 100000, 150000])
    expect(supportedAccountSizes("Topstep")).toEqual([50000, 100000, 150000])
    expect(supportedAccountSizes("Alpha", "zero")).toEqual([25000, 50000, 100000])
    expect(supportedAccountSizes("Alpha", "standard")).toEqual([50000, 100000, 150000])
  })

  it("rejects every unverified Live firm", () => {
    for (const firm of ["Apex", "Lucid", "Tradeify", "Topstep", "Alpha"] as Firm[]) {
      expect(() => assertSupportedAccountConfiguration({
        firm,
        type: "Live",
        accountSize: 50000,
        program: firm === "Tradeify" ? "select_flex" : undefined,
        alphaTier: firm === "Alpha" ? "standard" : undefined,
      })).toThrow(/do not have a verified rule configuration/)
    }
  })

  it("rejects mismatched Tradeify stages and programs", () => {
    expect(() => assertSupportedAccountConfiguration({ firm: "Tradeify", type: "Eval", accountSize: 50000, program: "select_flex" })).toThrow()
    expect(() => assertSupportedAccountConfiguration({ firm: "Tradeify", type: "PA", accountSize: 50000, program: "select_eval" })).toThrow()
    expect(() => assertSupportedAccountConfiguration({ firm: "Tradeify", type: "PA", accountSize: 50000, program: "select_daily" })).not.toThrow()
  })

  it("keeps legacy Tradeify Live unsupported instead of inferring a funded program", () => {
    expect(inferLegacyTradeifyProgram({ type: "Live", dailyLossLimit: 1000 })).toBeNull()
    expect(initialTradeifyProgram({ type: "Live", program: "select_flex", dailyLossLimit: 1000 })).toBeNull()
  })

  it("infers a legacy Tradeify Daily PA narrowly from its positive stored DLL", () => {
    expect(initialTradeifyProgram({ type: "PA", dailyLossLimit: 1000 })).toBe("select_daily")
    expect(initialTradeifyProgram({ type: "PA", dailyLossLimit: 0 })).toBe("select_flex")
    expect(initialTradeifyProgram({ type: "Eval", dailyLossLimit: 1000 })).toBe("select_eval")
  })
})
