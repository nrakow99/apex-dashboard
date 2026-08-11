import type { AlphaTier } from "@/lib/types"
import type { LucidFlexFloorParams } from "@/lib/lucid-flex-floor"

export type AlphaZeroSizeKey = 25000 | 50000 | 100000
export type AlphaMidSizeKey = 50000 | 100000 | 150000 // Standard & Advanced share this shape

/**
 * Alpha's three tiers have different, irregularly-shaped size sets (Zero has
 * no 150K; Standard/Advanced have no 25K) — no "round to nearest tier"
 * behavior like toTopstepSizeKey. Any size not in the given tier's exact set
 * throws, including sizes that are valid on a *different* Alpha tier (e.g.
 * 150K throws for Zero even though 150K is real Alpha inventory elsewhere).
 * A silently-rounded size would put a trader under the wrong tier's rules
 * entirely, not just the wrong table row.
 */
export function toAlphaZeroSizeKey(size: number): AlphaZeroSizeKey {
  if (size === 25000 || size === 50000 || size === 100000) return size
  throw new Error(`Alpha Zero does not offer a ${size} account — valid sizes are 25K/50K/100K.`)
}

export function toAlphaMidSizeKey(tier: "standard" | "advanced", size: number): AlphaMidSizeKey {
  if (size === 50000 || size === 100000 || size === 150000) return size
  const label = tier === "standard" ? "Standard" : "Advanced"
  throw new Error(`Alpha ${label} does not offer a ${size} account — valid sizes are 50K/100K/150K.`)
}

/**
 * Verified against help.alpha-futures.com on 2026-08-11:
 * - Zero Account Overview      (/en/articles/11771813)
 * - Standard Account Overview  (/en/articles/11632512)
 * - Advanced Account Overview  (/en/articles/11634907)
 * - Maximum Loss Limit (MLL)   (/en/articles/9491999)
 * - Daily Loss Guard           (/en/articles/9492014)
 * - Consistency Rule           (/en/articles/9492048)
 * - Payout Policy              (/en/articles/9492051)
 *
 * Consistency basis for every active cell on every tier/stage is TOTAL NET
 * PROFIT (largest day ÷ net profit since last withdrawal, or since eval
 * start) — confirmed directly against the Consistency Rule article, not
 * assumed. None of Alpha's tiers use a profit-target basis like Topstep Eval.
 */

// ─── Zero ──────────────────────────────────────────────────────────────────

export const ALPHA_ZERO_EVAL: Record<
  AlphaZeroSizeKey,
  { profitTarget: number; maxDrawdown: number; dailyLossGuard: number; maxContracts: string }
> = {
  25000: { profitTarget: 1500, maxDrawdown: 1000, dailyLossGuard: 500, maxContracts: "1 mini / 10 micros" },
  50000: { profitTarget: 3000, maxDrawdown: 2000, dailyLossGuard: 1000, maxContracts: "3 minis / 30 micros" },
  100000: { profitTarget: 6000, maxDrawdown: 3000, dailyLossGuard: 2000, maxContracts: "6 minis / 60 micros" },
}

/** No consistency rule during Zero Eval — confirmed ("40% on Qualified only"). */
export const ALPHA_ZERO_QUALIFIED: Record<
  AlphaZeroSizeKey,
  { maxDrawdown: number; dailyLossGuard: number; maxContracts: string; payoutAbsoluteCap: number; minPayoutAmount: number }
> = {
  25000: { maxDrawdown: 1000, dailyLossGuard: 500, maxContracts: "1 mini / 10 micros", payoutAbsoluteCap: 1000, minPayoutAmount: 200 },
  50000: { maxDrawdown: 2000, dailyLossGuard: 1000, maxContracts: "3 minis / 30 micros", payoutAbsoluteCap: 1500, minPayoutAmount: 200 },
  100000: { maxDrawdown: 3000, dailyLossGuard: 2000, maxContracts: "6 minis / 60 micros", payoutAbsoluteCap: 2500, minPayoutAmount: 200 },
}

// ─── Standard ──────────────────────────────────────────────────────────────

export const ALPHA_STANDARD_EVAL: Record<
  AlphaMidSizeKey,
  { profitTarget: number; maxDrawdown: number; maxContracts: string }
> = {
  50000: { profitTarget: 3000, maxDrawdown: 2000, maxContracts: "5 minis / 50 micros" },
  100000: { profitTarget: 6000, maxDrawdown: 3000, maxContracts: "10 minis / 100 micros" },
  150000: { profitTarget: 9000, maxDrawdown: 4500, maxContracts: "15 minis / 150 micros" },
}

