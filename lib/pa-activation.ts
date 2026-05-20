import type { Account, Trade, Payout } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { calculateAccountStats, getConsistencyInfo } from "@/lib/storage"
import { getAccountQuantity, getRuleStartingBalance } from "@/lib/account-quantity"
import { applyIntradayManualDrawdownToStats } from "@/lib/intraday-manual-drawdown"

export type ActivationStats = {
  totalPnL: number
  isSafe: boolean
}

/** Stats used for eval pass / Activate PA eligibility (matches dashboard intraday manual drawdown display). */
export function getEvalActivationStats(
  account: Account,
  trades: Trade[],
  payouts: Payout[],
): ActivationStats {
  const raw = calculateAccountStats(account, trades, payouts)
  const stats = applyIntradayManualDrawdownToStats(account, raw)
  return { totalPnL: stats.totalPnL, isSafe: stats.isSafe }
}

/** Eval is eligible to activate into PA: passed rules, not breached. */
export function isEvalEligibleForPaActivation(
  account: Account,
  stats: ActivationStats,
  trades: Trade[],
  payouts: Payout[],
): boolean {
  if (account.type !== "Eval") return false
  if (account.status === "Breached") return false

  const rules = getAccountRules(account)
  const target =
    account.profitTarget ?? (rules.hasProfitTarget ? rules.profitTarget : undefined)
  if (!target || target <= 0) return false

  let consistencyOk = true
  if (rules.hasConsistency) {
    const ci = getConsistencyInfo(account.id, trades, account, payouts)
    consistencyOk = ci.isValid
  }

  const profitOk = stats.totalPnL >= target
  const safeOk = stats.isSafe
  const markedPassed = account.status === "Passed"

  return markedPassed || (profitOk && safeOk && consistencyOk)
}

export function defaultPaAccountName(account: Account): string {
  const k = account.accountSize >= 1000 ? `${Math.round(account.accountSize / 1000)}K` : String(account.accountSize)
  return `${account.firm} ${k} PA`
}

/**
 * In-place Eval → PA conversion: same row, PA rules, reset balance to size.
 * Eval trades remain stored but are ignored for PA metrics when activation_start_date is set.
 */
export function buildEvalToPaConversionUpdates(
  evalAccount: Account,
  name: string,
  activatedAtIso: string,
  activationStartDate: string,
) {
  const paRules = getAccountRules({
    firm: evalAccount.firm,
    type: "PA",
    drawdownType: evalAccount.drawdownType,
    accountSize: evalAccount.accountSize,
  })
  const size = evalAccount.accountSize
  const quantity = getAccountQuantity(evalAccount)
  return {
    name,
    firm: evalAccount.firm,
    type: "PA" as const,
    status: "Active" as const,
    drawdownType: evalAccount.drawdownType,
    accountSize: size,
    quantity,
    startingBalance: getRuleStartingBalance(evalAccount),
    profitTarget: null as number | null,
    maxDrawdown: paRules.maxDrawdown,
    dailyLossLimit: paRules.hasDLL ? paRules.dailyLossLimit : 0,
    manualIntradayFloor: null as number | null,
    manualDrawdownRemaining: null as number | null,
    manualDrawdownUpdatedAt: null as string | null,
    activatedAt: activatedAtIso,
    activationStartDate,
    previousType: "Eval",
  }
}

/** Short bullet lines for the activation modal (display only). */
export function getPaActivationRuleSummary(evalAccount: Account): string[] {
  const paRules = getAccountRules({
    firm: evalAccount.firm,
    type: "PA",
    drawdownType: evalAccount.drawdownType,
    accountSize: evalAccount.accountSize,
  })
  const lines: string[] = [
    `Max drawdown: $${paRules.maxDrawdown.toLocaleString()}`,
  ]
  if (paRules.hasDLL && paRules.dailyLossLimit > 0) {
    lines.push(`Daily loss limit: $${paRules.dailyLossLimit.toLocaleString()}`)
  }
  if (paRules.hasPayouts) {
    lines.push(`Payouts: ${paRules.maxPayouts} max · $${paRules.minPayoutAmount}+ requests`)
    if (paRules.minBalanceToRequest > 0) {
      lines.push(`Min balance to request: $${paRules.minBalanceToRequest.toLocaleString()}`)
    }
    if (evalAccount.firm === "Lucid") {
      lines.push(
        `Cycle: ${paRules.minProfitDays} × $${paRules.minDailyProfit}+ days · ${Math.round(paRules.payoutMaxPercent * 100)}% / cap $${paRules.payoutAbsoluteCap.toLocaleString()}`,
      )
    }
  }
  if (paRules.maxContracts) lines.push(`Contracts: ${paRules.maxContracts}`)
  return lines
}
