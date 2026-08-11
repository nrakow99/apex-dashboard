import type { Account, Trade, Payout, DailyPnL } from "./types"
import { EOD_CONSTANTS } from "./types"
import { getAccountRules, resolveTradeifyProgram } from "./rules"
import { getRuleStartingBalance } from "./account-quantity"
import { lucidFlexActiveFloor } from "./lucid-flex-floor"

/** PA converted from Eval: balance/stats/payouts ignore trades before activation_start_date. */
export function tradesEffectiveForAccount(account: Account, trades: Trade[]): Trade[] {
  const forAcct = trades.filter((t) => t.accountId === account.id)
  if (account.type === "PA" && account.activationStartDate) {
    return forAcct.filter((t) => t.date >= account.activationStartDate)
  }
  return forAcct
}

export function payoutsEffectiveForAccount(account: Account, payouts: Payout[]): Payout[] {
  const forAcct = payouts.filter((p) => p.accountId === account.id)
  if (account.type === "PA" && account.activationStartDate) {
    return forAcct.filter((p) => p.date >= account.activationStartDate)
  }
  return forAcct
}

// ─── EOD Time Utilities ───────────────────────────────────────────────────────

export function isTradingDayComplete(): boolean {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  return h > EOD_CONSTANTS.CLOSE_HOUR || (h === EOD_CONSTANTS.CLOSE_HOUR && m >= EOD_CONSTANTS.CLOSE_MINUTE)
}

