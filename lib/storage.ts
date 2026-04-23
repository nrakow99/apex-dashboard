import type { Account, Trade, Payout, DailyPnL, DrawdownInfo } from "./types"
import { PA_CONSTANTS, EOD_CONSTANTS } from "./types"

const STORAGE_KEYS = {
  accounts: "apex-tracker-accounts",
  trades: "apex-tracker-trades",
  payouts: "apex-tracker-payouts",
} as const

// Storage utilities
export function loadAccounts(): Account[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.accounts)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveAccounts(accounts: Account[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts))
}

export function loadTrades(): Trade[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.trades)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveTrades(trades: Trade[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.trades, JSON.stringify(trades))
}

export function loadPayouts(): Payout[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.payouts)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function savePayouts(payouts: Payout[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.payouts, JSON.stringify(payouts))
}

// EOD Time Utilities
export function isTradingDayComplete(): boolean {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  return hours > EOD_CONSTANTS.CLOSE_HOUR || 
    (hours === EOD_CONSTANTS.CLOSE_HOUR && minutes >= EOD_CONSTANTS.CLOSE_MINUTE)
}

export function getTimeUntilClose(): string {
  const now = new Date()
  const closeTime = new Date()
  closeTime.setHours(EOD_CONSTANTS.CLOSE_HOUR, EOD_CONSTANTS.CLOSE_MINUTE, 0, 0)
  
  if (now >= closeTime) {
    return "Closed"
  }
  
  const diffMs = closeTime.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export function getTodayDateStr(): string {
  return new Date().toISOString().split("T")[0]
}

// Check if a date is today
function isToday(dateStr: string): boolean {
  return dateStr === getTodayDateStr()
}

// Calculation utilities
export function calculateDailyPnLData(
  accountId: string,
  trades: Trade[],
  account: Account,
  payouts: Payout[]
): DailyPnL[] {
  const accountTrades = trades.filter((t) => t.accountId === accountId)
  if (accountTrades.length === 0) return []

  // Group trades by date
  const tradesByDate: Record<string, Trade[]> = {}
  for (const trade of accountTrades) {
    if (!tradesByDate[trade.date]) {
      tradesByDate[trade.date] = []
    }
    tradesByDate[trade.date].push(trade)
  }

  // Get all unique dates sorted
  const dates = Object.keys(tradesByDate).sort()

  // Calculate running balance (payouts reduce balance but not maxBalance)
  const accountPayouts = payouts.filter((p) => p.accountId === accountId)
  const totalPayouts = accountPayouts.reduce((sum, p) => sum + p.amount, 0)
  const baseBalance = account.startingBalance

  let runningBalance = baseBalance
  const dailyData: DailyPnL[] = []

  for (const date of dates) {
    const dayTrades = tradesByDate[date]
    const dailyPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0)
    runningBalance += dailyPnL
    
    dailyData.push({
      date,
      accountId,
      pnl: dailyPnL,
      balance: runningBalance,
      tradesCount: dayTrades.length,
    })
  }

  return dailyData
}

