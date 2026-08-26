import { describe, expect, it } from "vitest"
import { formatAccountLimit, SUBSCRIPTION_PLANS, subscriptionPlan } from "./subscriptions"

describe("subscription plans", () => {
  it("keeps plan limits explicit and ordered", () => {
    expect(SUBSCRIPTION_PLANS.map((plan) => plan.tier)).toEqual(["starter", "pro", "desk"])
    expect(subscriptionPlan("pro")?.accountLimit).toBe(10)
    expect(subscriptionPlan("founding")).toBeNull()
  })

  it("formats unlimited account access without inventing a number", () => {
    expect(formatAccountLimit(null)).toBe("Unlimited")
    expect(formatAccountLimit(2)).toBe("2")
  })
})
