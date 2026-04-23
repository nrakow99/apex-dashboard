export type AccountType = "Eval" | "PA" | "Live"
export type AccountStatus = "Active" | "Passed" | "Breached"

export interface Account {
  id: string
  name: string
  type: AccountType
  status: AccountStatus
  balance: number
  startingBalance: number
  maxBalance: number // Highest end-of-day balance (for trailing drawdown)
  profitTarget?: number // Eval only
  maxDrawdown: number // EOD trailing drawdown limit
  dailyLossLimit: number
}

export interface Trade {
  id: string
  date: string
  accountId: string
  symbol: string
  pnl: number // Net PnL (no separate commission tracking per user request)
  notes?: string
}

export interface DailyPnL {
  date: string
  accountId: string
  pnl: number
  balance: number
  tradesCount: number
}

export interface Payout {
  id: string
  date: string
  accountId: string
  amount: number
  notes?: string
  payoutNumber: number // Track which payout this is (1-6)
}

// PA Account Constants for 50K
export const PA_CONSTANTS = {
  SAFETY_NET: 52100, // Must stay above this
  MIN_BALANCE_FOR_PAYOUT: 52600, // Minimum balance required
  MIN_PROFIT_DAY: 250, // Minimum profit to count as qualifying day
  MIN_QUALIFYING_DAYS: 5, // Days with $250+ profit required
  MIN_PAYOUT_AMOUNT: 500, // Minimum withdrawal amount
  PAYOUT_TIERS: [1500, 1500, 2000, 2500, 2500, 3000] as const, // Max per payout 1-6
}

// EOD Drawdown Constants
export const EOD_CONSTANTS = {
  CLOSE_HOUR: 14, // 2:00 PM local time
  CLOSE_MINUTE: 0,
}

// EOD Drawdown calculation
// The floor only updates at end of trading day (2:00 PM)
export interface DrawdownInfo {
  // Current live balance (updates immediately with trades)
  currentBalance: number
  
  // Official EOD values (only update after 2:00 PM)
  lastCompletedEodBalance: number // Closing balance from last completed day
  highestCompletedEodBalance: number // Highest EOD balance ever reached
  activeEodFloor: number // highestCompletedEodBalance - maxDrawdown
  
  // Projected values (if day ended now)
  projectedEodFloor: number // max(currentBalance, highestCompletedEodBalance) - maxDrawdown
  
  // Drawdown remaining based on ACTIVE floor (not projected)
  drawdownRemaining: number
  drawdownLimit: number
  isSafe: boolean
  
  // Time info
  isTradingDayComplete: boolean
  timeUntilClose: string // e.g., "2h 30m" or "Closed"
}

// PA Consistency Rule (50% rule)
// largestWinningDay <= 0.5 * totalProfit
export interface ConsistencyInfo {
  largestWinningDay: number
  totalProfit: number
  maxAllowedDay: number // 50% of total profit
  isValid: boolean
  maxAllowedProfitToday: number // How much more can be made today
  additionalProfitNeeded: number // Additional profit needed to satisfy consistency
  daysWithMinProfit: number // Days with $250+ profit for PA requirement
}
