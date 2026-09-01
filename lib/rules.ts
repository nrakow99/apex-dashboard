import type { Firm, AccountType, DrawdownType, TradeifyProgram, TopstepPayoutPath, AlphaTier } from "./types"
import { lucidFlexFloorForSize, type LucidFlexFloorParams } from "./lucid-flex-floor"
import {
  TRADEIFY_EVAL,
  TRADEIFY_FLEX,
  TRADEIFY_DAILY,
  tradeifyEvalProfitTarget,
  tradeifyLockParams,
  toTradeifySizeKey,
} from "./tradeify-rules"
import { TOPSTEP_EVAL, toTopstepSizeKey, topstepXfaMllFloor, topstepXfaPayoutCap } from "./topstep-rules"
import {
  ALPHA_ZERO_EVAL,
  ALPHA_ZERO_QUALIFIED,
  ALPHA_STANDARD_EVAL,
  ALPHA_STANDARD_QUALIFIED,
  ALPHA_ADVANCED_EVAL,
  ALPHA_ADVANCED_QUALIFIED,
  ALPHA_HAS_DLG,
  toAlphaZeroSizeKey,
  toAlphaMidSizeKey,
  alphaMllFloor,
} from "./alpha-futures-rules"
import {
  assertSupportedAccountConfiguration,
  inferLegacyTradeifyProgram,
  UnsupportedAccountConfigurationError,
} from "./account-config"

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
  /** What the consistency percent is measured against. "total_profit": Apex/Lucid/Tradeify —
   *  the cap grows as accumulated profit grows. "profit_target": Topstep — a fixed cap off
   *  the account's profit target, independent of how much has been earned so far. */
  consistencyBasis: "total_profit" | "profit_target"

  // Payout
  hasPayouts: boolean
  maxPayouts: number
  /**
   * Rolling request-frequency cap, separate from maxPayouts (a lifetime
   * count everywhere else in this file). 0 = not applicable. Counted by
   * calendar month (same YYYY-MM as today), not a trailing 30-day window —
   * confirmed as the intended reading for Alpha Futures, the only firm that
   * sets this today ("up to 4 times a month" per the Payout Policy article;
   * the article doesn't specify calendar vs rolling, so this was a judgment
   * call, not a verified fact — revisit if Alpha's docs ever clarify).
   */
  maxPayoutsPerMonth: number
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

  /** LucidFlex / Tradeify funded: EOD lock floor schedule */
  lucidFlexFloor: LucidFlexFloorParams | null

  /**
   * Whether the trailing floor snaps to a fixed value upon a completed
   * payout, independent of peak balance (e.g. Topstep XFA's advertised
   * "resets to $0 after every payout" — not yet implemented for any firm,
   * see topstepXfaMllFloor's comment). Firms that explicitly guarantee this
   * never happens (Alpha Futures markets "MLL does not reset on withdrawal"
   * as a benefit) must set this to false in their OWN branch rather than
   * rely on the base default, so the guarantee holds even if the base
   * default ever changes for firms that do implement a reset.
   */
  floorLocksOnPayout: boolean

  bufferAmount: number
  winningDayThreshold: number

  payoutPolicyKind:
    | "apex_safety_net"
    | "lucid_cycle"
    | "tradeify_flex"
    | "tradeify_daily"
    | "topstep_xfa"
    | "alpha_qualified"
    | "none"
}

// ─── Size key helper ─────────────────────────────────────────────────────────

type SizeKey = 25000 | 50000 | 100000 | 150000

function toSizeKey(size: number): SizeKey {
  if (size === 25000 || size === 50000 || size === 100000 || size === 150000) {
    return size
  }
  throw new Error(`Unsupported account size ${size}. Valid sizes are 25K/50K/100K/150K.`)
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
  100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 1500 },
  150000: { profitTarget: 9000, maxDrawdown: 4000, dailyLossLimit: 2000 },
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
  25000:  { maxDrawdown: 1000, dailyLossLimit: 500,  minDailyProfit: 100, safetyNet: 26100,  minBalanceToRequest: 26600,  payoutCaps: [1000, 1000, 1000, 1000, 1000, 1000] },
  50000:  { maxDrawdown: 2000, dailyLossLimit: 1000, minDailyProfit: 250, safetyNet: 52100,  minBalanceToRequest: 52600,  payoutCaps: [1500, 1500, 2000, 2500, 2500, 3000] },
  100000: { maxDrawdown: 3000, dailyLossLimit: 2000, minDailyProfit: 300, safetyNet: 103100, minBalanceToRequest: 103600, payoutCaps: [2000, 2500, 2500, 3000, 4000, 4000] },
  150000: { maxDrawdown: 4000, dailyLossLimit: 3000, minDailyProfit: 350, safetyNet: 154100, minBalanceToRequest: 154600, payoutCaps: [2500, 3000, 3000, 3000, 4000, 5000] },
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