export function getTimeUntilClose(): string {
  const now = new Date()
  const close = new Date()
  close.setHours(EOD_CONSTANTS.CLOSE_HOUR, EOD_CONSTANTS.CLOSE_MINUTE, 0, 0)
  if (now >= close) return "Closed"
  const diffMins = Math.floor((close.getTime() - now.getTime()) / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

export function getTodayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Daily PnL calculation ────────────────────────────────────────────────────

export function calculateDailyPnLData(
  accountId: string,
  trades: Trade[],
  account: Account,
  payouts: Payout[]
): DailyPnL[] {
  let accountTrades = trades.filter((t) => t.accountId === accountId)
  if (account.type === "PA" && account.activationStartDate) {
    accountTrades = accountTrades.filter((t) => t.date >= account.activationStartDate)
  }
  if (accountTrades.length === 0) return []

  const tradesByDate: Record<string, Trade[]> = {}
  for (const trade of accountTrades) {
    if (!tradesByDate[trade.date]) tradesByDate[trade.date] = []
    tradesByDate[trade.date].push(trade)
  }

  const dates = Object.keys(tradesByDate).sort()
  let runningBalance = getRuleStartingBalance(account)

  return dates.map((date) => {
    const dayTrades = tradesByDate[date]
    const dailyPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0)
    runningBalance += dailyPnL
    return {
      date,
      accountId,
      pnl: dailyPnL,
      balance: runningBalance,
      tradesCount: dayTrades.length,
    }
  })
}

// ─── Account stats ────────────────────────────────────────────────────────────

export function calculateAccountStats(
  account: Account,
  trades: Trade[],
  payouts: Payout[]
) {
  const accountTrades = tradesEffectiveForAccount(account, trades)
  const accountPayouts = payoutsEffectiveForAccount(account, payouts)

  const totalPnL = accountTrades.reduce((sum, t) => sum + t.pnl, 0)
  const totalPayouts = accountPayouts.reduce((sum, p) => sum + p.amount, 0)

  const startingBalance = getRuleStartingBalance(account)
  const maxDrawdown = account.maxDrawdown
  const currentBalance = startingBalance + totalPnL - totalPayouts

  const dailyData = calculateDailyPnLData(account.id, trades, account, payouts)

  const todayStr = getTodayDateStr()
  const dayComplete = isTradingDayComplete()
  const isIntraday = account.drawdownType === "Intraday"

  let highestCompletedEodBalance = startingBalance
  let lastCompletedEodBalance = startingBalance

  for (const day of dailyData) {
    if (isIntraday) {
      highestCompletedEodBalance = Math.max(highestCompletedEodBalance, day.balance)
      lastCompletedEodBalance = day.balance
    } else {
      const isCompleteDay = day.date !== todayStr || dayComplete
      if (isCompleteDay) {
        lastCompletedEodBalance = day.balance
        highestCompletedEodBalance = Math.max(highestCompletedEodBalance, day.balance)
      }
    }
  }

  const peakBalance = isIntraday
    ? Math.max(highestCompletedEodBalance, currentBalance)
    : highestCompletedEodBalance

  const rules = getAccountRules(account)

  let activeEodFloor = peakBalance - maxDrawdown
  const projectedHighest = Math.max(highestCompletedEodBalance, currentBalance)
  let projectedEodFloor = projectedHighest - maxDrawdown

  if (
    rules.lucidFlexFloor &&
    account.type === "PA" &&
    (account.firm === "Lucid" || account.firm === "Tradeify" || account.firm === "Topstep")
  ) {
    activeEodFloor = lucidFlexActiveFloor(
      peakBalance,
      maxDrawdown,
      rules.lucidFlexFloor,
    )
    projectedEodFloor = lucidFlexActiveFloor(
      projectedHighest,
      maxDrawdown,
      rules.lucidFlexFloor,
    )
  }

  const drawdownRemaining = currentBalance - activeEodFloor

  return {
    currentBalance,
    totalPnL,
    totalPayouts,
    maxBalance: Math.max(highestCompletedEodBalance, currentBalance),
    /** Peak balance used for floor calculation (EOD: completed-day peak; intraday: includes live) */
    floorPeakBalance: peakBalance,
    minBalance: activeEodFloor,
    drawdownRemaining,
    tradingDays: dailyData.filter((d) => d.tradesCount > 0).length,
    isSafe: drawdownRemaining > 0,
    highestCompletedEodBalance,
    lastCompletedEodBalance,
    activeEodFloor,
    projectedEodFloor,
    isTradingDayComplete: dayComplete,
    timeUntilClose: getTimeUntilClose(),
  }
}

// ─── Consistency info ─────────────────────────────────────────────────────────

/** Apex PA (Intraday or EOD): 50% net-profit consistency since last payout. */
export function isApexPaConsistency(account: Account): boolean {
  return account.firm === "Apex" && account.type === "PA"
}

/** @deprecated Use isApexPaConsistency */
export function isApexIntradayPaConsistency(account: Account): boolean {
  return isApexPaConsistency(account)
}

/** LucidFlex Eval: largest day / account profit (net daily PnL) ≤ 50% */
export function isLucidEvalConsistency(account: Account): boolean {
  return account.firm === "Lucid" && account.type === "Eval"
}

export function isTradeifyEvalConsistency(account: Account): boolean {
  return (
    account.firm === "Tradeify" &&
    (resolveTradeifyProgram(account) === "select_eval" || account.type === "Eval")
  )
}

/** Topstep Eval: largest day ≤ 50% of the (fixed) profit target, not of accumulated profit. */
export function isTopstepEvalConsistency(account: Account): boolean {
  return account.firm === "Topstep" && account.type === "Eval"
}

/**
 * Topstep XFA, Consistency payout path only: largest day ≤ 40% of total net
 * profit for the window — total_profit basis, like Apex PA, but unlike Apex
 * PA the window is NOT known to reset at last payout (that behavior is
 * Apex-specific in dailyPnLForConsistencyPeriod). Uses lifetime daily data
 * until confirmed otherwise. The Standard path has no consistency rule.
 */
export function isTopstepXfaConsistency(account: Account): boolean {
  return account.firm === "Topstep" && account.type === "PA" && account.topstepPayoutPath === "consistency"
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function getLastPayoutDate(account: Account, payouts: Payout[]): string | null {
  const accountPayouts = payoutsEffectiveForAccount(
    account,
    payouts.filter((p) => p.accountId === account.id),
  )
  if (accountPayouts.length === 0) return null
  return accountPayouts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1)!.date
}

function dailyPnLForConsistencyPeriod(
  accountId: string,
  trades: Trade[],
  account: Account,
  payouts: Payout[],
): DailyPnL[] {
  const allDaily = calculateDailyPnLData(accountId, trades, account, payouts)
  if (!isApexPaConsistency(account)) return allDaily

  const lastPayoutDate = getLastPayoutDate(account, payouts)
  if (!lastPayoutDate) return allDaily
  return allDaily.filter((d) => d.date > lastPayoutDate)
}

/** Net-profit 50% rule (Apex Intraday PA payout / representative account). */
function computeNetProfitConsistency(
  dailyData: DailyPnL[],
  consistencyPercent: number,
) {
  const totalProfit = roundMoney(dailyData.reduce((sum, d) => sum + d.pnl, 0))
  const largestWinningDay = roundMoney(
    Math.max(0, ...dailyData.map((d) => d.pnl), 0),
  )
  const maxAllowedDay = roundMoney(totalProfit * (consistencyPercent / 100))
  const isValid = totalProfit > 0 && largestWinningDay <= maxAllowedDay
  const requiredTotalProfit =
    consistencyPercent > 0 && largestWinningDay > 0
      ? roundMoney(largestWinningDay / (consistencyPercent / 100))
      : 0
  const additionalProfitNeeded = roundMoney(Math.max(0, requiredTotalProfit - totalProfit))
  const maxAllowedProfitToday =
    totalProfit > 0 ? Math.max(0, roundMoney(maxAllowedDay - largestWinningDay)) : 0

  return {
    largestWinningDay,
    totalProfit,
    maxAllowedDay,
    isValid,
    maxAllowedProfitToday,
    additionalProfitNeeded,
  }
}

/**
 * Fixed-target consistency (Topstep Eval): best day capped at a percent of
 * the account's profit target, not a percent of profit earned so far. The
 * cap does not move as totalProfit accumulates, so "additional profit
 * needed" has no meaning here — an over-cap day stays over-cap regardless
 * of what else the trader earns. Left at 0 rather than a computed guess.
 */
function computeTargetConsistency(
  dailyData: DailyPnL[],
  profitTarget: number,
  consistencyPercent: number,
) {
  const totalProfit = roundMoney(dailyData.reduce((sum, d) => sum + d.pnl, 0))
  const largestWinningDay = roundMoney(
    Math.max(0, ...dailyData.map((d) => d.pnl), 0),
  )
  const maxAllowedDay = roundMoney(profitTarget * (consistencyPercent / 100))
  const isValid = largestWinningDay <= maxAllowedDay
  const maxAllowedProfitToday = Math.max(0, roundMoney(maxAllowedDay - largestWinningDay))
  const additionalProfitNeeded = 0

  return {
    largestWinningDay,
    totalProfit,
    maxAllowedDay,
    isValid,
    maxAllowedProfitToday,
    additionalProfitNeeded,
  }
}

/** Legacy positive-sum consistency (Eval / Apex EOD / Lucid). */
function computePositiveSumConsistency(
  dailyData: DailyPnL[],
  consistencyPercent: number,
) {
  const totalProfit = roundMoney(
    dailyData.reduce((sum, d) => sum + Math.max(0, d.pnl), 0),
  )
  const largestWinningDay = roundMoney(
    Math.max(0, ...dailyData.map((d) => d.pnl), 0),
  )
  const maxAllowedDay = roundMoney(totalProfit * (consistencyPercent / 100))
  const isValid = totalProfit <= 0 || largestWinningDay <= maxAllowedDay
  const requiredTotalProfit =
    consistencyPercent > 0 && largestWinningDay > 0
      ? roundMoney(largestWinningDay / (consistencyPercent / 100))
      : 0
  const additionalProfitNeeded = roundMoney(Math.max(0, requiredTotalProfit - totalProfit))
  const maxAllowedProfitToday =
    totalProfit > 0 ? Math.max(0, roundMoney(maxAllowedDay - largestWinningDay)) : Infinity

  return {
    largestWinningDay,
    totalProfit,
    maxAllowedDay,
    isValid,
    maxAllowedProfitToday,
    additionalProfitNeeded,
  }
}

export function getConsistencyInfo(accountId: string, trades: Trade[], account: Account, payouts: Payout[]) {
  const rules = getAccountRules(account)
  const allDaily = calculateDailyPnLData(accountId, trades, account, payouts)
  const daysWithMinProfit = allDaily.filter((d) => d.pnl >= rules.minDailyProfit).length

  if (!rules.hasConsistency) {
    return {
      largestWinningDay: 0,
      totalProfit: 0,
      maxAllowedDay: 0,
      isValid: true,
      maxAllowedProfitToday: Infinity,
      additionalProfitNeeded: 0,
      daysWithMinProfit,
    }
  }

  const periodDaily = isApexPaConsistency(account)
    ? dailyPnLForConsistencyPeriod(accountId, trades, account, payouts)
    : allDaily

  let metrics: ReturnType<typeof computeNetProfitConsistency>
  if (rules.consistencyBasis === "profit_target") {
    metrics = computeTargetConsistency(allDaily, rules.profitTarget, rules.consistencyPercent)
  } else if (
    isApexPaConsistency(account) ||
    isLucidEvalConsistency(account) ||
    isTradeifyEvalConsistency(account) ||
    isTopstepXfaConsistency(account)
  ) {
    metrics = computeNetProfitConsistency(
      isApexPaConsistency(account) ? periodDaily : allDaily,
      rules.consistencyPercent,
    )
  } else {
    // Unreachable today: every firm with hasConsistency=true matches either
    // the profit_target branch above or one of the three predicates. Kept
    // for a firm that needs "cap vs sum of winning days" — do not delete
    // without checking callers first.
    metrics = computePositiveSumConsistency(allDaily, rules.consistencyPercent)
  }

  return {
    ...metrics,
    daysWithMinProfit,
  }
}

// ─── Payout eligibility ───────────────────────────────────────────────────────

// Returns pnl for each day since last payout (or all days if no payouts)
function getCycleData(
  accountId: string,
  trades: Trade[],
  account: Account,
  payouts: Payout[]
) {
  let accountPayouts = payouts.filter((p) => p.accountId === accountId)
  if (account.type === "PA" && account.activationStartDate) {
    accountPayouts = accountPayouts.filter((p) => p.date >= account.activationStartDate)
  }

  const lastPayout = accountPayouts.length > 0
    ? accountPayouts.sort((a, b) => a.date.localeCompare(b.date)).at(-1)
    : null
  const cutoffDate = lastPayout?.date ?? null

  let accountTrades = trades.filter((t) => t.accountId === accountId)
  if (account.type === "PA" && account.activationStartDate) {
    accountTrades = accountTrades.filter((t) => t.date >= account.activationStartDate)
  }

  accountTrades = accountTrades.filter(
    (t) => cutoffDate === null || t.date > cutoffDate,
  )

  const tradesByDate: Record<string, number> = {}
  for (const t of accountTrades) {
    tradesByDate[t.date] = (tradesByDate[t.date] ?? 0) + t.pnl
  }

  const dailyRows = Object.entries(tradesByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date, pnl }))
  const dailyPnLs = dailyRows.map((d) => d.pnl)
  const cycleProfit = dailyPnLs.reduce((s, v) => s + v, 0)

  return { cycleProfit, dailyPnLs, dailyRows }
}

