export type AccountType = "Eval" | "PA" | "Live"
export type AccountStatus = "Active" | "Passed" | "Breached"
export type DrawdownType = "EOD" | "Intraday"
export type Firm = "Apex" | "Lucid" | "Tradeify" | "Topstep" | "Alpha"

/** Tradeify Select program (null for Apex/Lucid). */
export type TradeifyProgram = "select_eval" | "select_flex" | "select_daily"

/** Topstep XFA payout path, chosen at funded stage (not at Eval checkout). */
export type TopstepPayoutPath = "standard" | "consistency"

/** Alpha Futures tier — a rule-variant choice (different targets/consistency/DLG), not a size variant. */
export type AlphaTier = "zero" | "standard" | "advanced"

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
  /** Topstep XFA only: Standard vs Consistency payout path. Determines the payout ceiling and whether the 40%-of-total-profit consistency rule applies. */
  topstepPayoutPath?: TopstepPayoutPath | null
  /** Alpha Futures only: zero | standard | advanced. Required for firm === "Alpha" — getAccountRules throws if unset, no safe default exists across tiers. */
  alphaTier?: AlphaTier | null
  /** Risk profile override (all-or-nothing — a set of one, two, or three means an incomplete override; see lib/headroom.ts). Falls back to the user-level default when all three are unset. */
  riskSymbol?: string | null
  riskContracts?: number | null
  /** Stored unit is ticks, never points — see lib/instrument-specs.ts. */
  riskStopTicks?: number | null
}

/** A single root symbol's contract specs. tickSize is in points (the
 *  instrument's natural quoting unit); tickValue is dollars per tick.
 *  $/point = tickValue / tickSize. Rows with isBuiltin false are a user's
 *  own addition or override and always take precedence over a built-in row
 *  for the same symbol. */
export interface InstrumentSpec {
  symbol: string
  label: string
  tickSize: number
  tickValue: number
  source?: string | null
  isBuiltin: boolean
}

/** A resolved (symbol, contracts, stop) risk profile — either the
 *  user-level default or a per-account override, before being joined
 *  against an InstrumentSpec to compute a dollar risk-per-trade. */
export interface RiskProfile {
  symbol: string
  contracts: number
  riskStopTicks: number
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
  /** Stable identity for a reviewed screenshot-import row, when available. */
  importKey?: string | null
  importSource?: "screenshot" | null
  rawSymbol?: string | null
  isAggregate?: boolean
  pnlHigh?: number | null
  pnlLow?: number | null
  commission?: number | null
  avgWin?: number | null
  avgLoss?: number | null
  winDurationSeconds?: number | null
  lossDurationSeconds?: number | null
  winRatePercent?: number | null
  extractionConfidence?: "high" | "medium" | "low" | null
  importBatchId?: string | null
}

export interface DailyPnL {
  date: string
  accountId: string
  pnl: number
  /** Gross payout deducted from the account balance on this date. */
  payoutAmount?: number
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

export type AccountCostCategory =
  | "evaluation"
  | "activation"
  | "reset"
  | "platform"
  | "data"
  | "other"

export interface AccountCost {
  id: string
  accountId: string
  date: string
  category: AccountCostCategory
  amount: number
  notes?: string
}

/** User-authored controls for a session. These are never prop-firm rules. */
export interface DailySessionPlan {
  date: string
  reviewedRiskQueue: boolean
  confirmedFirmPortal: boolean
  checkedNewsEvents: boolean
  personalLossLimit: number | null
  maxTrades: number | null
  notes: string
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