/**
 * dailyLossGuard here ($1,000/$2,000/$3,000) was NOT in the pasted numbers —
 * it's quoted directly off the Standard Account Overview page ("Daily Loss
 * Guard (NONE on Evaluation!)" with a table showing these three figures for
 * 50K/100K/150K). Flagging distinctly from the rest of this file, which
 * comes from the pasted, pre-verified numbers: double check this one
 * independently before trusting it in production.
 */
export const ALPHA_STANDARD_QUALIFIED: Record<
  AlphaMidSizeKey,
  { maxDrawdown: number; dailyLossGuard: number; maxContracts: string; payoutAbsoluteCap: number; minPayoutAmount: number }
> = {
  50000: { maxDrawdown: 2000, dailyLossGuard: 1000, maxContracts: "5 minis / 50 micros", payoutAbsoluteCap: 3000, minPayoutAmount: 500 },
  100000: { maxDrawdown: 3000, dailyLossGuard: 2000, maxContracts: "10 minis / 100 micros", payoutAbsoluteCap: 4000, minPayoutAmount: 500 },
  150000: { maxDrawdown: 4500, dailyLossGuard: 3000, maxContracts: "15 minis / 150 micros", payoutAbsoluteCap: 5000, minPayoutAmount: 500 },
}

// ─── Advanced ──────────────────────────────────────────────────────────────

export const ALPHA_ADVANCED_EVAL: Record<
  AlphaMidSizeKey,
  { profitTarget: number; maxDrawdown: number; maxContracts: string }
> = {
  50000: { profitTarget: 4000, maxDrawdown: 1750, maxContracts: "5 minis / 50 micros" },
  100000: { profitTarget: 8000, maxDrawdown: 3500, maxContracts: "10 minis / 100 micros" },
  150000: { profitTarget: 12000, maxDrawdown: 5250, maxContracts: "15 minis / 150 micros" },
}

/** No Daily Loss Guard, no consistency rule, and a flat $15,000 payout ceiling regardless of size — all confirmed. */
export const ALPHA_ADVANCED_QUALIFIED: Record<
  AlphaMidSizeKey,
  { maxDrawdown: number; maxContracts: string; payoutAbsoluteCap: number; minPayoutAmount: number }
> = {
  50000: { maxDrawdown: 1750, maxContracts: "5 minis / 50 micros", payoutAbsoluteCap: 15000, minPayoutAmount: 1000 },
  100000: { maxDrawdown: 3500, maxContracts: "10 minis / 100 micros", payoutAbsoluteCap: 15000, minPayoutAmount: 1000 },
  150000: { maxDrawdown: 5250, maxContracts: "15 minis / 150 micros", payoutAbsoluteCap: 15000, minPayoutAmount: 1000 },
}

// ─── DLG applicability matrix ───────────────────────────────────────────────

/**
 * Not a per-account election like Topstep's hasDailyLossLimit — Alpha's DLG
 * presence is fully determined by (tier, stage), no trader choice involved.
 */
export const ALPHA_HAS_DLG: Record<AlphaTier, { eval: boolean; qualified: boolean }> = {
  zero: { eval: true, qualified: true },
  standard: { eval: false, qualified: true },
  advanced: { eval: false, qualified: false },
}

// ─── MLL trail-then-lock ────────────────────────────────────────────────────

/**
 * Confirmed against the Maximum Loss Limit article: "Once the Maximum Loss
 * Limit reaches the initial starting balance, it won't continue to trail" —
 * trails 1:1 with EOD balance highs same as a plain trailing floor, but
 * locks permanently at breakeven (accountSize) once peak reaches
 * accountSize + maxDrawdown. Same shape as Topstep's topstepXfaMllFloor;
 * kept as a separate local function rather than importing that one, to keep
 * each firm's rule file self-contained (matches how tradeify-rules.ts and
 * topstep-rules.ts don't import from each other either).
 *
 * This article describes the lock as applying "on all accounts" without
 * distinguishing Eval vs Qualified, which suggests Eval-stage MLL may also
 * lock at breakeven — NOT wired in this pass. calculateAccountStats's floor
 * gate is hardcoded to account.type === "PA", so activating this for Eval
 * would need that gate broadened too; deferred as a follow-up. Leaving Eval
 * on unlimited trailing in the meantime is the safe direction of error (a
 * floor that keeps climbing past where it should lock is tighter than
 * reality, never looser).
 */
export function alphaMllFloor(accountSize: number, maxDrawdown: number): LucidFlexFloorParams {
  return {
    minimumFloor: accountSize - maxDrawdown,
    lockPeakThreshold: accountSize + maxDrawdown,
    lockedFloor: accountSize,
  }
}
