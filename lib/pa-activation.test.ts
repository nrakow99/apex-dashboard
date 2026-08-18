import { describe, it, expect } from "vitest"
import {
  buildEvalToPaConversionUpdates,
  getPaActivationRuleSummary,
} from "./pa-activation"
import type { Account } from "./types"

// Golden-file coverage for Eval → PA activation across all five firms.
//
// buildEvalToPaConversionUpdates and getPaActivationRuleSummary each used to
// hand-build a getAccountRules() input that omitted alphaTier,
// hasDailyLossLimit, and topstepPayoutPath:
//   - Alpha: getAccountRules throws when alphaTier is missing (no safe
//     default across tiers), so clicking "Activate PA" on any Alpha eval
//     crashed the modal outright.
//   - Topstep: hasDailyLossLimit silently defaulted to false and
//     topstepPayoutPath to "standard" regardless of what the trader actually
//     had, so the converted PA account and its rule summary could both be
//     wrong without ever erroring.
// Every firm gets a case here so a future firm addition can't reintroduce
// the same class of bug silently.

function evalAccount(overrides: Partial<Account>): Account {
  return {
    id: "eval-1",
    name: "Eval",
    firm: "Apex",
    type: "Eval",
    status: "Passed",
    drawdownType: "EOD",
    accountSize: 50000,
    balance: 53000,
    startingBalance: 50000,
    maxBalance: 53000,
    maxDrawdown: 2000,
    dailyLossLimit: 0,
    ...overrides,
  }
}

describe("buildEvalToPaConversionUpdates — every firm converts without throwing", () => {
  it("Apex: converts to PA with Apex PA maxDrawdown/DLL", () => {
    const updates = buildEvalToPaConversionUpdates(
      evalAccount({ firm: "Apex", maxDrawdown: 2000, dailyLossLimit: 1000 }),
      "Apex PA",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01",
    )
    expect(updates.type).toBe("PA")
    expect(updates.maxDrawdown).toBeGreaterThan(0)
    expect(updates.program).toBeNull()
  })

  it("Lucid: converts to PA with Lucid Flex PA rules", () => {
    const updates = buildEvalToPaConversionUpdates(
      evalAccount({ firm: "Lucid", maxDrawdown: 2000, dailyLossLimit: 0 }),
      "Lucid PA",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01",
    )
    expect(updates.type).toBe("PA")
    expect(updates.maxDrawdown).toBeGreaterThan(0)
  })

  it("Tradeify: converts to PA and carries the elected program (Flex vs Daily)", () => {
    const updatesFlex = buildEvalToPaConversionUpdates(
      evalAccount({ firm: "Tradeify", program: "select_eval", maxDrawdown: 2500, dailyLossLimit: 0 }),
      "Tradeify Flex PA",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01",
      "select_flex",
    )
    expect(updatesFlex.program).toBe("select_flex")

    const updatesDaily = buildEvalToPaConversionUpdates(
      evalAccount({ firm: "Tradeify", program: "select_eval", maxDrawdown: 2500, dailyLossLimit: 0 }),
      "Tradeify Daily PA",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01",
      "select_daily",
    )
    expect(updatesDaily.program).toBe("select_daily")
    expect(updatesDaily.dailyLossLimit).toBeGreaterThan(0) // Daily has a DLL, Flex doesn't
  })

  it("Topstep: does not silently drop hasDailyLossLimit or the elected payout path", () => {
    const withDll = buildEvalToPaConversionUpdates(
      evalAccount({
        firm: "Topstep",
        maxDrawdown: 2000,
        dailyLossLimit: 1000,
        hasDailyLossLimit: true,
      }),
      "Topstep XFA",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01",
      undefined,
      "consistency",
    )
    expect(withDll.hasDailyLossLimit).toBe(true)
    expect(withDll.topstepPayoutPath).toBe("consistency")
    // DLL was elected, so the converted PA row must carry a real dollar figure, not 0.
    expect(withDll.dailyLossLimit).toBeGreaterThan(0)

    const withoutDll = buildEvalToPaConversionUpdates(
      evalAccount({ firm: "Topstep", maxDrawdown: 2000, dailyLossLimit: 0, hasDailyLossLimit: false }),
      "Topstep XFA",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01",
      undefined,
      "standard",
    )
    expect(withoutDll.hasDailyLossLimit).toBe(false)
    expect(withoutDll.topstepPayoutPath).toBe("standard")
    expect(withoutDll.dailyLossLimit).toBe(0)
  })

  it("Alpha: does not throw for missing-alphaTier-shaped input, because alphaTier is threaded from the eval account", () => {
    for (const alphaTier of ["zero", "standard", "advanced"] as const) {
      const size = alphaTier === "zero" ? 25000 : 50000
      expect(() =>
        buildEvalToPaConversionUpdates(
          evalAccount({ firm: "Alpha", accountSize: size, maxDrawdown: 1000, dailyLossLimit: 0, alphaTier }),
          "Alpha Qualified",
          "2026-08-01T00:00:00.000Z",
          "2026-08-01",
        ),
      ).not.toThrow()

      const updates = buildEvalToPaConversionUpdates(
        evalAccount({ firm: "Alpha", accountSize: size, maxDrawdown: 1000, dailyLossLimit: 0, alphaTier }),
        "Alpha Qualified",
        "2026-08-01T00:00:00.000Z",
        "2026-08-01",
      )
      expect(updates.alphaTier).toBe(alphaTier)
      expect(updates.maxDrawdown).toBeGreaterThan(0)
    }
  })
})

