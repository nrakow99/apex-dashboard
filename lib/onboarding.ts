import type { RiskProfile } from "./types"

export interface OnboardingInputs {
  accountCount: number
  tradeCount: number
  fundedAccountCount: number
  riskProfile: RiskProfile | null
  visitedPaths: readonly string[]
}

export interface OnboardingStep {
  id: "account" | "risk" | "history" | "today" | "payouts"
  title: string
  description: string
  href: string
  action: string
  complete: boolean
}

export function buildOnboardingSteps(input: OnboardingInputs): OnboardingStep[] {
  const visited = new Set(input.visitedPaths)
  return [
    {
      id: "account",
      title: "Add a real account",
      description: "Choose the exact firm, program, size, stage, and drawdown type so verified rules resolve correctly.",
      href: "/accounts",
      action: input.accountCount > 0 ? "Review accounts" : "Add account",
      complete: input.accountCount > 0,
    },
    {
      id: "risk",
      title: "Set your default risk",
      description: "A complete risk profile converts remaining drawdown into estimated trades of headroom without guessing.",
      href: "/settings",
      action: input.riskProfile ? "Review risk" : "Set risk",
      complete: input.riskProfile != null,
    },
    {
      id: "history",
      title: "Bring in trade history",
      description: "Log a trade or import reviewed screenshot rows so balances, consistency, and payout cycles reflect reality.",
      href: "/trades",
      action: input.tradeCount > 0 ? "Review history" : "Add history",
      complete: input.tradeCount > 0,
    },
    {
      id: "today",
      title: "Run the daily check",
      description: "Use Today before trading to see the tightest floor, daily room, rule availability, and next payout move.",
      href: "/today",
      action: "Open Today",
      complete: visited.has("/today"),
    },
    {
      id: "payouts",
      title: input.fundedAccountCount > 0 ? "Verify payout readiness" : "Learn the payout workflow",
      description: input.fundedAccountCount > 0
        ? "Confirm every verified requirement before recording or requesting a withdrawal."
        : "See how funded accounts will be prioritized and why unavailable rules always fail closed.",
      href: "/payouts",
      action: "Open Payouts",
      complete: visited.has("/payouts"),
    },
  ]
}

export function onboardingProgress(steps: readonly OnboardingStep[]) {
  const completed = steps.filter((step) => step.complete).length
  return {
    completed,
    total: steps.length,
    percent: steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100),
    isComplete: steps.length > 0 && completed === steps.length,
  }
}
