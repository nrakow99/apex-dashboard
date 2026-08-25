import { getAccountRules } from "./rules"
import { calculateAccountStats, getPayoutEligibility, payoutsEffectiveForAccount } from "./storage"
import type { Account, Payout, Trade } from "./types"

export interface PayoutImpact {
  requestAmount: number
  traderReceives: number
  firmReceives: number
  postRequestBalance: number
  postRequestFloor: number
  postRequestDrawdownRemaining: number
  floorLocksOnPayout: boolean
  nextRequirement: string
}

export type PayoutImpactResult =
  | { available: true; impact: PayoutImpact; reason: null }
  | { available: false; impact: null; reason: string }

export function simulatePayoutImpact(
  account: Account,
  trades: Trade[],
  payouts: Payout[],
  requestAmount: number,
  requestDate: string,
): PayoutImpactResult {
  if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
    return { available: false, impact: null, reason: "Enter a positive request amount." }
  }

  try {
    const rules = getAccountRules(account)
    const eligibility = getPayoutEligibility(account.id, trades, account, payouts)
    if (!eligibility?.isEligible) {
      return { available: false, impact: null, reason: "Current verified payout requirements are not complete." }
    }
    if (requestAmount < eligibility.minPayoutAmount) {
      return { available: false, impact: null, reason: `The verified minimum request is $${eligibility.minPayoutAmount.toLocaleString()}.` }
    }
    if (requestAmount > eligibility.maxWithdrawable) {
      return { available: false, impact: null, reason: `The current verified maximum is $${eligibility.maxWithdrawable.toLocaleString()}.` }
    }

    const accountPayouts = payoutsEffectiveForAccount(account, payouts)
    const scenario: Payout = {
      id: "payout-impact-scenario",
      accountId: account.id,
      date: requestDate,
      amount: requestAmount,
      payoutNumber: accountPayouts.length + 1,
      payoutSplitPercent: rules.payoutSplit,
      traderReceived: requestAmount * rules.payoutSplit,
      firmSplit: requestAmount * (1 - rules.payoutSplit),
    }
    const scenarioPayouts = [...payouts, scenario]
    const stats = calculateAccountStats(account, trades, scenarioPayouts)
    const nextEligibility = getPayoutEligibility(account.id, trades, account, scenarioPayouts)

    return {
      available: true,
      reason: null,
      impact: {
        requestAmount,
        traderReceives: requestAmount * rules.payoutSplit,
        firmReceives: requestAmount * (1 - rules.payoutSplit),
        postRequestBalance: stats.currentBalance,
        postRequestFloor: stats.activeEodFloor,
        postRequestDrawdownRemaining: stats.drawdownRemaining,
        floorLocksOnPayout: rules.floorLocksOnPayout,
        nextRequirement: nextEligibility?.isEligible
          ? "Verified requirements remain complete after this scenario."
          : nextEligibility?.missingConditions[0] ?? "Next-cycle payout requirements are unavailable.",
      },
    }
  } catch {
    return { available: false, impact: null, reason: "A verified payout scenario is unavailable for this account configuration." }
  }
}
