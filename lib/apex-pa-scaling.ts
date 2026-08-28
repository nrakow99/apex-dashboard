/**
 * Apex PA performance scaling tiers (contracts + DLL by lifetime profit band).
 * Profit = currentBalance − startingBalance (proxy until prior-session close balance exists).
 * Update tables here when firm rules change.
 */

import type { Account } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"

type SizeKey = 25000 | 50000 | 100000 | 150000

function resolveSizeKey(account: Account): SizeKey | null {
  try {
    getAccountRules(account)
  } catch {
    return null
  }
  return account.accountSize === 25000 ||
    account.accountSize === 50000 ||
    account.accountSize === 100000 ||
    account.accountSize === 150000
    ? account.accountSize
    : null
}

export interface ApexPaScalingTierRow {
  level: number
  /** Minimum profit (inclusive) for this tier */
  minProfit: number
  maxContracts: number
  dailyLossLimit: number
}

export interface ApexPaScalingTierResult {
  level: number
  maxContracts: number
  dailyLossLimit: number
  /** currentBalance − startingBalance */
  currentProfit: number
  /** Profit needed to reach the next tier’s threshold; null at max tier */
  amountToNextTier: number | null
  nextLevel: number | null
  maxLevel: number
  isMaxTier: boolean
  /** 0–100 progress within current profit band toward the next tier (display only; max tier = 100) */
  progressToNextTierPercent: number
}

/** Ordered by ascending minProfit; first tier always minProfit 0 */
const TIERS: Record<SizeKey, ApexPaScalingTierRow[]> = {
  25000: [
    { level: 1, minProfit: 0, maxContracts: 1, dailyLossLimit: 500 },
    { level: 2, minProfit: 1000, maxContracts: 2, dailyLossLimit: 500 },
    { level: 3, minProfit: 2000, maxContracts: 2, dailyLossLimit: 1250 },
  ],
  50000: [
    { level: 1, minProfit: 0, maxContracts: 2, dailyLossLimit: 1000 },
    { level: 2, minProfit: 1500, maxContracts: 3, dailyLossLimit: 1000 },
    { level: 3, minProfit: 3000, maxContracts: 4, dailyLossLimit: 2000 },
    // Level 4 per spec “$5,999+” → treat next band at $6,000 to avoid overlap with L3 upper bound
    { level: 4, minProfit: 6000, maxContracts: 4, dailyLossLimit: 3000 },
  ],
  100000: [
    { level: 1, minProfit: 0, maxContracts: 3, dailyLossLimit: 1750 },
    { level: 2, minProfit: 2000, maxContracts: 4, dailyLossLimit: 1750 },
    { level: 3, minProfit: 3000, maxContracts: 5, dailyLossLimit: 1750 },
    { level: 4, minProfit: 5000, maxContracts: 6, dailyLossLimit: 2500 },
    { level: 5, minProfit: 10000, maxContracts: 6, dailyLossLimit: 3500 },
  ],
  150000: [
    { level: 1, minProfit: 0, maxContracts: 4, dailyLossLimit: 2500 },
    { level: 2, minProfit: 2000, maxContracts: 5, dailyLossLimit: 2500 },
    { level: 3, minProfit: 3000, maxContracts: 7, dailyLossLimit: 2500 },
    { level: 4, minProfit: 5000, maxContracts: 10, dailyLossLimit: 3000 },
    { level: 5, minProfit: 10000, maxContracts: 10, dailyLossLimit: 4000 },
  ],
}

export function getApexPaScalingTier(
  account: Account,
  accountStats: { currentBalance: number },
): ApexPaScalingTierResult | null {
  if (account.firm !== "Apex" || account.type !== "PA") return null

  const sizeKey = resolveSizeKey(account)
  if (sizeKey == null) return null
  const tiers = TIERS[sizeKey]
  const profit = accountStats.currentBalance - account.startingBalance

  let idx = 0
  for (let i = 0; i < tiers.length; i++) {
    if (profit >= tiers[i].minProfit) idx = i
  }

  const current = tiers[idx]
  const last = tiers[tiers.length - 1]
  const isMaxTier = idx >= tiers.length - 1

  let amountToNextTier: number | null = null
  let nextLevel: number | null = null
  let progressToNextTierPercent = 100
  if (!isMaxTier) {
    const next = tiers[idx + 1]
    nextLevel = next.level
    amountToNextTier = Math.max(0, next.minProfit - profit)
    const band = next.minProfit - current.minProfit
    progressToNextTierPercent =
      band <= 0 ? 100 : Math.min(100, Math.max(0, ((profit - current.minProfit) / band) * 100))
  }

  return {
    level: current.level,
    maxContracts: current.maxContracts,
    dailyLossLimit: current.dailyLossLimit,
    currentProfit: profit,
    amountToNextTier,
    nextLevel,
    maxLevel: last.level,
    isMaxTier,
    progressToNextTierPercent,
  }
}
