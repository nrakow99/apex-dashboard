import type { Account, Trade, Payout, DailyPnL } from "./types"
import { EOD_CONSTANTS } from "./types"
import { getAccountRules } from "./rules"

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
  return new Date().toISOString().split("T")[0]
}

// ─── Daily PnL calculation ────────────────────────────────────────────────────

export function calculateDailyPnLData(
  accountId: string,
  trades: Trade[],
  account: Account,
  payouts: Payout[]
): DailyPnL[] {
  const accountTrades = trades.filter((t) => t.accountId === accountId)
  if (accountTrades.length === 0) return []

  const tradesByDate: Record<string, Trade[]> = {}
  for (const trade of accountTrades) {
    if (!tradesByDate[trade.date]) tradesByDate[trade.date] = []
    tradesByDate[trade.date].push(trade)
  }

  const dates = Object.keys(tradesByDate).sort()
  let runningBalance = account.startingBalance

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
  const accountTrades = trades.filter((t) => t.accountId === account.id)
  const accountPayouts = payouts.filter((p) => p.accountId === account.id)

  const totalPnL = accountTrades.reduce((sum, t) => sum + t.pnl, 0)
  const totalPayouts = accountPayouts.reduce((sum, p) => sum + p.amount, 0)

  const currentBalance = account.startingBalance + totalPnL - totalPayouts

  const dailyData = calculateDailyPnLData(account.id, trades, account, payouts)

  const todayStr = getTodayDateStr()
  const dayComplete = isTradingDayComplete()
  const isIntraday = account.drawdownType === "Intraday"

  let highestCompletedEodBalance = account.startingBalance
  let lastCompletedEodBalance = account.startingBalance

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

  const activeEodFloor = peakBalance - account.maxDrawdown
  const projectedHighest = Math.max(highestCompletedEodBalance, currentBalance)
  const projectedEodFloor = projectedHighest - account.maxDrawdown
  const drawdownRemaining = currentBalance - activeEodFloor

  return {
    currentBalance,
    totalPnL,
    totalPayouts,
    maxBalance: Math.max(highestCompletedEodBalance, currentBalance),
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

export function getConsistencyInfo(accountId: string, trades: Trade[], account: Account, payouts: Payout[]) {
  const rules = getAccountRules(account)
  const dailyData = calculateDailyPnLData(accountId, trades, account, payouts)
  const totalProfit = dailyData.reduce((sum, d) => sum + Math.max(0, d.pnl), 0)
  const largestWinningDay = Math.max(0, ...dailyData.map((d) => d.pnl))
  const maxAllowedDay = totalProfit * (rules.consistencyPercent / 100)
  const isValid = totalProfit <= 0 || largestWinningDay <= maxAllowedDay
  const maxAllowedProfitToday = totalProfit > 0 ? maxAllowedDay - largestWinningDay : Infinity
  const requiredTotalProfit = rules.consistencyPercent > 0
    ? largestWinningDay / (rules.consistencyPercent / 100)
    : 0
  const additionalProfitNeeded = Math.max(0, requiredTotalProfit - totalProfit)
  const daysWithMinProfit = dailyData.filter((d) => d.pnl >= rules.minDailyProfit).length

  return {
    largestWinningDay,
    totalProfit,
    maxAllowedDay,
    isValid,
    maxAllowedProfitToday: Math.max(0, maxAllowedProfitToday),
    additionalProfitNeeded,
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
  const accountPayouts = payouts.filter((p) => p.accountId === accountId)
  const lastPayout = accountPayouts.length > 0
    ? accountPayouts.sort((a, b) => a.date.localeCompare(b.date)).at(-1)
    : null
  const cutoffDate = lastPayout?.date ?? null

  const accountTrades = trades.filter(
    (t) => t.accountId === accountId && (cutoffDate === null || t.date > cutoffDate)
  )

  const tradesByDate: Record<string, number> = {}
  for (const t of accountTrades) {
    tradesByDate[t.date] = (tradesByDate[t.date] ?? 0) + t.pnl
  }

  const dailyPnLs = Object.values(tradesByDate)
  const cycleProfit = dailyPnLs.reduce((s, v) => s + v, 0)

  return { cycleProfit, dailyPnLs }
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

  // ── Lucid cycle-based payout ──────────────────────────────────────────────

  if (account.firm === "Lucid") {
    const { cycleProfit, dailyPnLs } = getCycleData(accountId, trades, account, payouts)
    const cycleProfitDays = dailyPnLs.filter((v) => v >= rules.minDailyProfit).length
    const rawPayout = cycleProfit > 0 ? cycleProfit * rules.payoutMaxPercent : 0
    const availablePayout = Math.min(rawPayout, rules.payoutAbsoluteCap)
    const maxWithdrawable = availablePayout >= rules.minPayoutAmount ? availablePayout : 0
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
    if (!conditions.hasMinWithdrawable) missingConditions.push(`Below minimum payout ($${rules.minPayoutAmount})`)
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
    hasEnoughTradingDays: stats.tradingDays >= rules.minTradingDays,
    hasEnoughProfitDays: consistencyInfo.daysWithMinProfit >= rules.minProfitDays,
    isConsistent: !rules.hasConsistency || consistencyInfo.isValid,
    hasMinBalance: stats.currentBalance >= rules.minBalanceToRequest,
    isAboveSafetyNet: stats.currentBalance > rules.safetyNet,
    hasMinWithdrawable: availableToWithdraw >= rules.minPayoutAmount,
    hasPayoutsRemaining: payoutCount < rules.maxPayouts,
  }
  const isEligible = Object.values(conditions).every(Boolean)

  const missingConditions: string[] = []
  if (!conditions.hasEnoughProfitDays) {
    const needed = rules.minProfitDays - consistencyInfo.daysWithMinProfit
    missingConditions.push(`${needed} more $${rules.minDailyProfit}+ profit day${needed > 1 ? "s" : ""}`)
  }
  if (!conditions.isConsistent) {
    missingConditions.push(`$${consistencyInfo.additionalProfitNeeded.toLocaleString()} more profit for consistency`)
  }
  if (!conditions.hasMinBalance) {
    const needed = rules.minBalanceToRequest - stats.currentBalance
    missingConditions.push(`$${needed.toLocaleString()} more to reach minimum balance`)
  }
  if (!conditions.hasMinWithdrawable) {
    missingConditions.push(`Below minimum payout amount ($${rules.minPayoutAmount})`)
  }
  if (!conditions.hasPayoutsRemaining) {
    missingConditions.push(`All ${rules.maxPayouts} payouts have been used`)
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
  return new Date().toISOString().split("T")[0]
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