export function getPayoutEligibility(
  accountId: string,
  trades: Trade[],
  account: Account,
  payouts: Payout[]
) {
  const rules = getAccountRules(account)
  const stats = calculateAccountStats(account, trades, payouts)
  const accountPayouts = payouts.filter((p) => p.accountId === accountId)
  const payoutCount = accountPayouts.length

  // ── Tradeify Select Flex / Daily ──────────────────────────────────────────

  if (account.firm === "Tradeify") {
    const program = resolveTradeifyProgram(account)
    const { cycleProfit, dailyRows } = getCycleData(accountId, trades, account, payouts)
    const startingBalance = getRuleStartingBalance(account)

    if (program === "select_flex") {
      const winningDays = dailyRows.filter((d) => d.pnl >= rules.winningDayThreshold).length
      const totalProfitForCap = Math.max(0, stats.totalPnL)
      const rawPayout = totalProfitForCap * rules.payoutMaxPercent
      const maxWithdrawable = Math.min(Math.max(0, rawPayout), rules.payoutAbsoluteCap)
      const traderReceives = maxWithdrawable * rules.payoutSplit

      const conditions = {
        hasEnoughWinningDays: winningDays >= rules.minProfitDays,
        hasPositiveCycleProfit: cycleProfit > 0,
        hasMinWithdrawable: maxWithdrawable >= rules.minPayoutAmount,
        hasPayoutsRemaining: payoutCount < rules.maxPayouts,
      }
      const isEligible = Object.values(conditions).every(Boolean)

      const missingConditions: string[] = []
      if (!conditions.hasEnoughWinningDays) {
        const needed = rules.minProfitDays - winningDays
        missingConditions.push(
          `${needed} more winning day${needed > 1 ? "s" : ""} ($${rules.winningDayThreshold}+)`,
        )
      }
      if (!conditions.hasPositiveCycleProfit) {
        missingConditions.push("Cycle profit must be positive")
      }
      if (!conditions.hasMinWithdrawable) {
        missingConditions.push("Estimated payout below minimum")
      }

      return {
        isEligible,
        firm: "Tradeify" as const,
        tradeifyProgram: "select_flex" as const,
        conditions,
        missingConditions,
        availableToWithdraw: maxWithdrawable,
        maxWithdrawable,
        payoutCount,
        maxPayouts: rules.maxPayouts,
        cycleProfit,
        cycleProfitDays: winningDays,
        winningDays,
        totalProfitForPayout: totalProfitForCap,
        minProfitDays: rules.minProfitDays,
        minDailyProfit: rules.winningDayThreshold,
        payoutMaxPercent: rules.payoutMaxPercent,
        payoutAbsoluteCap: rules.payoutAbsoluteCap,
        payoutSplit: rules.payoutSplit,
        traderReceives,
        lucidSplit: maxWithdrawable * (1 - rules.payoutSplit),
        minPayoutAmount: rules.minPayoutAmount,
        stats,
        maxPayoutAllowed: maxWithdrawable,
        currentPayoutTier: payoutCount + 1,
        safetyNet: 0,
        consistencyInfo: getConsistencyInfo(accountId, trades, account, payouts),
        bufferAmount: 0,
        aboveBuffer: 0,
        continuityMax: 0,
      }
    }

    if (program === "select_daily") {
      const bufferLine = startingBalance + rules.bufferAmount
      const aboveBuffer = Math.max(0, stats.currentBalance - bufferLine)
      const continuityMax = Math.max(0, cycleProfit * 2)
      const maxWithdrawable = Math.min(
        continuityMax,
        rules.payoutAbsoluteCap,
        aboveBuffer,
      )
      const traderReceives = maxWithdrawable * rules.payoutSplit

      const conditions = {
        hasPositiveCycleProfit: cycleProfit > 0,
        isAboveBuffer: stats.currentBalance > bufferLine,
        hasMinWithdrawable: maxWithdrawable >= rules.minPayoutAmount,
        hasPayoutsRemaining: payoutCount < rules.maxPayouts,
      }
      const isEligible = Object.values(conditions).every(Boolean)

      const missingConditions: string[] = []
      if (!conditions.hasPositiveCycleProfit) {
        missingConditions.push("Cycle profit must be positive")
      }
      if (!conditions.isAboveBuffer) {
        missingConditions.push("Below buffer")
      }
      if (!conditions.hasMinWithdrawable) {
        if (aboveBuffer < rules.minPayoutAmount) {
          const need = rules.minPayoutAmount - maxWithdrawable
          missingConditions.push(
            `Need $${need.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more profit to reach $${rules.minPayoutAmount} minimum payout`,
          )
        } else {
          missingConditions.push("Available above buffer below minimum payout")
        }
      }

      return {
        isEligible,
        firm: "Tradeify" as const,
        tradeifyProgram: "select_daily" as const,
        conditions,
        missingConditions,
        availableToWithdraw: maxWithdrawable,
        maxWithdrawable,
        payoutCount,
        maxPayouts: rules.maxPayouts,
        cycleProfit,
        cycleProfitDays: 0,
        minProfitDays: 0,
        minDailyProfit: 0,
        payoutMaxPercent: 0,
        payoutAbsoluteCap: rules.payoutAbsoluteCap,
        payoutSplit: rules.payoutSplit,
        traderReceives,
        lucidSplit: maxWithdrawable * (1 - rules.payoutSplit),
        minPayoutAmount: rules.minPayoutAmount,
        stats,
        maxPayoutAllowed: maxWithdrawable,
        currentPayoutTier: payoutCount + 1,
        safetyNet: 0,
        consistencyInfo: getConsistencyInfo(accountId, trades, account, payouts),
        bufferAmount: rules.bufferAmount,
        bufferLine,
        aboveBuffer,
        continuityMax,
      }
    }
  }

  // ── Lucid cycle-based payout ──────────────────────────────────────────────

  if (account.firm === "Lucid") {
    const { cycleProfit, dailyPnLs } = getCycleData(accountId, trades, account, payouts)
    const cycleProfitDays = dailyPnLs.filter((v) => v >= rules.minDailyProfit).length
    const rawPayout = Math.max(0, cycleProfit) * rules.payoutMaxPercent
    const hasPayoutCap = rules.payoutAbsoluteCap > 0
    const availablePayout = hasPayoutCap
      ? Math.min(rawPayout, rules.payoutAbsoluteCap)
      : rawPayout
    const maxWithdrawable =
      availablePayout >= rules.minPayoutAmount ? availablePayout : 0
    const traderReceives = maxWithdrawable * rules.payoutSplit
    const lucidSplit = maxWithdrawable * (1 - rules.payoutSplit)

    const conditions = {
      hasEnoughProfitDays: cycleProfitDays >= rules.minProfitDays,
      hasPositiveCycleProfit: cycleProfit > 0,
      hasMinWithdrawable: maxWithdrawable >= rules.minPayoutAmount,
      hasPayoutsRemaining: payoutCount < rules.maxPayouts,
    }
    const isEligible = Object.values(conditions).every(Boolean)

    const missingConditions: string[] = []
    if (!conditions.hasEnoughProfitDays) {
      const needed = rules.minProfitDays - cycleProfitDays
      missingConditions.push(`${needed} more $${rules.minDailyProfit}+ profit day${needed > 1 ? "s" : ""} this cycle`)
    }
    if (!conditions.hasPositiveCycleProfit) missingConditions.push("Cycle profit must be positive")
    if (!conditions.hasMinWithdrawable) {
      missingConditions.push(
        hasPayoutCap
          ? `Below minimum payout ($${rules.minPayoutAmount})`
          : "Cycle profit too low for minimum payout",
      )
    }
    if (!conditions.hasPayoutsRemaining) missingConditions.push(`All ${rules.maxPayouts} payouts used`)

    return {
      isEligible,
      firm: "Lucid" as const,
      conditions,
      missingConditions,
      availableToWithdraw: maxWithdrawable,
      maxWithdrawable,
      payoutCount,
      maxPayouts: rules.maxPayouts,
      cycleProfit,
      cycleProfitDays,
      lucidPayoutCapKnown: hasPayoutCap,
      minProfitDays: rules.minProfitDays,
      minDailyProfit: rules.minDailyProfit,
      payoutMaxPercent: rules.payoutMaxPercent,
      payoutAbsoluteCap: rules.payoutAbsoluteCap,
      payoutSplit: rules.payoutSplit,
      traderReceives,
      lucidSplit,
      minPayoutAmount: rules.minPayoutAmount,
      stats,
      // Apex compat fields (unused for Lucid)
      maxPayoutAllowed: maxWithdrawable,
      currentPayoutTier: payoutCount + 1,
      safetyNet: 0,
      consistencyInfo: getConsistencyInfo(accountId, trades, account, payouts),
    }
  }

  // ── Apex safety-net payout ────────────────────────────────────────────────

  const consistencyInfo = getConsistencyInfo(accountId, trades, account, payouts)
  const availableToWithdraw = Math.max(0, stats.currentBalance - rules.safetyNet)
  const currentPayoutTier = Math.min(payoutCount, rules.maxPayouts - 1)
  const maxPayoutAllowed = rules.payoutCaps[currentPayoutTier] ?? rules.payoutCaps.at(-1) ?? 0
  const maxWithdrawable = Math.min(availableToWithdraw, maxPayoutAllowed)

  const conditions = {
    hasEnoughProfitDays: consistencyInfo.daysWithMinProfit >= rules.minProfitDays,
    isConsistent: !rules.hasConsistency || consistencyInfo.isValid,
    hasMinBalance: stats.currentBalance >= rules.minBalanceToRequest,
    isAboveSafetyNet: stats.currentBalance > rules.safetyNet,
    hasMinWithdrawable: maxWithdrawable >= rules.minPayoutAmount,
    hasPayoutsRemaining: payoutCount < rules.maxPayouts,
  }
  const isEligible = Object.values(conditions).every(Boolean)

  const missingConditions: string[] = []
  if (!conditions.hasEnoughProfitDays) {
    const needed = rules.minProfitDays - consistencyInfo.daysWithMinProfit
    missingConditions.push(`${needed} more $${rules.minDailyProfit}+ qualifying day${needed > 1 ? "s" : ""}`)
  }
  if (!conditions.isConsistent) {
    if (isApexPaConsistency(account)) {
      if (consistencyInfo.totalProfit <= 0) {
        missingConditions.push("No net profits since last payout")
      } else {
        missingConditions.push("Largest day exceeds 50% of total profit")
      }
    } else if (consistencyInfo.additionalProfitNeeded > 0) {
      missingConditions.push(
        `$${consistencyInfo.additionalProfitNeeded.toLocaleString()} more profit for consistency`,
      )
    } else {
      missingConditions.push("Consistency rule not met")
    }
  }
  if (!conditions.hasMinBalance) {
    const needed = rules.minBalanceToRequest - stats.currentBalance
    missingConditions.push(`$${needed.toLocaleString()} more to reach minimum balance`)
  }
  if (!conditions.hasMinWithdrawable) {
    missingConditions.push(`Below minimum payout amount ($${rules.minPayoutAmount})`)
  }
  if (!conditions.hasPayoutsRemaining) {
    missingConditions.push("Maximum payouts reached")
  }

  return {
    isEligible,
    firm: "Apex" as const,
    conditions,
    missingConditions,
    availableToWithdraw,
    maxWithdrawable,
    payoutCount,
    maxPayouts: rules.maxPayouts,
    maxPayoutAllowed,
    currentPayoutTier: currentPayoutTier + 1,
    safetyNet: rules.safetyNet,
    consistencyInfo,
    stats,
    // Lucid compat fields (unused for Apex)
    cycleProfit: 0,
    cycleProfitDays: 0,
    minProfitDays: rules.minProfitDays,
    minDailyProfit: rules.minDailyProfit,
    payoutMaxPercent: 0,
    payoutAbsoluteCap: 0,
    payoutSplit: 1.0,
    traderReceives: maxWithdrawable,
    lucidSplit: 0,
    minPayoutAmount: rules.minPayoutAmount,
  }
}

