import type { Account, Trade, Payout } from "@/lib/types"
import {
  calculateDailyPnLData,
  getConsistencyInfo,
  getPayoutEligibility,
} from "@/lib/storage"
import { getAccountRules } from "@/lib/rules"
import { parseLocalDate } from "@/lib/date-utils"

export type AccountInsightTone = "neutral" | "positive" | "warning" | "muted"

export interface AccountCardInsight {
  message: string
  tone: AccountInsightTone
}

export interface AccountTenureDisplay {
  daysOwned: number | null
  daysTraded: number
}

export interface AccountInsightContext {
  account: Account
  trades: Trade[]
  payouts: Payout[]
  tradingDays: number
  totalPnL: number
  drawdownRemaining: number
  currentBalance: number
}

function fmtUsd(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Days since account start (inclusive). Falls back to activation dates when createdAt is missing. */
export function getAccountDaysOwned(account: Account): number | null {
  const raw = account.createdAt ?? account.activationStartDate ?? account.activatedAt
  if (!raw) return null

  const start = parseLocalDate(String(raw).slice(0, 10))
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const diffMs = today.getTime() - start.getTime()
  if (diffMs < 0) return 1

  const diffDays = Math.floor(diffMs / 86_400_000)
  return Math.max(1, diffDays + 1)
}

export function getAccountTenure(account: Account, trades: Trade[], tradingDays: number): AccountTenureDisplay {
  return {
    daysOwned: getAccountDaysOwned(account),
    daysTraded: tradingDays,
  }
}

function hasEvalConsistencyRisk(
  account: Account,
  trades: Trade[],
  payouts: Payout[],
  rules: ReturnType<typeof getAccountRules>,
): boolean {
  if (rules.hasConsistency) {
    const info = getConsistencyInfo(account.id, trades, account, payouts)
    return !info.isValid && info.totalProfit > 0
  }

  const dailyData = calculateDailyPnLData(account.id, trades, account, payouts)
  const totalProfit = dailyData.reduce((sum, d) => sum + Math.max(0, d.pnl), 0)
  if (totalProfit <= 0) return false

  const largestWinningDay = Math.max(0, ...dailyData.map((d) => d.pnl))
  return largestWinningDay > totalProfit * 0.5
}

function avgPositiveDayPnl(account: Account, trades: Trade[], payouts: Payout[]): number | null {
  const dailyData = calculateDailyPnLData(account.id, trades, account, payouts)
  const positiveDays = dailyData.filter((d) => d.pnl > 0)
  if (positiveDays.length === 0) return null

  const sum = positiveDays.reduce((s, d) => s + d.pnl, 0)
  return sum / positiveDays.length
}

function buildEvalInsight(ctx: AccountInsightContext): AccountCardInsight {
  const { account, trades, payouts, tradingDays, totalPnL } = ctx
  const rules = getAccountRules(account)
  const effectiveProfitTarget =
    account.profitTarget ?? (rules.hasProfitTarget ? rules.profitTarget : null)

  const evalPassed =
    effectiveProfitTarget != null &&
    (account.status === "Passed" || totalPnL >= effectiveProfitTarget)

  if (tradingDays === 0) {
    return { message: "No trades logged yet", tone: "muted" }
  }

  const remaining =
    effectiveProfitTarget != null ? Math.max(0, effectiveProfitTarget - totalPnL) : 0

  const avgPositive = avgPositiveDayPnl(account, trades, payouts)

  if (
    !evalPassed &&
    effectiveProfitTarget != null &&
    remaining > 0 &&
    avgPositive != null &&
    avgPositive > 0
  ) {
    const estDays = Math.ceil(remaining / avgPositive)
    return {
      message: `Avg $${fmtUsd(avgPositive)}/day — est. ${estDays}d remaining`,
      tone: "neutral",
    }
  }

  if (hasEvalConsistencyRisk(account, trades, payouts, rules)) {
    return {
      message: "Consistency risk — largest day too dominant",
      tone: "warning",
    }
  }

  if (!evalPassed && effectiveProfitTarget != null && remaining > 0 && remaining <= effectiveProfitTarget * 0.15) {
    return {
      message: `Near target — $${fmtUsd(remaining)} remaining`,
      tone: "positive",
    }
  }

  if (!evalPassed && effectiveProfitTarget != null && remaining > 0) {
    return { message: "Building toward target", tone: "neutral" }
  }

  if (evalPassed) {
    return { message: "Profit target met", tone: "positive" }
  }

  return { message: "Building toward target", tone: "neutral" }
}

function buildPaInsight(ctx: AccountInsightContext): AccountCardInsight {
  const { account, trades, payouts, tradingDays, drawdownRemaining } = ctx
  const rules = getAccountRules(account)
  const maxDrawdown = account.maxDrawdown

  if (tradingDays === 0) {
    return { message: "No trades logged yet", tone: "muted" }
  }

  if (!rules.hasPayouts) {
    if (drawdownRemaining < maxDrawdown * 0.18) {
      return {
        message: `Protect buffer — $${fmtUsd(Math.max(0, drawdownRemaining))} remaining`,
        tone: "warning",
      }
    }
    return { message: "Account stable", tone: "neutral" }
  }

  const eligibility = getPayoutEligibility(account.id, trades, account, payouts)

  if (eligibility.isEligible) {
    return { message: "Payout ready", tone: "positive" }
  }

  if (account.firm === "Lucid" && eligibility.firm === "Lucid") {
    const qualifyingRemaining = Math.max(0, rules.minProfitDays - eligibility.cycleProfitDays)
    if (qualifyingRemaining > 0) {
      return {
        message: `${qualifyingRemaining} qualifying day${qualifyingRemaining === 1 ? "" : "s"} to payout`,
        tone: "neutral",
      }
    }

    if (eligibility.conditions.hasEnoughProfitDays && !eligibility.conditions.hasMinWithdrawable) {
      return { message: "Cycle profit below minimum payout", tone: "warning" }
    }
  }

  if (eligibility.firm === "Apex") {
    const qualifyingRemaining = Math.max(
      0,
      rules.minProfitDays - eligibility.consistencyInfo.daysWithMinProfit,
    )

    if (qualifyingRemaining > 0) {
      return {
        message: `${qualifyingRemaining} qualifying day${qualifyingRemaining === 1 ? "" : "s"} to payout`,
        tone: "neutral",
      }
    }

    if (
      eligibility.conditions.hasEnoughProfitDays &&
      !eligibility.conditions.hasMinBalance &&
      rules.minBalanceToRequest > 0
    ) {
      const toThreshold = Math.max(0, rules.minBalanceToRequest - ctx.currentBalance)
      return {
        message: `$${fmtUsd(toThreshold)} to payout threshold`,
        tone: "warning",
      }
    }
  }

  const minPayoutBalanceTarget =
    account.firm === "Apex" && rules.minBalanceToRequest > 0 ? rules.minBalanceToRequest : null

  if (
    minPayoutBalanceTarget != null &&
    ctx.currentBalance < minPayoutBalanceTarget
  ) {
    const toThreshold = Math.max(0, minPayoutBalanceTarget - ctx.currentBalance)
    const apexQualifyingDone =
      eligibility.firm === "Apex" &&
      eligibility.consistencyInfo.daysWithMinProfit >= rules.minProfitDays

    if (apexQualifyingDone || (account.firm === "Lucid" && eligibility.firm === "Lucid" && eligibility.conditions.hasEnoughProfitDays)) {
      return {
        message: `$${fmtUsd(toThreshold)} to payout threshold`,
        tone: "warning",
      }
    }
  }

  if (drawdownRemaining < maxDrawdown * 0.18) {
    return {
      message: `Protect buffer — $${fmtUsd(Math.max(0, drawdownRemaining))} remaining`,
      tone: "warning",
    }
  }

  return { message: "Account stable", tone: "neutral" }
}

export function getAccountCardInsight(ctx: AccountInsightContext): AccountCardInsight {
  const { account, tradingDays } = ctx

  if (account.type === "Eval") {
    return buildEvalInsight(ctx)
  }

  if (account.type === "PA" || account.type === "Live") {
    return buildPaInsight(ctx)
  }

  if (tradingDays === 0) {
    return { message: "No trades logged yet", tone: "muted" }
  }

  return { message: "Account stable", tone: "neutral" }
}
