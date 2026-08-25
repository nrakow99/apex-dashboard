import { parseLocalDate } from "./date-utils"
import type { Account, Payout } from "./types"

export interface CapitalMetrics {
  grossPayouts: number
  traderProceeds: number | null
  firmShare: number | null
  trackedEvaluations: number
  trackedFundedConversions: number
  trackedConversionRate: number | null
  fundedAccountsWithPayout: number
  averageDaysToFirstPayout: number | null
}

function wholeDaysBetween(start: string, end: string): number | null {
  const from = parseLocalDate(start.slice(0, 10))
  const to = parseLocalDate(end.slice(0, 10))
  const value = Math.floor((to.getTime() - from.getTime()) / 86_400_000)
  return value >= 0 ? value : null
}

export function buildCapitalMetrics(accounts: Account[], payouts: Payout[]): CapitalMetrics {
  const grossPayouts = payouts.reduce((sum, payout) => sum + payout.amount, 0)
  const proceedsKnown = payouts.every((payout) => payout.traderReceived != null)
  const sharesKnown = payouts.every((payout) => payout.firmSplit != null)
  const trackedEvaluations = accounts.filter((account) => account.type === "Eval" || account.previousType === "Eval").length
  const trackedFundedConversions = accounts.filter((account) => account.type === "PA" && account.previousType === "Eval").length
  const fundedAccountIds = new Set(accounts.filter((account) => account.type === "PA").map((account) => account.id))
  const fundedAccountsWithPayout = new Set(payouts.filter((payout) => fundedAccountIds.has(payout.accountId)).map((payout) => payout.accountId)).size

  const firstPayoutDays = accounts.flatMap((account) => {
    if (account.type !== "PA") return []
    const start = account.activationStartDate ?? account.activatedAt ?? account.createdAt
    if (!start) return []
    const first = payouts.filter((payout) => payout.accountId === account.id).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (!first) return []
    const days = wholeDaysBetween(start, first.date)
    return days == null ? [] : [days]
  })

  return {
    grossPayouts,
    traderProceeds: proceedsKnown ? payouts.reduce((sum, payout) => sum + (payout.traderReceived ?? 0), 0) : null,
    firmShare: sharesKnown ? payouts.reduce((sum, payout) => sum + (payout.firmSplit ?? 0), 0) : null,
    trackedEvaluations,
    trackedFundedConversions,
    trackedConversionRate: trackedEvaluations > 0 ? trackedFundedConversions / trackedEvaluations : null,
    fundedAccountsWithPayout,
    averageDaysToFirstPayout: firstPayoutDays.length > 0
      ? firstPayoutDays.reduce((sum, days) => sum + days, 0) / firstPayoutDays.length
      : null,
  }
}