// ─── Initial seed data ────────────────────────────────────────────────────────

function getTodayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const INITIAL_ACCOUNTS: Account[] = [
  {
    id: "apex-50k-eval",
    name: "Apex 50K Eval",
    firm: "Apex",
    type: "Eval",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 50000,
    balance: 50000,
    startingBalance: 50000,
    maxBalance: 50000,
    profitTarget: 3000,
    maxDrawdown: 2000,
    dailyLossLimit: 1000,
  },
  {
    id: "apex-50k-pa",
    name: "Apex 50K PA",
    firm: "Apex",
    type: "PA",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 50000,
    balance: 50670,
    startingBalance: 50000,
    maxBalance: 50670,
    maxDrawdown: 2000,
    dailyLossLimit: 1000,
  },
]

// localStorage fallback (used only outside Supabase context)
const STORAGE_KEYS = {
  accounts: "apex-tracker-accounts",
  trades: "apex-tracker-trades",
  payouts: "apex-tracker-payouts",
} as const

export function loadAccounts(): Account[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts) ?? "[]") } catch { return [] }
}
export function saveAccounts(accounts: Account[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts))
}
export function loadTrades(): Trade[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.trades) ?? "[]") } catch { return [] }
}
export function saveTrades(trades: Trade[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.trades, JSON.stringify(trades))
}
export function loadPayouts(): Payout[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.payouts) ?? "[]") } catch { return [] }
}
export function savePayouts(payouts: Payout[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.payouts, JSON.stringify(payouts))
}

export function initializeStorage(): { accounts: Account[]; trades: Trade[]; payouts: Payout[] } {
  if (typeof window === "undefined") return { accounts: [], trades: [], payouts: [] }
  let accounts = loadAccounts()
  let trades = loadTrades()
  let payouts = loadPayouts()
  if (accounts.length === 0) {
    accounts = INITIAL_ACCOUNTS
    saveAccounts(accounts)
    trades = [{ id: "trade-1", date: getTodayDate(), accountId: "apex-50k-pa", symbol: "NQM6", pnl: 670 }]
    saveTrades(trades)
    payouts = []
    savePayouts(payouts)
  }
  return { accounts, trades, payouts }
}
