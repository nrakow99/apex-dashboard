import type { Firm, AccountType, DrawdownType } from "./types"
import type { LucidFlexFloorParams } from "./lucid-flex-floor"

export interface AccountRules {
  // Drawdown
  maxDrawdown: number
  floorLabel: string  // display label for the floor line

  // Daily loss limit
  hasDLL: boolean
  dailyLossLimit: number

  // Profit target (Eval only)
  hasProfitTarget: boolean
  profitTarget: number

  // Consistency rule
  hasConsistency: boolean
  consistencyPercent: number  // e.g. 50 (for 50%)

  // Payout
  hasPayouts: boolean
  maxPayouts: number
  minTradingDays: number
  minDailyProfit: number   // daily PnL threshold to count as a qualifying day
  minProfitDays: number    // how many qualifying days are required

  // Apex PA — safety-net style payouts
  safetyNet: number
  minBalanceToRequest: number
  payoutCaps: readonly number[]  // per-tier caps (length === maxPayouts)

  // Lucid PA — cycle-profit style payouts
  payoutMaxPercent: number   // e.g. 0.5; 0 when not applicable
  payoutAbsoluteCap: number  // e.g. 2000; 0 when not applicable

  // Common payout
  payoutSplit: number       // trader's share, e.g. 0.9 for Lucid, 1.0 for Apex
  minPayoutAmount: number

  // Extras
  hasScaling: boolean
  maxContracts: string  // "" if not specified

  /** LucidFlex PA only: stop-out floor schedule (null for Apex / Lucid Eval / non-Flex) */
  lucidFlexFloor: LucidFlexFloorParams | null
}

// ─── Size key helper ─────────────────────────────────────────────────────────

type SizeKey = 25000 | 50000 | 100000 | 150000

function toSizeKey(size: number): SizeKey {
  if (size <= 25000) return 25000
  if (size <= 50000) return 50000
  if (size <= 100000) return 100000
  return 150000
}

// ─── Apex rules ──────────────────────────────────────────────────────────────

const APEX_INTRADAY_EVAL: Record<SizeKey, Pick<AccountRules, "profitTarget" | "maxDrawdown" | "maxContracts">> = {
  25000:  { profitTarget: 1500, maxDrawdown: 1000, maxContracts: "4 contracts" },
  50000:  { profitTarget: 3000, maxDrawdown: 2000, maxContracts: "6 contracts" },
  100000: { profitTarget: 6000, maxDrawdown: 3000, maxContracts: "8 contracts" },
  150000: { profitTarget: 9000, maxDrawdown: 4000, maxContracts: "12 contracts" },
}

const APEX_EOD_EVAL: Record<SizeKey, Pick<AccountRules, "profitTarget" | "maxDrawdown" | "dailyLossLimit">> = {
  25000:  { profitTarget: 1500, maxDrawdown: 1000, dailyLossLimit: 500 },
  50000:  { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1000 },
  100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 2000 },
  150000: { profitTarget: 9000, maxDrawdown: 4000, dailyLossLimit: 3000 },
}

const APEX_INTRADAY_PA: Record<SizeKey, {
  minDailyProfit: number
  safetyNet: number
  minBalanceToRequest: number
  payoutCaps: readonly number[]
}> = {
  25000:  { minDailyProfit: 100, safetyNet: 26100,  minBalanceToRequest: 26600,  payoutCaps: [1000, 1000, 1000, 1000, 1000, 1000] },
  50000:  { minDailyProfit: 200, safetyNet: 52100,  minBalanceToRequest: 52600,  payoutCaps: [1500, 2000, 2500, 2500, 3000, 3000] },
  100000: { minDailyProfit: 250, safetyNet: 103100, minBalanceToRequest: 103600, payoutCaps: [2000, 2500, 3000, 3000, 4000, 4000] },
  150000: { minDailyProfit: 300, safetyNet: 154100, minBalanceToRequest: 154600, payoutCaps: [2500, 3000, 3000, 4000, 4000, 5000] },
}