// ─── Main export ─────────────────────────────────────────────────────────────

export function resolveTradeifyProgram(account: {
  firm?: Firm | null
  type: AccountType
  program?: TradeifyProgram | null
  dailyLossLimit?: number | null
}): TradeifyProgram | null {
  if (account.firm !== "Tradeify") return null
  if (account.program) return account.program
  return inferLegacyTradeifyProgram(account)
}

export function getAccountRules(account: {
  firm: Firm
  type: AccountType
  drawdownType: DrawdownType
  accountSize: number
  maxDrawdown?: number
  dailyLossLimit?: number
  program?: TradeifyProgram | null
  legacyFiftyKTarget?: boolean
  profitTarget?: number
  hasDailyLossLimit?: boolean
  topstepPayoutPath?: TopstepPayoutPath | null
  alphaTier?: AlphaTier | null
}): AccountRules {
  assertSupportedAccountConfiguration(account)
  const firm = account.firm ?? "Apex"

  const base: AccountRules = {
    maxDrawdown: account.maxDrawdown ?? 2000,
    floorLabel: account.drawdownType === "Intraday" ? "Intraday Trailing Threshold" : "Active EOD Floor",
    hasDLL: false,
    dailyLossLimit: 0,
    hasProfitTarget: false,
    profitTarget: 0,
    hasConsistency: false,
    consistencyPercent: 0,
    consistencyBasis: "total_profit",
    hasPayouts: false,
    maxPayouts: 0,
    maxPayoutsPerMonth: 0,
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
    floorLocksOnPayout: false,
    bufferAmount: 0,
    winningDayThreshold: 0,
    payoutPolicyKind: "none",
  }

  // ── Tradeify ────────────────────────────────────────────────────────────────

  if (firm === "Tradeify") {
    const program = resolveTradeifyProgram({ ...account, firm })
    const tSize = toTradeifySizeKey(account.accountSize)

    if (program === "select_eval" || account.type === "Eval") {
      const r = TRADEIFY_EVAL[tSize]
      const target = tradeifyEvalProfitTarget(
        account.accountSize,
        account.legacyFiftyKTarget,
      )
      return {
        ...base,
        floorLabel: "Active EOD Floor",
        maxDrawdown: r.maxDrawdown,
        hasDLL: false,
        hasProfitTarget: true,
        profitTarget: account.profitTarget ?? target,
        hasConsistency: true,
        consistencyPercent: 40,
        minTradingDays: 3,
        maxContracts: r.maxContracts,
        payoutPolicyKind: "none",
      }
    }

    if (program === "select_flex") {
      const r = TRADEIFY_FLEX[tSize]
      return {
        ...base,
        floorLabel: "EOD Floor (lock available)",
        maxDrawdown: r.maxDrawdown,
        hasDLL: false,
        hasPayouts: true,
        maxPayouts: 99,
        minDailyProfit: r.winningDayThreshold,
        minProfitDays: 5,
        winningDayThreshold: r.winningDayThreshold,
        payoutMaxPercent: 0.5,
        payoutAbsoluteCap: r.payoutCap,
        payoutSplit: 0.9,
        minPayoutAmount: 1,
        minBalanceToRequest: 0,
        hasConsistency: false,
        hasScaling: true,
        maxContracts: r.maxContracts,
        lucidFlexFloor: tradeifyLockParams("select_flex", account.accountSize),
        payoutPolicyKind: "tradeify_flex",
      }
    }

    if (program === "select_daily") {
      const r = TRADEIFY_DAILY[tSize]
      return {
        ...base,
        floorLabel: "EOD Floor (lock available)",
        maxDrawdown: r.maxDrawdown,
        hasDLL: true,
        dailyLossLimit: r.dailyLossLimit,
        hasPayouts: true,
        maxPayouts: 99,
        bufferAmount: r.buffer,
        payoutAbsoluteCap: r.payoutCap,
        payoutSplit: 0.9,
        minPayoutAmount: 250,
        minBalanceToRequest: 0,
        hasConsistency: false,
        hasScaling: true,
        maxContracts: r.maxContracts,
        lucidFlexFloor: tradeifyLockParams("select_daily", account.accountSize),
        payoutPolicyKind: "tradeify_daily",
      }
    }
  }

  // ── Apex ──────────────────────────────────────────────────────────────────

  if (firm === "Apex") {
    const size = toSizeKey(account.accountSize)
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
          minTradingDays: 0,
          minDailyProfit: r.minDailyProfit,
          minProfitDays: 5,
          safetyNet: r.safetyNet,
          minBalanceToRequest: r.minBalanceToRequest,
          payoutCaps: r.payoutCaps,
          payoutSplit: 1.0,
          minPayoutAmount: 500,
          hasConsistency: true,
          consistencyPercent: 50,
          maxContracts: eod.maxContracts,
          hasScaling: true,
          payoutPolicyKind: "apex_safety_net",
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
          minTradingDays: 0,
          minDailyProfit: r.minDailyProfit,
          minProfitDays: 5,
          safetyNet: r.safetyNet,
          minBalanceToRequest: r.minBalanceToRequest,
          payoutCaps: r.payoutCaps,
          payoutSplit: 1.0,
          minPayoutAmount: 500,
          hasConsistency: true,
          consistencyPercent: 50,
          hasScaling: true,
          payoutPolicyKind: "apex_safety_net",
        }
      }
    }
  }

  // ── Lucid ─────────────────────────────────────────────────────────────────

  if (firm === "Lucid") {
    const size = toSizeKey(account.accountSize)
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
        lucidFlexFloor: lucidFlexFloorForSize(size, r.maxDrawdown),
        payoutPolicyKind: "lucid_cycle",
      }
    }
  }

  // ── Topstep ───────────────────────────────────────────────────────────────

  if (firm === "Topstep") {
    const tSize = toTopstepSizeKey(account.accountSize)
    const r = TOPSTEP_EVAL[tSize]

    if (account.type === "Eval") {
      return {
        ...base,
        floorLabel: "EOD Trailing Max Loss Limit",
        maxDrawdown: r.maxDrawdown,
        hasDLL: Boolean(account.hasDailyLossLimit),
        dailyLossLimit: account.hasDailyLossLimit ? r.dailyLossLimit : 0,
        hasProfitTarget: true,
        profitTarget: account.profitTarget ?? r.profitTarget,
        hasConsistency: true,
        consistencyPercent: 50,
        consistencyBasis: "profit_target",
        maxContracts: r.maxContracts,
      }
    }

    if (account.type === "PA") {
      // XFA. maxDrawdown/dailyLossLimit reuse the Eval $ figures for this
      // size — Topstep carries the same trailing MLL/DLL dollar amounts into
      // funded, no separate funded table was given.
      const onConsistencyPath = account.topstepPayoutPath === "consistency"
      const path: TopstepPayoutPath = onConsistencyPath ? "consistency" : "standard"
      const hasDLL = Boolean(account.hasDailyLossLimit)
      return {
        ...base,
        floorLabel: "XFA Trailing Max Loss Limit (locks at breakeven)",
        maxDrawdown: r.maxDrawdown,
        hasDLL,
        dailyLossLimit: hasDLL ? r.dailyLossLimit : 0,
        hasConsistency: onConsistencyPath,
        consistencyPercent: onConsistencyPath ? 40 : 0,
        consistencyBasis: "total_profit",
        // Standard: 5 winning days of $150+ (non-consecutive — no day-spacing
        // gate needed since getPayoutEligibility counts qualifying days since
        // the last payout, not consecutive ones) and "profitable since last
        // payout, first exempt" (getPayoutEligibility skips that check when
        // payoutCount === 0).
        // Consistency: 3 trading days instead of a winning-day count.
        minProfitDays: onConsistencyPath ? 0 : 5,
        minDailyProfit: onConsistencyPath ? 0 : 150,
        winningDayThreshold: onConsistencyPath ? 0 : 150,
        minTradingDays: onConsistencyPath ? 3 : 0,
        payoutSplit: 0.9,
        minPayoutAmount: 125,
        // Formula base is BALANCE, not cycle profit — unlike Lucid/Tradeify's
        // profit-based 50%. getPayoutEligibility's Topstep branch multiplies
        // stats.currentBalance (not cycle profit) by payoutMaxPercent.
        payoutMaxPercent: 0.5,
        payoutAbsoluteCap: topstepXfaPayoutCap(tSize, path, hasDLL),
        payoutPolicyKind: "topstep_xfa",
        // Each XFA request is a fresh single-ceiling payout, not a ladder —
        // no stated lifetime limit, so this doesn't gate anything in
        // practice (mirrors Tradeify Flex/Daily's 99 "effectively unlimited").
        maxPayouts: 99,
        hasPayouts: true,
        // "Resets to $0 after every payout": the MLL locks at breakeven
        // (accountSize) immediately upon ANY approved payout, independent of
        // peak balance — not just when peak crosses lockPeakThreshold like
        // the base trail-then-lock shape below. calculateAccountStats reads
        // this flag to force the floor to lucidFlexFloor.lockedFloor once the
        // account has at least one payout on record.
        floorLocksOnPayout: true,
        lucidFlexFloor: topstepXfaMllFloor(tSize, r.maxDrawdown),
        maxContracts: r.maxContracts,
      }
    }
  }

  // ── Alpha Futures ────────────────────────────────────────────────────────
  // Verified against help.alpha-futures.com on 2026-08-11 — see
  // lib/alpha-futures-rules.ts for the specific articles.

  if (firm === "Alpha") {
    const tier = account.alphaTier
    if (!tier) {
      throw new Error(
        "Alpha Futures accounts require alphaTier (zero | standard | advanced) — no safe default exists across tiers.",
      )
    }
    const dlg = ALPHA_HAS_DLG[tier]

    if (account.type === "Eval") {
      if (tier === "zero") {
        const zSize = toAlphaZeroSizeKey(account.accountSize)
        const r = ALPHA_ZERO_EVAL[zSize]
        return {
          ...base,
          floorLabel: "EOD Trailing Max Loss Limit",
          maxDrawdown: r.maxDrawdown,
          hasDLL: dlg.eval,
          dailyLossLimit: dlg.eval ? r.dailyLossGuard : 0,
          hasProfitTarget: true,
          profitTarget: account.profitTarget ?? r.profitTarget,
          hasConsistency: false,
          consistencyPercent: 0,
          consistencyBasis: "total_profit",
          maxContracts: r.maxContracts,
          // The MLL article says the breakeven lock applies "on all
          // accounts" without distinguishing Eval vs Qualified, but
          // calculateAccountStats's lock gate is hardcoded to type ===
          // "PA". Not broadening that gate on an unconfirmed assumption —
          // left on unlimited trailing here, which errs tighter than
          // reality (never looser), same direction of error as leaving it
          // off entirely.
          lucidFlexFloor: null,
        }
      }

      const mSize = toAlphaMidSizeKey(tier, account.accountSize)
      const r = tier === "standard" ? ALPHA_STANDARD_EVAL[mSize] : ALPHA_ADVANCED_EVAL[mSize]
      return {
        ...base,
        floorLabel: "EOD Trailing Max Loss Limit",
        maxDrawdown: r.maxDrawdown,
        hasDLL: dlg.eval,
        dailyLossLimit: 0, // Standard and Advanced both have DLG off at Eval
        hasProfitTarget: true,
        profitTarget: account.profitTarget ?? r.profitTarget,
        hasConsistency: true,
        consistencyPercent: tier === "standard" ? 50 : 40,
        consistencyBasis: "total_profit",
        maxContracts: r.maxContracts,
        lucidFlexFloor: null, // see zero-eval comment above
      }
    }

    if (account.type === "PA") {
      if (tier === "zero") {
        const zSize = toAlphaZeroSizeKey(account.accountSize)
        const r = ALPHA_ZERO_QUALIFIED[zSize]
        return {
          ...base,
          floorLabel: "Qualified Trailing MLL (locks at breakeven)",
          maxDrawdown: r.maxDrawdown,
          hasDLL: dlg.qualified,
          dailyLossLimit: dlg.qualified ? r.dailyLossGuard : 0,
          hasConsistency: true,
          consistencyPercent: 40,
          consistencyBasis: "total_profit",
          payoutSplit: 0.9,
          minPayoutAmount: r.minPayoutAmount,
          payoutMaxPercent: 0.5,
          payoutAbsoluteCap: r.payoutAbsoluteCap,
          minProfitDays: 5,
          minDailyProfit: 200,
          winningDayThreshold: 200,
          payoutPolicyKind: "alpha_qualified",
          // Each XFA-style request draws off the current cycle, not a
          // ladder — no stated lifetime limit, so maxPayouts stays the
          // inert "effectively unlimited" 99 (same convention as Tradeify
          // Flex/Daily and Topstep XFA). The real constraint is "up to 4
          // times a month" — a rolling request-frequency cap, structurally
          // different from a lifetime count, so it lives in its own field
          // (maxPayoutsPerMonth) rather than overloading maxPayouts.
          maxPayouts: 99,
          maxPayoutsPerMonth: 4,
          hasPayouts: true,
          floorLocksOnPayout: false, // positive guard — Alpha does not reset MLL on withdrawal
          lucidFlexFloor: alphaMllFloor(zSize, r.maxDrawdown),
          maxContracts: r.maxContracts,
        }
      }

      const mSize = toAlphaMidSizeKey(tier, account.accountSize)

      if (tier === "standard") {
        const r = ALPHA_STANDARD_QUALIFIED[mSize]
        return {
          ...base,
          floorLabel: "Qualified Trailing MLL (locks at breakeven)",
          maxDrawdown: r.maxDrawdown,
          hasDLL: dlg.qualified,
          dailyLossLimit: dlg.qualified ? r.dailyLossGuard : 0,
          hasConsistency: true,
          consistencyPercent: 40,
          consistencyBasis: "total_profit",
          payoutSplit: 0.9,
          minPayoutAmount: r.minPayoutAmount,
          payoutMaxPercent: 0.5,
          payoutAbsoluteCap: r.payoutAbsoluteCap,
          minProfitDays: 5,
          minDailyProfit: 200,
          winningDayThreshold: 200,
          payoutPolicyKind: "alpha_qualified",
          maxPayouts: 99,
          maxPayoutsPerMonth: 4,
          hasPayouts: true,
          floorLocksOnPayout: false, // positive guard — Alpha does not reset MLL on withdrawal
          lucidFlexFloor: alphaMllFloor(mSize, r.maxDrawdown),
          maxContracts: r.maxContracts,
        }
      }

      // advanced
      const r = ALPHA_ADVANCED_QUALIFIED[mSize]
      return {
        ...base,
        floorLabel: "Qualified Trailing MLL (locks at breakeven)",
        maxDrawdown: r.maxDrawdown,
        hasDLL: false,
        dailyLossLimit: 0,
        hasConsistency: false,
        consistencyPercent: 0,
        consistencyBasis: "total_profit",
        payoutSplit: 0.9,
        minPayoutAmount: r.minPayoutAmount,
        payoutMaxPercent: 0.5,
        payoutAbsoluteCap: r.payoutAbsoluteCap,
        minProfitDays: 5,
        minDailyProfit: 200,
        winningDayThreshold: 200,
        payoutPolicyKind: "alpha_qualified",
        maxPayouts: 99,
        maxPayoutsPerMonth: 4,
        hasPayouts: true,
        floorLocksOnPayout: false, // positive guard — Alpha does not reset MLL on withdrawal
        lucidFlexFloor: alphaMllFloor(mSize, r.maxDrawdown),
        hasScaling: false, // "no scaling plan" — confirmed
        maxContracts: r.maxContracts,
      }
    }
  }

  // Validation above rejects every expected unsupported configuration.
  // Reaching this point means a supported branch is missing or malformed.
  throw new Error(`Rule resolution reached an unexpected state for ${firm} ${account.type}.`)
}

export type AccountRulesResolution =
  | { supported: true; rules: AccountRules }
  | { supported: false; reason: string }

export function resolveAccountRules(
  account: Parameters<typeof getAccountRules>[0],
  resolver: typeof getAccountRules = getAccountRules,
): AccountRulesResolution {
  try {
    return { supported: true, rules: resolver(account) }
  } catch (error) {
    if (error instanceof UnsupportedAccountConfigurationError) {
      return { supported: false, reason: error.message }
    }
    throw error
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
