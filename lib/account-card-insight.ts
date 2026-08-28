import type { Account, Trade, Payout } from "@/lib/types"
import {
  calculateDailyPnLData,
  getConsistencyInfo,
  getPayoutEligibility,
} from "@/lib/storage"
import { getAccountRules, resolveTradeifyProgram } from "@/lib/rules"
import { parseLocalDate } from "@/lib/date-utils"
import { DISPLAY_THRESHOLDS } from "@/lib/display-thresholds"
import { AT_RISK_DRAWDOWN_FRACTION } from "@/lib/accounts-overview"

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

  return false
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
  const effectiveProfitTarget = rules.hasProfitTarget ? rules.profitTarget : null

  const consistencyInfo = rules.hasConsistency
    ? getConsistencyInfo(account.id, trades, account, payouts)
    : null
  const consistencyOk = !consistencyInfo || consistencyInfo.isValid
  const profitTargetMet =
    effectiveProfitTarget != null && totalPnL >= effectiveProfitTarget
  const evalPassed =
    profitTargetMet &&
    consistencyOk &&
    (account.status === "Passed" || profitTargetMet)

  if (tradingDays === 0) {
    return { message: "No trades logged yet", tone: "muted" }
  }

  if (account.firm === "Tradeify" && rules.minTradingDays > 0 && tradingDays < rules.minTradingDays) {
    const need = rules.minTradingDays - tradingDays
    return {
      message: `${need} trading day${need > 1 ? "s" : ""} required`,
      tone: "neutral",
    }
  }

  if (
    (account.firm === "Lucid" || account.firm === "Tradeify") &&
    rules.hasConsistency &&
    consistencyInfo
  ) {
    if (!consistencyOk && consistencyInfo.totalProfit > 0) {
      if (consistencyInfo.additionalProfitNeeded > 0) {
        return {
          message: `Need $${fmtUsd(consistencyInfo.additionalProfitNeeded, 2)} to restore consistency`,
          tone: "warning",
        }
      }
      return { message: "Consistency rule not met", tone: "warning" }
    }
    if (consistencyOk && consistencyInfo.totalProfit > 0) {
      return { message: "Consistency in check", tone: "positive" }
    }
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

  if (!evalPassed && effectiveProfitTarget != null && remaining > 0 && remaining <= effectiveProfitTarget * DISPLAY_THRESHOLDS.nearProfitTargetFraction) {
    return {
      message: `Near target — $${fmtUsd(remaining)} remaining`,
      tone: "positive",
    }
  }

  if (!evalPassed && effectiveProfitTarget != null && remaining > 0) {
    if (profitTargetMet && !consistencyOk) {
      return { message: "Consistency rule not met", tone: "warning" }
    }
    return {
      message:
        account.firm === "Lucid" || account.firm === "Tradeify"
          ? `$${fmtUsd(remaining)} to target`
          : "Building toward target",
      tone: "neutral",
    }
  }

  if (evalPassed && consistencyOk) {
    return { message: "Profit target met", tone: "positive" }
  }

  return { message: "Building toward target", tone: "neutral" }
}

function getQualifyingDaysRemaining(
  eligibility: ReturnType<typeof getPayoutEligibility>,
  rules: ReturnType<typeof getAccountRules>,
): number {
  if (eligibility.firm === "Lucid") {
    return Math.max(0, rules.minProfitDays - eligibility.cycleProfitDays)
  }
  if (eligibility.firm === "Tradeify" && eligibility.tradeifyProgram === "select_flex") {
    return Math.max(0, rules.minProfitDays - (eligibility.winningDays ?? 0))
  }
  if (eligibility.firm === "Topstep" || eligibility.firm === "Alpha") {
    return Math.max(0, (eligibility.minProfitDays ?? 0) - (eligibility.cycleProfitDays ?? 0))
  }
  return Math.max(0, rules.minProfitDays - (eligibility.consistencyInfo?.daysWithMinProfit ?? 0))
}

