import type { Account } from "@/lib/types"
import { toTradeifySizeKey } from "@/lib/tradeify-rules"
import { getRuleStartingBalance } from "@/lib/account-quantity"

type Tier = { minProfit: number; contracts: string }

const SCALING: Record<ReturnType<typeof toTradeifySizeKey>, Tier[]> = {
  25000: [
    { minProfit: 0, contracts: "1 mini / 10 micros" },
    { minProfit: 1500, contracts: "2 minis / 20 micros" },
  ],
  50000: [
    { minProfit: 0, contracts: "2 minis / 20 micros" },
    { minProfit: 1500, contracts: "3 minis / 30 micros" },
    { minProfit: 2000, contracts: "4 minis / 40 micros" },
  ],
  100000: [
    { minProfit: 0, contracts: "3 minis / 30 micros" },
    { minProfit: 1500, contracts: "4 minis / 40 micros" },
    { minProfit: 2000, contracts: "5 minis / 50 micros" },
    { minProfit: 3000, contracts: "8 minis / 80 micros" },
  ],
  150000: [
    { minProfit: 0, contracts: "3 minis / 30 micros" },
    { minProfit: 1500, contracts: "4 minis / 40 micros" },
    { minProfit: 2000, contracts: "5 minis / 50 micros" },
    { minProfit: 3000, contracts: "8 minis / 80 micros" },
    { minProfit: 4500, contracts: "12 minis / 120 micros" },
  ],
}

export function getTradeifyScalingTier(account: Account, currentBalance: number) {
  if (account.firm !== "Tradeify" || account.type !== "PA") return null

  const profit = currentBalance - getRuleStartingBalance(account)
  const tiers = SCALING[toTradeifySizeKey(account.accountSize)]
  let current = tiers[0]
  let next: Tier | null = tiers[1] ?? null

  for (let i = 0; i < tiers.length; i++) {
    if (profit >= tiers[i].minProfit) {
      current = tiers[i]
      next = tiers[i + 1] ?? null
    }
  }

  return {
    profit,
    currentContracts: current.contracts,
    nextTier: next,
    profitToNext: next ? Math.max(0, next.minProfit - profit) : 0,
  }
}