describe("getPaActivationRuleSummary — every firm renders a summary without throwing", () => {
  it("Apex/Lucid render a non-empty summary", () => {
    expect(getPaActivationRuleSummary(evalAccount({ firm: "Apex" })).length).toBeGreaterThan(0)
    expect(getPaActivationRuleSummary(evalAccount({ firm: "Lucid" })).length).toBeGreaterThan(0)
  })

  it("Tradeify Flex vs Daily produce different, program-specific summary lines", () => {
    const flexLines = getPaActivationRuleSummary(evalAccount({ firm: "Tradeify" }), "select_flex")
    const dailyLines = getPaActivationRuleSummary(evalAccount({ firm: "Tradeify" }), "select_daily")
    expect(flexLines.some((l) => l.includes("winning days"))).toBe(true)
    expect(dailyLines.some((l) => l.includes("Daily payout"))).toBe(true)
  })

  it("Topstep: standard vs consistency path produce different summary lines and never throw", () => {
    const standardLines = getPaActivationRuleSummary(evalAccount({ firm: "Topstep" }), undefined, "standard")
    const consistencyLines = getPaActivationRuleSummary(evalAccount({ firm: "Topstep" }), undefined, "consistency")
    expect(standardLines.some((l) => l.includes("Standard path"))).toBe(true)
    expect(consistencyLines.some((l) => l.includes("Consistency path"))).toBe(true)
    expect(consistencyLines.some((l) => l.includes("40%"))).toBe(true)
  })

  it("Alpha: does not throw when alphaTier is present, for every tier, and mentions the consistency rule where it applies", () => {
    for (const alphaTier of ["zero", "standard", "advanced"] as const) {
      const size = alphaTier === "zero" ? 25000 : 50000
      const lines = getPaActivationRuleSummary(
        evalAccount({ firm: "Alpha", accountSize: size, alphaTier }),
      )
      expect(lines.length).toBeGreaterThan(0)
      const mentionsConsistency = lines.some((l) => l.includes("Consistency rule"))
      // Advanced tier has hasConsistency: false — every other tier has it on.
      expect(mentionsConsistency).toBe(alphaTier !== "advanced")
    }
  })

  it("Alpha: throws a catchable error (not a silent wrong answer) when alphaTier is missing", () => {
    const account = evalAccount({ firm: "Alpha", alphaTier: undefined })
    expect(() => getPaActivationRuleSummary(account)).toThrow()
  })
})