const APEX_EOD_PA: Record<SizeKey, {
  maxDrawdown: number
  dailyLossLimit: number
  minDailyProfit: number
  safetyNet: number
  minBalanceToRequest: number
  payoutCaps: readonly number[]
}> = {
  25000:  { maxDrawdown: 1000, dailyLossLimit: 500,  minDailyProfit: 100, safetyNet: 26100,  minBalanceToRequest: 26600,  payoutCaps: [750,  750,  1000, 1000, 1250, 1500] },
  50000:  { maxDrawdown: 2000, dailyLossLimit: 1000, minDailyProfit: 250, safetyNet: 52100,  minBalanceToRequest: 52600,  payoutCaps: [1500, 1500, 2000, 2500, 2500, 3000] },
  100000: { maxDrawdown: 3000, dailyLossLimit: 2000, minDailyProfit: 250, safetyNet: 103100, minBalanceToRequest: 103600, payoutCaps: [2000, 2500, 3000, 3000, 4000, 4000] },
  150000: { maxDrawdown: 4000, dailyLossLimit: 3000, minDailyProfit: 300, safetyNet: 154100, minBalanceToRequest: 154600, payoutCaps: [2500, 3000, 3000, 4000, 4000, 5000] },
}

// ─── Lucid rules ─────────────────────────────────────────────────────────────

const LUCID_EVAL: Record<SizeKey, {
  profitTarget: number
  maxDrawdown: number
  maxContracts: string
}> = {
  25000:  { profitTarget: 1250, maxDrawdown: 1000, maxContracts: "2 mini / 20 micros" },
  50000:  { profitTarget: 3000, maxDrawdown: 2000, maxContracts: "4 mini / 40 micros" },
  100000: { profitTarget: 6000, maxDrawdown: 3000, maxContracts: "6 mini / 60 micros" },
  150000: { profitTarget: 9000, maxDrawdown: 4500, maxContracts: "10 mini / 100 micros" },
}

/** LucidFlex PA — payouts from cycle profit; no Apex-style balance gate */
const LUCID_FLEX_PA: Record<SizeKey, {
  maxDrawdown: number
  maxContracts: string
  minDailyProfit: number
  payoutAbsoluteCap: number
}> = {
  25000:  { maxDrawdown: 1000, maxContracts: "2 mini / 20 micros",   minDailyProfit: 100, payoutAbsoluteCap: 1000 },
  50000:  { maxDrawdown: 2000, maxContracts: "4 mini / 40 micros",   minDailyProfit: 150, payoutAbsoluteCap: 2000 },
  100000: { maxDrawdown: 3000, maxContracts: "6 mini / 60 micros",   minDailyProfit: 200, payoutAbsoluteCap: 2500 },
  150000: { maxDrawdown: 4500, maxContracts: "10 mini / 100 micros", minDailyProfit: 250, payoutAbsoluteCap: 3000 },
}

