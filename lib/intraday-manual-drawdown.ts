import type { Account } from "@/lib/types"

/** Snapshot of stats fields overridden for intraday manual display */
export type IntradayDrawableStats = {
  currentBalance: number
  minBalance: number
  drawdownRemaining: number
  activeEodFloor: number
  projectedEodFloor: number
  isSafe: boolean
}

export function hasIntradayManualDrawdown(account: Account): boolean {
  return (
    account.drawdownType === "Intraday" &&
    (account.manualDrawdownRemaining != null || account.manualIntradayFloor != null)
  )
}

/**
 * For Intraday accounts only: replace estimated floor / drawdown remaining with manual Tradovate values when set.
 * Does not alter trade-based currentBalance or any payout calculations.
 */
export function applyIntradayManualDrawdownToStats<T extends IntradayDrawableStats>(
  account: Account,
  stats: T,
): T {
  if (account.drawdownType !== "Intraday") return stats

  let floor: number
  let ddRem: number

  if (account.manualDrawdownRemaining != null) {
    ddRem = account.manualDrawdownRemaining
    floor = stats.currentBalance - ddRem
  } else if (account.manualIntradayFloor != null) {
    floor = account.manualIntradayFloor
    ddRem = stats.currentBalance - floor
  } else {
    return stats
  }

  return {
    ...stats,
    minBalance: floor,
    activeEodFloor: floor,
    projectedEodFloor: floor,
    drawdownRemaining: ddRem,
    isSafe: ddRem > 0,
  }
}
