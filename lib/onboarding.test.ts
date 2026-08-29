import { describe, expect, it } from "vitest"
import { activationProgress, activationStage, goalResultLabel, type ActivationState } from "./onboarding"

const state = (updates: Partial<ActivationState> = {}): ActivationState => ({
  started: false,
  dismissed: false,
  activated: false,
  goal: null,
  historyChoice: null,
  visitedPaths: [],
  ...updates,
})

describe("activation onboarding", () => {
  it("begins by showing value before asking for setup", () => {
    expect(activationStage(state(), { realAccountCount: 0, realTradeCount: 0 })).toBe("value")
  })

  it("asks for one useful goal before account effort", () => {
    expect(activationStage(state({ started: true }), { realAccountCount: 0, realTradeCount: 0 })).toBe("goal")
    expect(activationStage(state({ started: true, goal: "reach-payout" }), { realAccountCount: 0, realTradeCount: 0 })).toBe("account")
  })

  it("accepts imported history, a logged trade, or an explicit start-now choice", () => {
    const base = state({ started: true, goal: "manage-multiple" })
    expect(activationStage(base, { realAccountCount: 1, realTradeCount: 0 })).toBe("history")
    expect(activationStage(base, { realAccountCount: 1, realTradeCount: 1 })).toBe("result")
    expect(activationStage({ ...base, historyChoice: "start-now" }, { realAccountCount: 1, realTradeCount: 0 })).toBe("result")
  })

  it("ends with a meaningful personalized result", () => {
    expect(goalResultLabel("protect-funded")).toBe("Account protection")
    expect(activationProgress("result")).toEqual({ current: 4, total: 4, percent: 100 })
    expect(activationStage(state({ activated: true }), { realAccountCount: 0, realTradeCount: 0 })).toBe("complete")
  })
})
