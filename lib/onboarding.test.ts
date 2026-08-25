import { describe, expect, it } from "vitest"
import { buildOnboardingSteps, onboardingProgress } from "./onboarding"

describe("onboarding", () => {
  it("keeps setup incomplete until real workspace requirements are met", () => {
    const steps = buildOnboardingSteps({
      accountCount: 0,
      tradeCount: 0,
      fundedAccountCount: 0,
      riskProfile: null,
      visitedPaths: [],
    })
    expect(onboardingProgress(steps)).toEqual({ completed: 0, total: 5, percent: 0, isComplete: false })
  })

  it("tracks data-backed and visited workflow steps separately", () => {
    const steps = buildOnboardingSteps({
      accountCount: 1,
      tradeCount: 4,
      fundedAccountCount: 1,
      riskProfile: { symbol: "NQ", contracts: 1, riskStopTicks: 20 },
      visitedPaths: ["/today", "/payouts"],
    })
    expect(onboardingProgress(steps).isComplete).toBe(true)
    expect(steps.find((step) => step.id === "payouts")?.title).toBe("Verify payout readiness")
  })
})
