import { getApexPaScalingTier } from "./apex-pa-scaling"
import { applyIntradayManualDrawdownToStats } from "./intraday-manual-drawdown"
import { getAccountRules } from "./rules"
import {
  calculateAccountStats,
  getPayoutEligibility,
  tradesEffectiveForAccount,
} from "./storage"
import type { Account, Payout, Trade } from "./types"

export interface TodayAccount {
  account: Account
  todayPnl: number
  tradeCountToday: number
  drawdownRemaining: number | null
  drawdownPercent: number | null
  dailyRemaining: number | null
  payoutReady: boolean
  payoutMissing: string[]
  breached: boolean
  rulesAvailable: boolean
}

function unavailableRow(account: Account, todayPnl: number, tradeCountToday: number): TodayAccount {
  return {
    account,
    todayPnl,
    tradeCountToday,
    drawdownRemaining: null,
    drawdownPercent: null,
    dailyRemaining: null,
    payoutReady: false,
    payoutMissing: ["Rule configuration required"],
    breached: account.status === "Breached",
    rulesAvailable: false,
  }
}

/**
 * Build the daily command-center rows without letting one invalid account
 * turn unknown risk values into zeros or crash every other account.
 */
export function buildTodayAccounts(
  accounts: Account[],
  trades: Trade[],
  payouts: Payout[],
  today: string,
): TodayAccount[] {
  const rows = accounts.map((account) => {
    const effectiveTrades = tradesEffectiveForAccount(account, trades)
    const todayTrades = effectiveTrades.filter((trade) => trade.date === today)
    const todayPnl = todayTrades
      .reduce((sum, trade) => sum + trade.pnl, 0)

    try {
      const rules = getAccountRules(account)
      const stats = applyIntradayManualDrawdownToStats(
        account,
        calculateAccountStats(account, trades, payouts),
      )
      const apexScaling =
        account.firm === "Apex" && account.type === "PA"
          ? getApexPaScalingTier(account, stats)
          : null
      const dailyLimit = apexScaling?.dailyLossLimit ?? rules.dailyLossLimit
      const eligibility =
        account.type === "PA" && rules.hasPayouts
          ? getPayoutEligibility(account.id, trades, account, payouts)
          : null

      return {
        account,
        todayPnl,
        tradeCountToday: todayTrades.length,
        drawdownRemaining: Math.max(0, stats.drawdownRemaining),
        drawdownPercent:
          rules.maxDrawdown > 0
            ? Math.max(0, stats.drawdownRemaining / rules.maxDrawdown)
            : null,
        dailyRemaining: rules.hasDLL
          ? Math.max(0, dailyLimit + Math.min(0, todayPnl))
          : null,
        payoutReady: eligibility?.isEligible ?? false,
        payoutMissing:
          eligibility?.missingConditions ??
          (account.type === "PA" ? ["Payout tracking unavailable"] : []),
        breached: account.status === "Breached" || !stats.isSafe,
        rulesAvailable: true,
      } satisfies TodayAccount
    } catch {
      return unavailableRow(account, todayPnl, todayTrades.length)
    }
  })

  return rows.sort((a, b) => {
    if (a.breached !== b.breached) return a.breached ? -1 : 1
    if (a.drawdownPercent == null) return b.drawdownPercent == null ? 0 : 1
    if (b.drawdownPercent == null) return -1
    return a.drawdownPercent - b.drawdownPercent
  })
}
