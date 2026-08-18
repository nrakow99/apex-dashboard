import type { TradeifyProgram } from "@/lib/types"
import type { LucidFlexFloorParams } from "@/lib/lucid-flex-floor"

export type TradeifySizeKey = 25000 | 50000 | 100000 | 150000

export function toTradeifySizeKey(size: number): TradeifySizeKey {
  if (size <= 25000) return 25000
  if (size <= 50000) return 50000
  if (size <= 100000) return 100000
  return 150000
}

export const TRADEIFY_EVAL: Record<
  TradeifySizeKey,
  {
    profitTarget: number
    legacyProfitTarget50K: number
    maxDrawdown: number
    maxContracts: string
  }
> = {
  25000: { profitTarget: 1500, legacyProfitTarget50K: 1500, maxDrawdown: 1000, maxContracts: "1 mini / 10 micros" },
  50000: { profitTarget: 3000, legacyProfitTarget50K: 2500, maxDrawdown: 2000, maxContracts: "4 minis / 40 micros" },
  100000: { profitTarget: 6000, legacyProfitTarget50K: 6000, maxDrawdown: 3000, maxContracts: "8 minis / 80 micros" },
  150000: { profitTarget: 9000, legacyProfitTarget50K: 9000, maxDrawdown: 4500, maxContracts: "12 minis / 120 micros" },
}

export const TRADEIFY_FLEX: Record<
  TradeifySizeKey,
  {
    maxDrawdown: number
    winningDayThreshold: number
    payoutCap: number
    maxContracts: string
    lockFloor: number
    lockPeakThreshold: number
  }
> = {
  25000: {
    maxDrawdown: 1000,
    winningDayThreshold: 100,
    payoutCap: 1250,
    maxContracts: "2 minis / 20 micros",
    lockFloor: 25100,
    lockPeakThreshold: 26100,
  },
  50000: {
    maxDrawdown: 2000,
    winningDayThreshold: 150,
    payoutCap: 3000,
    maxContracts: "4 minis / 40 micros",
    lockFloor: 50100,
    lockPeakThreshold: 52100,
  },
  100000: {
    maxDrawdown: 3000,
    winningDayThreshold: 200,
    payoutCap: 4000,
    maxContracts: "8 minis / 80 micros",
    lockFloor: 100100,
    lockPeakThreshold: 103100,
  },
  150000: {
    maxDrawdown: 4500,
    winningDayThreshold: 250,
    payoutCap: 5000,
    maxContracts: "12 minis / 120 micros",
    lockFloor: 150100,
    lockPeakThreshold: 154600,
  },
}

export const TRADEIFY_DAILY: Record<
  TradeifySizeKey,
  {
    maxDrawdown: number
    dailyLossLimit: number
    buffer: number
    payoutCap: number
    maxContracts: string
    lockFloor: number
    lockPeakThreshold: number
  }
> = {
  25000: {
    maxDrawdown: 1000,
    dailyLossLimit: 500,
    buffer: 1100,
    payoutCap: 600,
    maxContracts: "2 minis / 20 micros",
    lockFloor: 25100,
    lockPeakThreshold: 26100,
  },
  50000: {
    maxDrawdown: 2000,
    dailyLossLimit: 1000,
    buffer: 2100,
    payoutCap: 1000,
    maxContracts: "4 minis / 40 micros",
    lockFloor: 50100,
    lockPeakThreshold: 52100,
  },
  100000: {
    maxDrawdown: 2500,
    dailyLossLimit: 1250,
    buffer: 2600,
    payoutCap: 1500,
    maxContracts: "8 minis / 80 micros",
    lockFloor: 100100,
    lockPeakThreshold: 102600,
  },
  150000: {
    maxDrawdown: 3500,
    dailyLossLimit: 1750,
    buffer: 3600,
    payoutCap: 2500,
    maxContracts: "12 minis / 120 micros",
    lockFloor: 150100,
    lockPeakThreshold: 153600,
  },
}

export function tradeifyEvalProfitTarget(
  size: number,
  legacyFiftyKTarget?: boolean,
): number {
  const key = toTradeifySizeKey(size)
  const row = TRADEIFY_EVAL[key]
  if (key === 50000 && legacyFiftyKTarget) return row.legacyProfitTarget50K
  return row.profitTarget
}

export function tradeifyLockParams(
  program: TradeifyProgram,
  accountSize: number,
): LucidFlexFloorParams {
  const size = toTradeifySizeKey(accountSize)
  const row = program === "select_daily" ? TRADEIFY_DAILY[size] : TRADEIFY_FLEX[size]
  return {
    // Pre-lock trailing floor's lower bound — same "size minus max drawdown"
    // shape as lucidFlexFloorForSize/topstepXfaMllFloor/alphaMllFloor. This
    // was wrongly set to row.lockFloor (the POST-lock value), which clamped
    // the floor up to breakeven+$100 from day one — before the peak ever
    // reached lockPeakThreshold — making a brand-new, untouched account
    // read as already breached (floor above starting balance).
    minimumFloor: accountSize - row.maxDrawdown,
    lockPeakThreshold: row.lockPeakThreshold,
    lockedFloor: row.lockFloor,
  }
}

export function tradeifyProgramLabel(program: TradeifyProgram): string {
  switch (program) {
    case "select_eval":
      return "Select Eval"
    case "select_flex":
      return "Select Flex"
    case "select_daily":
      return "Select Daily"
  }
}

export function defaultTradeifyAccountName(
  accountSize: number,
  program: TradeifyProgram,
): string {
  const k = accountSize >= 1000 ? `${Math.round(accountSize / 1000)}K` : String(accountSize)
  return `Tradeify ${k} ${tradeifyProgramLabel(program)}`
}