/** Locked-floor params — specified for 50K LucidFlex PA; other sizes trail min(peak−DD, rules) only via peak−DD until we add program-specific rows */
const LUCID_FLEX_FLOOR_BY_SIZE: Partial<Record<SizeKey, LucidFlexFloorParams>> = {
  50000: {
    minimumFloor: 48_100,
    lockPeakThreshold: 52_100,
    lockedFloor: 50_100,
  },
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function getAccountRules(account: {
  firm: Firm
  type: AccountType
  drawdownType: DrawdownType
  accountSize: number
  maxDrawdown?: number
  dailyLossLimit?: number
}): AccountRules {
  const size = toSizeKey(account.accountSize)

  const base: AccountRules = {
    maxDrawdown: account.maxDrawdown ?? 2000,
    floorLabel: account.drawdownType === "Intraday" ? "Intraday Trailing Threshold" : "Active EOD Floor",
    hasDLL: false,
    dailyLossLimit: 0,
    hasProfitTarget: false,
    profitTarget: 0,
    hasConsistency: false,
    consistencyPercent: 0,
    hasPayouts: false,
    maxPayouts: 0,
    minTradingDays: 0,
    minDailyProfit: 0,
    minProfitDays: 0,
    safetyNet: 0,
    minBalanceToRequest: 0,
    payoutCaps: [],
    payoutMaxPercent: 0,
    payoutAbsoluteCap: 0,
    payoutSplit: 1.0,
    minPayoutAmount: 500,
    hasScaling: false,
    maxContracts: "",
    lucidFlexFloor: null,
  }

  // ── Apex ──────────────────────────────────────────────────────────────────

  if (account.firm === "Apex") {
    if (account.type === "Eval") {
      if (account.drawdownType === "Intraday") {
        const r = APEX_INTRADAY_EVAL[size]
        return {
          ...base,
          maxDrawdown: r.maxDrawdown,
          hasProfitTarget: true,
          profitTarget: r.profitTarget,
          maxContracts: r.maxContracts,
          hasDLL: false,
        }
      } else {
        // EOD Eval
        const r = APEX_EOD_EVAL[size]
        return {
          ...base,
          maxDrawdown: r.maxDrawdown,
          hasDLL: true,
          dailyLossLimit: r.dailyLossLimit,
          hasProfitTarget: true,
          profitTarget: r.profitTarget,
        }
      }
    }

    if (account.type === "PA") {
      if (account.drawdownType === "Intraday") {
        const r = APEX_INTRADAY_PA[size]
        const eod = APEX_INTRADAY_EVAL[size]
        return {
          ...base,
          maxDrawdown: eod.maxDrawdown,
          hasDLL: false,
          hasPayouts: true,
          maxPayouts: 6,
          minTradingDays: 5,
          minDailyProfit: r.minDailyProfit,
          minProfitDays: 5,
          safetyNet: r.safetyNet,
          minBalanceToRequest: r.minBalanceToRequest,
          payoutCaps: r.payoutCaps,
          payoutSplit: 1.0,
          minPayoutAmount: 500,
          hasConsistency: false,
          maxContracts: eod.maxContracts,
        }
      } else {
        // EOD PA
        const r = APEX_EOD_PA[size]
        return {
          ...base,
          maxDrawdown: r.maxDrawdown,
          hasDLL: true,
          dailyLossLimit: r.dailyLossLimit,
          hasPayouts: true,
          maxPayouts: 6,
          minTradingDays: 5,
          minDailyProfit: r.minDailyProfit,
          minProfitDays: 5,
          safetyNet: r.safetyNet,
          minBalanceToRequest: r.minBalanceToRequest,
          payoutCaps: r.payoutCaps,
          payoutSplit: 1.0,
          minPayoutAmount: 500,
          hasConsistency: true,
          consistencyPercent: 50,
        }
      }
    }
  }

  // ── Lucid ─────────────────────────────────────────────────────────────────

  if (account.firm === "Lucid") {
    if (account.type === "Eval") {
      const r = LUCID_EVAL[size]
      return {
        ...base,
        maxDrawdown: r.maxDrawdown,
        floorLabel: "Active EOD Floor / Max Loss Limit",
        hasDLL: false,
        hasProfitTarget: true,
        profitTarget: r.profitTarget,
        hasConsistency: true,
        consistencyPercent: 50,
        maxContracts: r.maxContracts,
      }
    }

    if (account.type === "PA") {
      const r = LUCID_FLEX_PA[size]
      return {
        ...base,
        maxDrawdown: r.maxDrawdown,
        floorLabel: "Active EOD Floor / Max Loss Limit",
        hasDLL: false,
        hasPayouts: true,
        maxPayouts: 5,
        minTradingDays: 0,
        minDailyProfit: r.minDailyProfit,
        minProfitDays: 5,
        payoutMaxPercent: 0.5,
        payoutAbsoluteCap: r.payoutAbsoluteCap,
        payoutSplit: 0.9,
        minPayoutAmount: 500,
        hasConsistency: false,
        hasScaling: false,
        maxContracts: r.maxContracts,
        lucidFlexFloor: LUCID_FLEX_FLOOR_BY_SIZE[size] ?? null,
      }
    }
  }

  // ── Live / fallback ───────────────────────────────────────────────────────
  return {
    ...base,
    maxDrawdown: account.maxDrawdown ?? 2000,
    hasDLL: account.dailyLossLimit != null && account.dailyLossLimit > 0,
    dailyLossLimit: account.dailyLossLimit ?? 0,
  }
}

// Convenience: get default maxDrawdown for a new account
export function getDefaultMaxDrawdown(firm: Firm, type: AccountType, drawdownType: DrawdownType, size: number): number {
  return getAccountRules({ firm, type, drawdownType, accountSize: size }).maxDrawdown
}

export function getDefaultDLL(firm: Firm, type: AccountType, drawdownType: DrawdownType, size: number): number {
  return getAccountRules({ firm, type, drawdownType, accountSize: size }).dailyLossLimit
}

export function getDefaultProfitTarget(firm: Firm, type: AccountType, drawdownType: DrawdownType, size: number): number {
  return getAccountRules({ firm, type, drawdownType, accountSize: size }).profitTarget
}
