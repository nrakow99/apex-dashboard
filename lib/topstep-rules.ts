export type TopstepSizeKey = 50000 | 100000 | 150000

/**
 * Topstep has no 25K tier. A size below 50K is impossible account data, not
 * an edge case to absorb — throw rather than clamp (see toSizeKey/
 * toTradeifySizeKey, which clamp and can silently invent a rule set that
 * doesn't correspond to any real account).
 */
export function toTopstepSizeKey(size: number): TopstepSizeKey {
  if (size < 50000) {
    throw new Error(`Topstep does not offer a ${size} account — the smallest tier is 50K.`)
  }
  if (size <= 50000) return 50000
  if (size <= 100000) return 100000
  return 150000
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

/** Whether the optional Daily Loss Limit was elected at checkout. */
export type TopstepDllElection = "with_dll" | "without_dll"

/**
 * Funded (XFA) payout caps by size and DLL election. NOT WIRED into
 * getAccountRules yet — structure only. Values are TODO pending
 * verification against help.topstep.com; do not fill from any other source.
 */
export const TOPSTEP_FUNDED_PAYOUT_CAP: Record<TopstepSizeKey, Record<TopstepDllElection, number | null>> = {
  50000: { with_dll: null /* TODO: verify */, without_dll: null /* TODO: verify */ },
  100000: { with_dll: null /* TODO: verify */, without_dll: null /* TODO: verify */ },
  150000: { with_dll: null /* TODO: verify */, without_dll: null /* TODO: verify */ },
}