export function calculateAccountStats(
  account: Account,
  trades: Trade[],
  payouts: Payout[]
) {
  const accountTrades = trades.filter((t) => t.accountId === account.id)
  const accountPayouts = payouts.filter((p) => p.accountId === account.id)
  
  const totalPnL = accountTrades.reduce((sum, t) => sum + t.pnl, 0)
  const totalPayouts = accountPayouts.reduce((sum, p) => sum + p.amount, 0)
  
  // Current balance = starting + pnl - payouts
  const currentBalance = account.startingBalance + totalPnL - totalPayouts
  
  // Get daily data for EOD calculations
  const dailyData = calculateDailyPnLData(account.id, trades, account, payouts)
  
  // Find today's date and check if trading day is complete
  const todayStr = getTodayDateStr()
  const dayComplete = isTradingDayComplete()
  
  // Calculate highest COMPLETED EOD balance
  // Only include days that are fully complete (not today unless after 2PM)
  let highestCompletedEodBalance = account.startingBalance
  let lastCompletedEodBalance = account.startingBalance
  
  for (const day of dailyData) {
    const isCompleteDay = day.date !== todayStr || dayComplete
    if (isCompleteDay) {
      lastCompletedEodBalance = day.balance
      highestCompletedEodBalance = Math.max(highestCompletedEodBalance, day.balance)
    }
  }
  
  // Active EOD Floor = highest completed EOD - drawdown limit
  // This is the OFFICIAL floor that doesn't change until 2PM
  const activeEodFloor = highestCompletedEodBalance - account.maxDrawdown
  
  // Projected EOD Floor = if today closed now, what would the floor be?
  const projectedHighest = Math.max(highestCompletedEodBalance, currentBalance)
  const projectedEodFloor = projectedHighest - account.maxDrawdown
  
  // Drawdown remaining is based on ACTIVE floor (not projected)
  const drawdownRemaining = currentBalance - activeEodFloor
  
  // For backwards compatibility, also include the old-style values
  // maxBalance = highest ever (including incomplete day) for display purposes
  const maxBalance = Math.max(highestCompletedEodBalance, currentBalance)
  const minBalance = activeEodFloor // Use active floor as the official minimum

  return {
    currentBalance,
    totalPnL,
    totalPayouts,
    maxBalance,
    minBalance,
    drawdownRemaining,
    tradingDays: dailyData.filter((d) => d.tradesCount > 0).length,
    isSafe: drawdownRemaining > 0,
    // New EOD-specific fields
    highestCompletedEodBalance,
    lastCompletedEodBalance,
    activeEodFloor,
    projectedEodFloor,
    isTradingDayComplete: dayComplete,
    timeUntilClose: getTimeUntilClose(),
  }
}

