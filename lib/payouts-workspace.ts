import { getAccountRules } from "./rules"
import { getPayoutEligibility, payoutsEffectiveForAccount } from "./storage"
import type { Account, Payout, Trade } from "./types"

export type PayoutEligibility = NonNullable<ReturnType<typeof getPayoutEligibility>>

export interface PayoutWorkspaceRow {
  account: Account
  eligibility: PayoutEligibility | null
  rulesAvailable: boolean
  unavailableReason: string | null
  accountPayouts: Payout[]
  isReady: boolean
  missingConditions: string[]
}

export function buildPayoutWorkspace(accounts: Account[], trades: Trade[], payouts: Payout[]): PayoutWorkspaceRow[] {
  return accounts
    .filter((account) => account.type === "PA")
    .map((account) => {
      const accountPayouts = payoutsEffectiveForAccount(account, payouts)
      try {
        const rules = getAccountRules(account)
        if (!rules.hasPayouts) {
          return { account, eligibility: null, rulesAvailable: false, unavailableReason: "Verified payout rules are not available for this account configuration.", accountPayouts, isReady: false, missingConditions: [] }
        }
        const eligibility = getPayoutEligibility(account.id, trades, account, payouts)
        const active = account.status === "Active"
        return {
          account,
          eligibility,
          rulesAvailable: true,
          unavailableReason: null,
          accountPayouts,
          isReady: active && Boolean(eligibility?.isEligible),
          missingConditions: active ? (eligibility?.missingConditions ?? []) : [`Account status is ${account.status.toLowerCase()}`],
        }
      } catch (error) {
        return {
          account,
          eligibility: null,
          rulesAvailable: false,
          unavailableReason: error instanceof Error ? error.message : "Rules unavailable",
          accountPayouts,
          isReady: false,
          missingConditions: [],
        }
      }
    })
    .sort((a, b) => Number(b.isReady) - Number(a.isReady) || a.account.name.localeCompare(b.account.name))
}

export function summarizePayoutWorkspace(rows: PayoutWorkspaceRow[], allPayouts: Payout[]) {
  const availableRows = rows.filter((row) => row.rulesAvailable && row.eligibility)
  return {
    fundedAccounts: rows.length,
    readyAccounts: rows.filter((row) => row.isReady).length,
    availableGross: availableRows.reduce((sum, row) => sum + (row.eligibility?.maxWithdrawable ?? 0), 0),
    recordedGross: allPayouts.reduce((sum, payout) => sum + payout.amount, 0),
    rulesUnavailable: rows.filter((row) => !row.rulesAvailable).length,
  }
}
