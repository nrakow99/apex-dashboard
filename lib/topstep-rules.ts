import type { TopstepPayoutPath } from "@/lib/types"
import type { LucidFlexFloorParams } from "@/lib/lucid-flex-floor"

export type TopstepSizeKey = 50000 | 100000 | 150000

/**
 * Account sizes must match a real Topstep tier exactly. Rounding an unknown
 * size would attach a verified rule table to an account that does not exist.
 */
export function toTopstepSizeKey(size: number): TopstepSizeKey {
  if (size === 50000 || size === 100000 || size === 150000) return size
  throw new Error(`Topstep does not offer a ${size} account — valid sizes are 50K/100K/150K.`)
}

/**
 * Verified against help.topstep.com on 2026-08-11.
 * All sizes are EOD trailing Max Loss Limit. The Daily Loss Limit is
 * optional, elected at checkout (Account.hasDailyLossLimit); dailyLossLimit
 * here is the value that applies when elected.
 */
export const TOPSTEP_EVAL: Record<
  TopstepSizeKey,
  {
    profitTarget: number
    maxDrawdown: number
    dailyLossLimit: number
    maxContracts: string
  }
> = {
  50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1000, maxContracts: "5 minis" },
  100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossLimit: 2000, maxContracts: "10 minis" },
  150000: { profitTarget: 9000, maxDrawdown: 4500, dailyLossLimit: 3000, maxContracts: "15 minis" },
}

/**
 * Verified against help.topstep.com/en/articles/8284233 on 2026-08-11.
 * Base ceiling per (size, path), no DLL elected — a single fixed ceiling
 * per cell, NOT a per-payout ladder like Apex's payoutCaps array. The real
 * rule is "50% of balance up to this ceiling," computed fresh each request,
 * not tiered across successive payouts.
 *
 * Electing the optional Daily Loss Limit (Account.hasDailyLossLimit) exactly
 * doubles the ceiling in every cell — encoded as a multiplier rule via
 * topstepXfaPayoutCap() below, not as 8 separately hardcoded numbers, so a
 * future re-verification only has to touch the 6 base values.
 */
export const TOPSTEP_XFA_BASE_PAYOUT_CAP: Record<TopstepSizeKey, Record<TopstepPayoutPath, number>> = {
  50000: { standard: 2000, consistency: 3000 },
  100000: { standard: 3000, consistency: 4000 },
  150000: { standard: 5000, consistency: 6000 },
}

/** Resolves the real payout ceiling for a given size/path/DLL-election combination. */
export function topstepXfaPayoutCap(
  size: TopstepSizeKey,
  path: TopstepPayoutPath,
  hasDailyLossLimit: boolean,
): number {
  const base = TOPSTEP_XFA_BASE_PAYOUT_CAP[size][path]
  return hasDailyLossLimit ? base * 2 : base
}

/**
 * XFA Trailing Max Loss Limit: starts at accountSize − maxDrawdown, trails
 * 1:1 with peak balance same as Eval, but locks permanently at breakeven
 * (accountSize) once peak reaches accountSize + maxDrawdown — it never
 * trails above breakeven. This reuses the LucidFlex "trail then lock" shape;
 * it does NOT yet express "also locks at breakeven immediately upon first
 * payout, independent of peak" — that needs payout history threaded into
 * the floor calc, which lucidFlexActiveFloor doesn't accept. Not implemented
 * pending the payout feature landing (hasPayouts is false for Topstep PA
 * until then).
 */
export function topstepXfaMllFloor(accountSize: number, maxDrawdown: number): LucidFlexFloorParams {
  return {
    minimumFloor: accountSize - maxDrawdown,
    lockPeakThreshold: accountSize + maxDrawdown,
    lockedFloor: accountSize,
  }
}
