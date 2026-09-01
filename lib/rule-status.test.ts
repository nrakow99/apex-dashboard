import { describe, expect, it } from "vitest"
import { deriveRuleStatus } from "./rule-status"

describe("deriveRuleStatus", () => {
  it("derives daily and drawdown status outside React", () => {
    expect(deriveRuleStatus({ hasDailyLossLimit: true, dailyLossLimit: 1000, todayPnl: -1100, maxDrawdown: 2000, drawdownRemaining: 200 })).toMatchObject({
      dailyLossRemaining: -100,
      dailyLossStatus: "danger",
      drawdownPercent: 10,
      drawdownStatus: "danger",
    })
  })

  it("keeps exact DLL and drawdown boundaries deterministic", () => {
    expect(deriveRuleStatus({ hasDailyLossLimit: true, dailyLossLimit: 1000, todayPnl: -1000, maxDrawdown: 2000, drawdownRemaining: 0 })).toMatchObject({
      dailyLossRemaining: 0,
      dailyLossStatus: "warning",
      drawdownPercent: 0,
      drawdownStatus: "danger",
    })
  })

  it("treats a zero DLL as legitimate when no DLL applies", () => {
    expect(deriveRuleStatus({ hasDailyLossLimit: false, dailyLossLimit: 0, todayPnl: -500, maxDrawdown: 2000, drawdownRemaining: 2000 })).toMatchObject({
      dailyLossRemaining: -500,
      dailyLossStatus: "good",
    })
  })
})