function buildPaInsight(ctx: AccountInsightContext): AccountCardInsight {
  const { account, trades, payouts, tradingDays, drawdownRemaining } = ctx
  const rules = getAccountRules(account)
  const maxDrawdown = rules.maxDrawdown

  if (tradingDays === 0) {
    return { message: "No trades logged yet", tone: "muted" }
  }

  if (!rules.hasPayouts) {
    if (drawdownRemaining < maxDrawdown * AT_RISK_DRAWDOWN_FRACTION) {
      return { message: "Protect buffer · drawdown near limit", tone: "warning" }
    }
    return { message: "Account stable", tone: "neutral" }
  }

  const eligibility = getPayoutEligibility(account.id, trades, account, payouts)

  if (eligibility.isEligible) {
    return { message: "Payout ready", tone: "positive" }
  }

  const qualifyingRemaining = getQualifyingDaysRemaining(eligibility, rules)
  if (qualifyingRemaining > 0) {
    const program = resolveTradeifyProgram(account)
    if (account.firm === "Tradeify" && program === "select_flex") {
      return {
        message: `${qualifyingRemaining} winning day${qualifyingRemaining === 1 ? "" : "s"} to payout`,
        tone: "neutral",
      }
    }
    return {
      message:
        account.firm === "Lucid"
          ? `${qualifyingRemaining} payout day${qualifyingRemaining === 1 ? "" : "s"} remaining`
          : account.firm === "Apex"
            ? `${qualifyingRemaining} payout day${qualifyingRemaining === 1 ? "" : "s"} remaining`
            : `${qualifyingRemaining} qualifying day${qualifyingRemaining === 1 ? "" : "s"} to payout`,
      tone: "neutral",
    }
  }

  if (account.firm === "Lucid" && rules.hasPayouts && qualifyingRemaining === 0) {
    return { message: "No minimum balance required", tone: "neutral" }
  }

  if (account.firm === "Tradeify" && rules.hasPayouts) {
    const program = resolveTradeifyProgram(account)
    if (program === "select_flex" && qualifyingRemaining === 0) {
      return { message: "No minimum balance required", tone: "neutral" }
    }
  }

  // Qualifying days met — surface next blocker without repeating card metrics
  if (eligibility.firm === "Apex") {
    if (rules.hasConsistency && !eligibility.conditions?.isConsistent) {
      return { message: "Consistency rule not met", tone: "warning" }
    }
    if (rules.minBalanceToRequest > 0 && !eligibility.conditions?.hasMinBalance) {
      return {
        message: "Payout days complete · Balance threshold next",
        tone: "warning",
      }
    }
  }

  if (eligibility.firm === "Lucid") {
    if (!eligibility.conditions?.hasPositiveCycleProfit) {
      return {
        message: "Qualifying days complete · Positive cycle profit next",
        tone: "warning",
      }
    }
    if (!eligibility.conditions?.hasMinWithdrawable) {
      return {
        message: "Qualifying days complete · Grow cycle profit",
        tone: "warning",
      }
    }
  }

  if (eligibility.firm === "Tradeify") {
    const program = resolveTradeifyProgram(account)
    if (program === "select_flex") {
      if (!eligibility.conditions?.hasPositiveCycleProfit) {
        return { message: "Cycle profit must recover", tone: "warning" }
      }
      if ((eligibility.cycleProfit ?? 0) > 0 && qualifyingRemaining === 0) {
        return { message: "Cycle profit positive", tone: "positive" }
      }
      if (qualifyingRemaining > 0) {
        return {
          message: `${qualifyingRemaining} winning day${qualifyingRemaining === 1 ? "" : "s"} to payout`,
          tone: "neutral",
        }
      }
      return { message: "No minimum balance required", tone: "neutral" }
    }
    if (program === "select_daily") {
      if (
        eligibility.conditions &&
        "isAboveBuffer" in eligibility.conditions &&
        !eligibility.conditions.isAboveBuffer
      ) {
        return { message: "Below buffer", tone: "warning" }
      }
      if (!eligibility.conditions?.hasPositiveCycleProfit) {
        return { message: "Cycle profit must recover", tone: "warning" }
      }
      if (eligibility.maxWithdrawable < rules.minPayoutAmount) {
        const need = Math.ceil(rules.minPayoutAmount - eligibility.maxWithdrawable)
        return {
          message: `$${need} to daily payout minimum`,
          tone: "neutral",
        }
      }
      if (eligibility.aboveBuffer != null && eligibility.aboveBuffer > 0) {
        return {
          message: `$${fmtUsd(eligibility.aboveBuffer)} above buffer`,
          tone: "positive",
        }
      }
      if (rules.hasDLL && drawdownRemaining < maxDrawdown * DISPLAY_THRESHOLDS.drawdownWarningRemainingFraction) {
        return { message: "Protect DLL", tone: "warning" }
      }
    }
  }

  if (drawdownRemaining < maxDrawdown * AT_RISK_DRAWDOWN_FRACTION) {
    return { message: "Protect buffer · drawdown near limit", tone: "warning" }
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
