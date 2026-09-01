import type { Account, Trade, Payout, TradeifyProgram, TopstepPayoutPath } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { defaultTradeifyAccountName } from "@/lib/tradeify-rules"
import { calculateAccountStats, getConsistencyInfo } from "@/lib/storage"
import { getAccountQuantity, getRuleStartingBalance } from "@/lib/account-quantity"
import { applyIntradayManualDrawdownToStats } from "@/lib/intraday-manual-drawdown"

export type ActivationStats = {
  totalPnL: number
  isSafe: boolean
}

export function formatWinningDayPayoutRule(rules: {
  minProfitDays: number
  winningDayThreshold: number
  payoutMaxPercent: number
  payoutAbsoluteCap: number
}, basis: string): string {
  return `${rules.minProfitDays} winning days ($${rules.winningDayThreshold}+) · up to ${Math.round(rules.payoutMaxPercent * 100)}% of ${basis} (cap $${rules.payoutAbsoluteCap.toLocaleString()})`
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
  const target = rules.hasProfitTarget ? rules.profitTarget : undefined
  if (!target || target <= 0) return false

  let consistencyOk = true
  if (rules.hasConsistency) {
    const ci = getConsistencyInfo(account.id, trades, account, payouts)
    consistencyOk = ci.isValid
  }

  const fullStats = calculateAccountStats(account, trades, payouts)
  const daysOk =
    rules.minTradingDays <= 0 || fullStats.tradingDays >= rules.minTradingDays

  const profitOk = stats.totalPnL >= target
  const safeOk = stats.isSafe
  const markedPassed = account.status === "Passed"

  return markedPassed || (profitOk && safeOk && consistencyOk && daysOk)
}

export function defaultPaAccountName(
  account: Account,
  tradeifyProgram?: "select_flex" | "select_daily",
): string {
  if (account.firm === "Tradeify" && tradeifyProgram) {
    return defaultTradeifyAccountName(account.accountSize, tradeifyProgram)
  }
  const k = account.accountSize >= 1000 ? `${Math.round(account.accountSize / 1000)}K` : String(account.accountSize)
  return `${account.firm} ${k} PA`
}

/**
 * Single place that builds the PA-stage getAccountRules() input for
 * activation. Both buildEvalToPaConversionUpdates and
 * getPaActivationRuleSummary used to construct this by hand, each omitting
 * alphaTier/hasDailyLossLimit/topstepPayoutPath — Alpha activation threw
 * (getAccountRules requires alphaTier, no safe default exists) and Topstep
 * activation silently computed a DLL-less, standard-path summary regardless
 * of what the trader actually had. Not hand-building this a third time.
 */
function paActivationRulesInput(
  evalAccount: Account,
  tradeifyProgram?: "select_flex" | "select_daily",
  topstepPayoutPath?: TopstepPayoutPath,
) {
  const program: TradeifyProgram | undefined =
    evalAccount.firm === "Tradeify"
      ? tradeifyProgram ?? "select_flex"
      : undefined

  return {
    firm: evalAccount.firm,
    type: "PA" as const,
    drawdownType: evalAccount.drawdownType,
    accountSize: evalAccount.accountSize,
    program,
    // alphaTier and hasDailyLossLimit are elected at Eval creation and carry
    // forward unchanged. topstepPayoutPath is a funded-stage-only decision
    // (add-account-modal only asks for it once type === "PA"), so it comes
    // from the activation step itself, not the eval account.
    alphaTier: evalAccount.alphaTier ?? undefined,
    hasDailyLossLimit: evalAccount.hasDailyLossLimit ?? undefined,
    topstepPayoutPath: topstepPayoutPath ?? evalAccount.topstepPayoutPath ?? undefined,
  }
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
  tradeifyProgram?: "select_flex" | "select_daily",
  topstepPayoutPath?: TopstepPayoutPath,
) {
  const rulesInput = paActivationRulesInput(evalAccount, tradeifyProgram, topstepPayoutPath)
  const paRules = getAccountRules(rulesInput)
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
    program: rulesInput.program ?? null,
    // Carried forward explicitly rather than omitted — see
    // paActivationRulesInput's comment for why each one is sourced where it is.
    alphaTier: evalAccount.alphaTier ?? null,
    hasDailyLossLimit: evalAccount.hasDailyLossLimit ?? false,
    topstepPayoutPath: rulesInput.topstepPayoutPath ?? null,
  }
}

/** Short bullet lines for the activation modal (display only). */
export function getPaActivationRuleSummary(
  evalAccount: Account,
  tradeifyProgram?: "select_flex" | "select_daily",
  topstepPayoutPath?: TopstepPayoutPath,
  resolveRules: typeof getAccountRules = getAccountRules,
): string[] {
  const rulesInput = paActivationRulesInput(evalAccount, tradeifyProgram, topstepPayoutPath)
  const program = rulesInput.program
  const paRules = resolveRules(rulesInput)
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
    if (evalAccount.firm === "Tradeify" && program === "select_flex") {
      lines.push(formatWinningDayPayoutRule(paRules, "total profit"))
      lines.push("No minimum balance to request payout")
    }
    if (evalAccount.firm === "Tradeify" && program === "select_daily") {
      lines.push(
        `Daily payout · buffer $${paRules.bufferAmount.toLocaleString()} · cap $${paRules.payoutAbsoluteCap.toLocaleString()}`,
      )
      lines.push(`Daily loss limit: $${paRules.dailyLossLimit.toLocaleString()}`)
    }
    if (evalAccount.firm === "Topstep" && rulesInput.topstepPayoutPath === "consistency") {
      lines.push(
        `Consistency path: ${paRules.minTradingDays} trading days · ${paRules.consistencyPercent}% consistency rule · up to ${Math.round(paRules.payoutMaxPercent * 100)}% of balance (cap $${paRules.payoutAbsoluteCap.toLocaleString()})`,
      )
    }
    if (evalAccount.firm === "Topstep" && rulesInput.topstepPayoutPath !== "consistency") {
      lines.push(`Standard path: ${formatWinningDayPayoutRule(paRules, "balance")}`)
    }
    if (evalAccount.firm === "Alpha") {
      lines.push(
        `${paRules.minProfitDays} winning days ($${paRules.minDailyProfit}+) · up to ${Math.round(paRules.payoutMaxPercent * 100)}% of cycle profit (cap $${paRules.payoutAbsoluteCap.toLocaleString()})`,
      )
      if (paRules.hasConsistency) {
        lines.push(`Consistency rule: ${paRules.consistencyPercent}%`)
      }
      if (paRules.maxPayoutsPerMonth > 0) {
        lines.push(`Up to ${paRules.maxPayoutsPerMonth} payout requests per calendar month`)
      }
    }
  }
  if (paRules.maxContracts) lines.push(`Contracts: ${paRules.maxContracts}`)
  return lines
}
