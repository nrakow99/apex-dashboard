export type SubscriptionTier = "starter" | "pro" | "desk" | "founding"
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "beta"

export interface SubscriptionEntitlement {
  tier: SubscriptionTier
  status: SubscriptionStatus
  accountLimit: number | null
  screenshotMonthlyLimit: number
  currentPeriodEnd: string | null
}

export interface SubscriptionPlan {
  tier: Exclude<SubscriptionTier, "founding">
  name: string
  priceMonthly: number
  description: string
  accountLimit: number | null
  screenshotMonthlyLimit: number
  highlighted: boolean
  features: string[]
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    tier: "starter",
    name: "Starter",
    priceMonthly: 0,
    description: "Prove the workflow on one small account set.",
    accountLimit: 2,
    screenshotMonthlyLimit: 3,
    highlighted: false,
    features: [
      "Today command center",
      "Verified rule and payout tracking",
      "Manual and CSV trade history",
      "Edge intelligence across 2 accounts",
      "3 screenshot images per month",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    priceMonthly: 29,
    description: "Cross-firm intelligence for active funded traders.",
    accountLimit: 10,
    screenshotMonthlyLimit: 60,
    highlighted: true,
    features: [
      "Everything in Starter",
      "Edge intelligence across 10 accounts",
      "10-account capital routing",
      "Payout planning and compliance queue",
      "60 screenshot images per month",
    ],
  },
  {
    tier: "desk",
    name: "Desk",
    priceMonthly: 69,
    description: "A serious operating system for multi-account traders.",
    accountLimit: null,
    screenshotMonthlyLimit: 250,
    highlighted: false,
    features: [
      "Everything in Pro",
      "Unlimited tracked accounts",
      "High-volume screenshot importing",
      "Portfolio-wide concentration monitoring",
      "Priority support and data exports",
    ],
  },
] as const

export function subscriptionPlan(tier: SubscriptionTier): SubscriptionPlan | null {
  if (tier === "founding") return null
  return SUBSCRIPTION_PLANS.find((plan) => plan.tier === tier) ?? null
}

export function formatAccountLimit(limit: number | null): string {
  return limit == null ? "Unlimited" : String(limit)
}