export function getConsistencyInfo(accountId: string, trades: Trade[], account: Account, payouts: Payout[]) {
  const dailyData = calculateDailyPnLData(accountId, trades, account, payouts)
  const totalProfit = dailyData.reduce((sum, d) => sum + Math.max(0, d.pnl), 0)
  const largestWinningDay = Math.max(0, ...dailyData.map((d) => d.pnl))
  const maxAllowedDay = totalProfit * 0.5
  const isValid = totalProfit <= 0 || largestWinningDay <= maxAllowedDay
  const maxAllowedProfitToday = totalProfit > 0 ? maxAllowedDay - largestWinningDay : Infinity
  
  // Calculate additional profit needed to satisfy consistency
  // requiredTotalProfit = largestWinningDay / 0.5 = largestWinningDay * 2
  // additionalProfitNeeded = requiredTotalProfit - totalProfit
  const requiredTotalProfit = largestWinningDay * 2
  const additionalProfitNeeded = Math.max(0, requiredTotalProfit - totalProfit)
  
  // Count days with $250+ profit for PA requirement
  const daysWithMinProfit = dailyData.filter((d) => d.pnl >= 250).length
  
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

// Get payout eligibility for PA account
export function getPayoutEligibility(
  accountId: string,
  trades: Trade[],
  account: Account,
  payouts: Payout[]
) {
  const consistencyInfo = getConsistencyInfo(accountId, trades, account, payouts)
  const stats = calculateAccountStats(account, trades, payouts)
  const accountPayouts = payouts.filter((p) => p.accountId === accountId)
  const payoutCount = accountPayouts.length
  
  // Calculate available to withdraw (balance - safety net)
  const availableToWithdraw = Math.max(0, stats.currentBalance - PA_CONSTANTS.SAFETY_NET)
  
  // Get current payout tier (which payout is next)
  const currentPayoutTier = Math.min(payoutCount, 5) // 0-5 index
  const maxPayoutAllowed = PA_CONSTANTS.PAYOUT_TIERS[currentPayoutTier] || PA_CONSTANTS.PAYOUT_TIERS[5]
  
  // Actual max you can withdraw (min of available and tier max)
  const maxWithdrawable = Math.min(availableToWithdraw, maxPayoutAllowed)
  
  // Check all conditions
  const conditions = {
    hasEnoughTradingDays: stats.tradingDays >= PA_CONSTANTS.MIN_QUALIFYING_DAYS,
    hasEnoughProfitDays: consistencyInfo.daysWithMinProfit >= PA_CONSTANTS.MIN_QUALIFYING_DAYS,
    isConsistent: consistencyInfo.isValid,
    hasMinBalance: stats.currentBalance >= PA_CONSTANTS.MIN_BALANCE_FOR_PAYOUT,
    isAboveSafetyNet: stats.currentBalance > PA_CONSTANTS.SAFETY_NET,
    hasMinWithdrawable: availableToWithdraw >= PA_CONSTANTS.MIN_PAYOUT_AMOUNT,
    hasPayoutsRemaining: payoutCount < 6,
  }
  
  const isEligible = Object.values(conditions).every(Boolean)
  
  // Generate missing conditions list
  const missingConditions: string[] = []
  if (!conditions.hasEnoughProfitDays) {
    const needed = PA_CONSTANTS.MIN_QUALIFYING_DAYS - consistencyInfo.daysWithMinProfit
    missingConditions.push(`${needed} more $${PA_CONSTANTS.MIN_PROFIT_DAY}+ profit day${needed > 1 ? "s" : ""}`)
  }
  if (!conditions.isConsistent) {
    missingConditions.push(`$${consistencyInfo.additionalProfitNeeded.toLocaleString()} more profit for consistency`)
  }
  if (!conditions.hasMinBalance) {
    const needed = PA_CONSTANTS.MIN_BALANCE_FOR_PAYOUT - stats.currentBalance
    missingConditions.push(`$${needed.toLocaleString()} more to reach minimum balance`)
  }
  if (!conditions.hasMinWithdrawable) {
    missingConditions.push(`Below minimum payout amount ($${PA_CONSTANTS.MIN_PAYOUT_AMOUNT})`)
  }
  if (!conditions.hasPayoutsRemaining) {
    missingConditions.push("All 6 payouts have been used")
  }
  
  return {
    isEligible,
    conditions,
    missingConditions,
    availableToWithdraw,
    maxPayoutAllowed,
    maxWithdrawable,
    payoutCount,
    currentPayoutTier: currentPayoutTier + 1, // 1-indexed for display
    safetyNet: PA_CONSTANTS.SAFETY_NET,
    consistencyInfo,
    stats,
  }
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const today = new Date()
  return today.toISOString().split("T")[0]
}

// Initial data setup - the exact accounts and trade specified
const INITIAL_ACCOUNTS: Account[] = [
  {
    id: "apex-50k-eval",
    name: "Apex 50K Eval",
    type: "Eval",
    status: "Active",
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
    type: "PA",
    status: "Active",
    balance: 50670,
    startingBalance: 50000,
    maxBalance: 50670,
    maxDrawdown: 2000,
    dailyLossLimit: 1000,
  },
]

// Initialize storage with real data if empty
export function initializeStorage(): { accounts: Account[]; trades: Trade[]; payouts: Payout[] } {
  if (typeof window === "undefined") {
    return { accounts: [], trades: [], payouts: [] }
  }

  let accounts = loadAccounts()
  let trades = loadTrades()
  let payouts = loadPayouts()

  // If no accounts exist, initialize with the real data
  if (accounts.length === 0) {
    accounts = INITIAL_ACCOUNTS
    saveAccounts(accounts)

    // Add the single real trade for PA account
    const today = getTodayDate()
    trades = [
      {
        id: "trade-1",
        date: today,
        accountId: "apex-50k-pa",
        symbol: "NQM6",
        pnl: 670,
      },
    ]
    saveTrades(trades)

    // No payouts yet
    payouts = []
    savePayouts(payouts)
  }

  return { accounts, trades, payouts }
}
