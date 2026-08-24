import type { Account, Payout, Trade } from "@/lib/types"
import {
  calculateAccountStats,
  getPayoutEligibility,
  tradesEffectiveForAccount,
} from "@/lib/storage"
import { applyIntradayManualDrawdownToStats } from "@/lib/intraday-manual-drawdown"
import { getAccountQuantity } from "@/lib/account-quantity"
import { getAccountDaysOwned } from "@/lib/account-card-insight"
import { localTodayKey } from "@/lib/date-utils"
import { getAccountRules } from "@/lib/rules"

/** Same cutoff as the account-card "At Risk" badge. */
export const AT_RISK_DRAWDOWN_FRACTION = 0.18

export interface AccountsOverview {
  /** Sum of remaining floor buffer across live accounts (× quantity). */
  roomToday: number
  /** Live accounts sitting inside the At Risk drawdown band (× quantity). */
  atRisk: number
  /** Funded accounts that currently pass getPayoutEligibility (× quantity). */
  payoutReady: number
  /** Live accounts with no result logged today (× quantity). */
  needsUpdate: number
}

export function isAccountBreached(account: Pick<Account, "status">, isSafe: boolean): boolean {
  return account.status === "Breached" || !isSafe
}

export function lastEffectiveTradeDate(account: Account, trades: Trade[]): string | null {
  const effective = tradesEffectiveForAccount(account, trades)
  let latest: string | null = null
  for (const t of effective) {
    if (!latest || t.date > latest) latest = t.date
  }
  return latest
}

export function getAccountsOverview(
  accounts: Account[],
  trades: Trade[],
  payouts: Payout[],
): AccountsOverview {
  let roomToday = 0
  let atRisk = 0
  let payoutReady = 0
  let needsUpdate = 0

  for (const account of accounts) {
    const rules = getAccountRules(account)
    const qty = getAccountQuantity(account)
    const stats = applyIntradayManualDrawdownToStats(
      account,
      calculateAccountStats(account, trades, payouts),
    )
    const breached = isAccountBreached(account, stats.isSafe)

    if (breached) continue

    roomToday += Math.max(0, stats.drawdownRemaining) * qty

    if (
      rules.maxDrawdown > 0 &&
      stats.drawdownRemaining < rules.maxDrawdown * AT_RISK_DRAWDOWN_FRACTION
    ) {
      atRisk += qty
    }

    const daysOwned = getAccountDaysOwned(account)
    if (
      daysOwned != null &&
      daysOwned > 1 &&
      lastEffectiveTradeDate(account, trades) !== localTodayKey()
    ) {
      needsUpdate += qty
    }

    if (account.type === "PA") {
      const eligibility = getPayoutEligibility(account.id, trades, account, payouts)
      if (eligibility.isEligible) payoutReady += qty
    }
  }

  return { roomToday, atRisk, payoutReady, needsUpdate }
}
