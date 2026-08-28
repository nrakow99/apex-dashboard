import type { Account, AccountCost, Payout, Trade } from "@/lib/types"

export interface DecisionWorkspace {
  accounts: Account[]
  trades: Trade[]
  payouts: Payout[]
  accountCosts: AccountCost[]
  isDemoMode: boolean
  excludedDemoAccounts: number
}

/**
 * Keeps product-tour records useful without ever blending them into a real
 * trader's decisions. Demo records are used only while no real account exists.
 */
export function scopeDecisionWorkspace(
  accounts: readonly Account[],
  trades: readonly Trade[],
  payouts: readonly Payout[],
  accountCosts: readonly AccountCost[] = [],
): DecisionWorkspace {
  const realAccounts = accounts.filter((account) => !account.isDemo)
  const demoAccounts = accounts.filter((account) => account.isDemo)
  const isDemoMode = realAccounts.length === 0 && demoAccounts.length > 0
  const scopedAccounts = isDemoMode ? demoAccounts : realAccounts
  const accountIds = new Set(scopedAccounts.map((account) => account.id))

  return {
    accounts: scopedAccounts,
    trades: trades.filter((trade) => accountIds.has(trade.accountId)),
    payouts: payouts.filter((payout) => accountIds.has(payout.accountId)),
    accountCosts: accountCosts.filter((cost) => accountIds.has(cost.accountId)),
    isDemoMode,
    excludedDemoAccounts: isDemoMode ? 0 : demoAccounts.length,
  }
}
