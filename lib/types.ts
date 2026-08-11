export type AccountType = "Eval" | "PA" | "Live"
export type AccountStatus = "Active" | "Passed" | "Breached"
export type DrawdownType = "EOD" | "Intraday"
export type Firm = "Apex" | "Lucid" | "Tradeify" | "Topstep"

/** Tradeify Select program (null for Apex/Lucid). */
export type TradeifyProgram = "select_eval" | "select_flex" | "select_daily"

export interface Account {
  id: string
  name: string
  firm: Firm
  type: AccountType
  status: AccountStatus
  drawdownType: DrawdownType
  accountSize: number
  /** Number of identical accounts represented by this card (default 1) */
  quantity?: number
  balance: number
  startingBalance: number
  maxBalance: number
  profitTarget?: number
  maxDrawdown: number
  dailyLossLimit: number
  /** Intraday only: manual active floor from Tradovate (optional) */
  manualIntradayFloor?: number | null
  /** Intraday only: manual distance to floor (optional) */
  manualDrawdownRemaining?: number | null
  manualDrawdownUpdatedAt?: string | null
  /** When Eval → PA in-place activation completed */
  activatedAt?: string | null
  /** PA only (converted from Eval): metrics use trades/payouts on or after this date (YYYY-MM-DD) */
  activationStartDate?: string | null
  /** Set when converting in place, e.g. "Eval" */
  previousType?: string | null
  /** Account creation timestamp (ISO) */
  createdAt?: string | null
  /** Tradeify only: select_eval | select_flex | select_daily */
  program?: TradeifyProgram | null
  /** Tradeify 50K Select Eval: use $2,500 legacy profit target */
  legacyFiftyKTarget?: boolean
  /** Optional Daily Loss Limit, elected at checkout (currently: Topstep). Other firms may add this later. */
  hasDailyLossLimit?: boolean
}

export interface Trade {
  id: string
  date: string
  accountId: string
  symbol: string
  pnl: number
  notes?: string
  session?: string | null
  direction?: string | null
  grade?: string | null
  setupTags?: string[]
  disciplineTags?: string[]
  entryPrice?: number | null
  exitPrice?: number | null
  contracts?: number | null
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
  amount: number          // gross requested amount
  notes?: string
  payoutNumber: number
  traderReceived?: number // amount after split (Lucid: amount * 0.9)
  firmSplit?: number      // firm portion (Lucid: amount * 0.1)
  payoutSplitPercent?: number // trader's %, e.g. 0.9
}

// EOD Drawdown Constants
export const EOD_CONSTANTS = {
  CLOSE_HOUR: 14,
  CLOSE_MINUTE: 0,
}

// Kept for backward-compat with existing code; new code should use getAccountRules()
export const PA_CONSTANTS = {
  SAFETY_NET: 52100,
  MIN_BALANCE_FOR_PAYOUT: 52600,
  MIN_PROFIT_DAY: 250,
  MIN_QUALIFYING_DAYS: 5,
  MIN_PAYOUT_AMOUNT: 500,
  PAYOUT_TIERS: [1500, 1500, 2000, 2500, 2500, 3000] as const,
}

export interface DrawdownInfo {
  currentBalance: number
  lastCompletedEodBalance: number
  highestCompletedEodBalance: number
  activeEodFloor: number
  projectedEodFloor: number
  drawdownRemaining: number
  drawdownLimit: number
  isSafe: boolean
  isTradingDayComplete: boolean
  timeUntilClose: string
}

export interface ConsistencyInfo {
  largestWinningDay: number
  totalProfit: number
  maxAllowedDay: number
  isValid: boolean
  maxAllowedProfitToday: number
  additionalProfitNeeded: number
  daysWithMinProfit: number
}
