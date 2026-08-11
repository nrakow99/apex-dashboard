import { describe, it, expect } from "vitest"
import { getPayoutEligibility, calculateAccountStats, getTodayDateStr } from "./storage"
import { getAccountRules } from "./rules"
import type { Account, Trade, Payout } from "./types"

// Golden-file tests for getPayoutEligibility's Topstep XFA and Alpha Futures
// Qualified branches, and the payout-triggered MLL floor lock in
// calculateAccountStats. See lib/rules.ts (Topstep/Alpha PA branches) and
// lib/topstep-rules.ts / lib/alpha-futures-rules.ts for the underlying
// numbers.

type Eligibility = ReturnType<typeof getPayoutEligibility>

/** Narrows the union return type by firm, so `.conditions` etc. resolve to that branch's shape. */
function expectFirm<F extends Eligibility["firm"]>(
  el: Eligibility,
  firm: F,
): Extract<Eligibility, { firm: F }> {
  expect(el.firm).toBe(firm)
  if (el.firm !== firm) throw new Error(`expected firm ${firm}, got ${el.firm}`)
  return el as Extract<Eligibility, { firm: F }>
}

function topstepAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "topstep-1",
    name: "Topstep 50K XFA",
    firm: "Topstep",
    type: "PA",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 50000,
    balance: 50000,
    startingBalance: 50000,
    maxBalance: 50000,
    maxDrawdown: 2000,
    dailyLossLimit: 0,
    topstepPayoutPath: "standard",
    ...overrides,
  }
}

function alphaAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "alpha-1",
    name: "Alpha 25K Zero Qualified",
    firm: "Alpha",
    type: "PA",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 25000,
    balance: 25000,
    startingBalance: 25000,
    maxBalance: 25000,
    maxDrawdown: 1000,
    dailyLossLimit: 0,
    alphaTier: "zero",
    ...overrides,
  }
}

function trade(date: string, pnl: number, accountId: string): Trade {
  return { id: `t-${accountId}-${date}-${pnl}`, date, accountId, symbol: "NQ", pnl }
}

function payout(date: string, amount: number, payoutNumber: number, accountId: string): Payout {
  return { id: `p-${accountId}-${date}-${payoutNumber}`, date, accountId, amount, payoutNumber }
}

describe("Topstep XFA — hasPayouts wiring", () => {
  it("hasPayouts is on and getPayoutEligibility returns a real Topstep-shaped object, not the Apex fallback", () => {
    const account = topstepAccount()
    expect(getAccountRules(account).hasPayouts).toBe(true)
    const el = getPayoutEligibility(account.id, [], account, [])
    expect(el.firm).toBe("Topstep")
  })
})

describe("Topstep XFA — Standard path payout eligibility", () => {
  it("eligible: 5 winning days of $150+, positive cycle profit, first payout exempt from the profitability check", () => {
    const account = topstepAccount()
    const trades = [
      trade("2026-07-01", 300, "topstep-1"),
      trade("2026-07-02", 300, "topstep-1"),
      trade("2026-07-03", 300, "topstep-1"),
      trade("2026-07-04", 300, "topstep-1"),
      trade("2026-07-05", 300, "topstep-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Topstep")
    expect(el.isEligible).toBe(true)
    expect(el.conditions.hasEnoughWinningDays).toBe(true)
    expect(el.conditions.isProfitableSinceLastPayout).toBe(true)
    // balance 50000+1500=51500; 50% = 25750, capped at topstepXfaPayoutCap(50000,"standard",false)=2000
    expect(el.maxWithdrawable).toBe(2000)
    expect(el.traderReceives).toBeCloseTo(1800)
  })

  it("not eligible: only 3 of the required 5 winning days", () => {
    const account = topstepAccount()
    const trades = [
      trade("2026-07-01", 300, "topstep-1"),
      trade("2026-07-02", 300, "topstep-1"),
      trade("2026-07-03", 300, "topstep-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Topstep")
    expect(el.isEligible).toBe(false)
    expect(el.conditions.hasEnoughWinningDays).toBe(false)
    expect(el.missingConditions.some((m) => m.includes("more"))).toBe(true)
  })

  it("first payout is exempt from 'profitable since last payout' — a later request under the same negative-cycle numbers is not", () => {
    const account = topstepAccount()
    const winningDaysThenALoss = [
      trade("2026-07-01", 200, "topstep-1"),
      trade("2026-07-02", 200, "topstep-1"),
      trade("2026-07-03", 200, "topstep-1"),
      trade("2026-07-04", 200, "topstep-1"),
      trade("2026-07-05", 200, "topstep-1"),
      trade("2026-07-06", -1200, "topstep-1"), // net negative for the cycle despite 5 winning days
    ]

    const firstRequest = expectFirm(getPayoutEligibility(account.id, winningDaysThenALoss, account, []), "Topstep")
    expect(firstRequest.conditions.hasEnoughWinningDays).toBe(true)
    expect(firstRequest.conditions.isProfitableSinceLastPayout).toBe(true)
    expect(firstRequest.isEligible).toBe(true)

    // Same trades, but now there's a prior payout dated before all of them —
    // the exemption no longer applies, and the cycle is net negative.
    const priorPayout = [payout("2026-06-01", 500, 1, "topstep-1")]
    const secondRequest = expectFirm(
      getPayoutEligibility(account.id, winningDaysThenALoss, account, priorPayout),
      "Topstep",
    )
    expect(secondRequest.conditions.hasEnoughWinningDays).toBe(true)
    expect(secondRequest.conditions.isProfitableSinceLastPayout).toBe(false)
    expect(secondRequest.isEligible).toBe(false)
    expect(secondRequest.missingConditions).toContain("Not profitable since last payout")
  })

  it("winning-day count restarts after an approved payout — days before the cutoff don't count", () => {
    const account = topstepAccount()
    const trades = [
      trade("2026-06-01", 300, "topstep-1"),
      trade("2026-06-02", 300, "topstep-1"),
      trade("2026-06-03", 300, "topstep-1"),
      trade("2026-06-04", 300, "topstep-1"),
      trade("2026-06-05", 300, "topstep-1"), // 5 winning days before the payout
      trade("2026-06-10", 300, "topstep-1"),
      trade("2026-06-11", 300, "topstep-1"), // only 2 winning days after it
    ]
    const payouts = [payout("2026-06-06", 2000, 1, "topstep-1")]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, payouts), "Topstep")
    expect(el.winningDays).toBe(2)
    expect(el.conditions.hasEnoughWinningDays).toBe(false)
  })

  it("payout amount is 50% of BALANCE capped at topstepXfaPayoutCap — not 50% of cycle profit", () => {
    const account = topstepAccount({
      accountSize: 100000,
      startingBalance: 100000,
      maxBalance: 100000,
      maxDrawdown: 3000,
      hasDailyLossLimit: true,
    })
    const trades = [
      trade("2026-07-01", 8000, "topstep-1"),
      trade("2026-07-02", 500, "topstep-1"),
      trade("2026-07-03", 500, "topstep-1"),
      trade("2026-07-04", 500, "topstep-1"),
      trade("2026-07-05", 500, "topstep-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Topstep")
    // cap = topstepXfaPayoutCap(100000, "standard", true) = 3000 * 2 = 6000
    expect(el.payoutAbsoluteCap).toBe(6000)
    expect(el.maxWithdrawable).toBe(6000)
    expect(el.isEligible).toBe(true)
  })
})

describe("Topstep XFA — Consistency path payout eligibility", () => {
  it("eligible: 3 trading days, largest day <=40% of total net profit", () => {
    const account = topstepAccount({ topstepPayoutPath: "consistency" })
    const trades = [
      trade("2026-07-01", 100, "topstep-1"),
      trade("2026-07-02", 100, "topstep-1"),
      trade("2026-07-03", 100, "topstep-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Topstep")
    expect(el.isEligible).toBe(true)
    expect(el.conditions.hasEnoughTradingDays).toBe(true)
    expect(el.conditions.isConsistent).toBe(true)
  })

  it("not eligible: largest day exceeds 40% of total net profit", () => {
    const account = topstepAccount({ topstepPayoutPath: "consistency" })
    // total=200, largest=100 -> 50% of total, over the 40% cap
    const trades = [
      trade("2026-07-01", 100, "topstep-1"),
      trade("2026-07-02", 50, "topstep-1"),
      trade("2026-07-03", 50, "topstep-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Topstep")
    expect(el.isEligible).toBe(false)
    expect(el.conditions.isConsistent).toBe(false)
    expect(el.missingConditions).toContain("Largest day exceeds 40% of total profit")
  })

  it("not eligible: fewer than 3 trading days since last payout", () => {
    const account = topstepAccount({ topstepPayoutPath: "consistency" })
    const trades = [trade("2026-07-01", 100, "topstep-1"), trade("2026-07-02", -50, "topstep-1")]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Topstep")
    expect(el.isEligible).toBe(false)
    expect(el.conditions.hasEnoughTradingDays).toBe(false)
  })
})

describe("Topstep XFA — MLL resets to breakeven immediately on an approved payout", () => {
  it("floor trails normally (peak - maxDrawdown) when no payout is on record", () => {
    const account = topstepAccount()
    const trades = [trade("2026-07-01", 500, "topstep-1")]
    const stats = calculateAccountStats(account, trades, [])
    // peak 50500, trailing floor = 50500-2000=48500 — below breakeven (50000)
    expect(stats.activeEodFloor).toBe(48500)
  })

  it("floor snaps to breakeven the moment ANY payout lands, independent of peak", () => {
    const account = topstepAccount()
    const trades = [trade("2026-07-01", 500, "topstep-1")]
    const payouts = [payout("2026-07-02", 200, 1, "topstep-1")]
    const stats = calculateAccountStats(account, trades, payouts)
    expect(stats.activeEodFloor).toBe(50000) // breakeven, not the 48500 trailing value
    expect(stats.projectedEodFloor).toBe(50000)
  })

  it("does not affect firms without floorLocksOnPayout — Apex's floor keeps trailing after a payout", () => {
    const account: Account = {
      id: "apex-1",
      name: "Apex 50K PA",
      firm: "Apex",
      type: "PA",
      status: "Active",
      drawdownType: "EOD",
      accountSize: 50000,
      balance: 50000,
      startingBalance: 50000,
      maxBalance: 50000,
      maxDrawdown: 2000,
      dailyLossLimit: 1000,
    }
    const trades = [trade("2026-07-01", 500, "apex-1")]
    const payouts = [payout("2026-07-02", 200, 1, "apex-1")]
    const stats = calculateAccountStats(account, trades, payouts)
    expect(stats.activeEodFloor).toBe(stats.floorPeakBalance - 2000)
  })
})

describe("Alpha Futures Qualified — hasPayouts wiring", () => {
  it("hasPayouts is on and getPayoutEligibility returns a real Alpha-shaped object, not the Apex fallback", () => {
    const account = alphaAccount()
    expect(getAccountRules(account).hasPayouts).toBe(true)
    const el = getPayoutEligibility(account.id, [], account, [])
    expect(el.firm).toBe("Alpha")
  })
})

describe("Alpha Futures Qualified — payout eligibility", () => {
  it("eligible: 5 winning days of $200+, positive cycle profit, consistency within 40%", () => {
    const account = alphaAccount()
    const trades = [
      trade("2026-07-01", 250, "alpha-1"),
      trade("2026-07-02", 250, "alpha-1"),
      trade("2026-07-03", 250, "alpha-1"),
      trade("2026-07-04", 250, "alpha-1"),
      trade("2026-07-05", 250, "alpha-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Alpha")
    expect(el.isEligible).toBe(true)
    expect(el.conditions.hasEnoughWinningDays).toBe(true)
    expect(el.conditions.hasPositiveCycleProfit).toBe(true)
    expect(el.conditions.isConsistent).toBe(true)
    // cycle profit 1250 * 50% = 625, under the $1000 Zero-25K cap
    expect(el.maxWithdrawable).toBe(625)
    expect(el.traderReceives).toBeCloseTo(562.5)
  })

  it("not eligible: only 3 of the required 5 winning days", () => {
    const account = alphaAccount()
    const trades = [
      trade("2026-07-01", 250, "alpha-1"),
      trade("2026-07-02", 250, "alpha-1"),
      trade("2026-07-03", 250, "alpha-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Alpha")
    expect(el.isEligible).toBe(false)
    expect(el.conditions.hasEnoughWinningDays).toBe(false)
  })

  it("not eligible: largest day exceeds 40% of total net profit, even with 5 winning days met", () => {
    const account = alphaAccount()
    // 200,200,200,200,1000 -> total 1800, largest 1000 = 55.6% > 40%
    const trades = [
      trade("2026-07-01", 200, "alpha-1"),
      trade("2026-07-02", 200, "alpha-1"),
      trade("2026-07-03", 200, "alpha-1"),
      trade("2026-07-04", 200, "alpha-1"),
      trade("2026-07-05", 1000, "alpha-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Alpha")
    expect(el.conditions.hasEnoughWinningDays).toBe(true)
    expect(el.conditions.isConsistent).toBe(false)
    expect(el.isEligible).toBe(false)
  })

  it("payoutMaxPercent is applied to cycle profit, not balance (unlike Topstep) — capped at payoutAbsoluteCap", () => {
    const account = alphaAccount({ alphaTier: "advanced", accountSize: 50000, startingBalance: 50000, maxBalance: 50000, maxDrawdown: 1750 })
    // Advanced has no consistency rule and a flat $15,000 cap
    const trades = [
      trade("2026-07-01", 10000, "alpha-1"),
      trade("2026-07-02", 500, "alpha-1"),
      trade("2026-07-03", 500, "alpha-1"),
      trade("2026-07-04", 500, "alpha-1"),
      trade("2026-07-05", 500, "alpha-1"),
    ]
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, []), "Alpha")
    // cycle profit 12000 * 50% = 6000, under the $15,000 Advanced cap
    expect(el.payoutAbsoluteCap).toBe(15000)
    expect(el.maxWithdrawable).toBe(6000)
    expect(el.conditions.isConsistent).toBe(true) // Advanced has hasConsistency=false — vacuously true
    expect(el.isEligible).toBe(true)
  })
})

describe("Alpha Futures Qualified — up to 4 payout requests per calendar month", () => {
  it("blocked once 4 payouts have landed this calendar month, even though trading conditions are otherwise met", () => {
    const account = alphaAccount()
    const ym = getTodayDateStr().slice(0, 7)
    const priorPayouts = [1, 2, 3, 4].map((n) => payout(`${ym}-0${n}`, 300, n, "alpha-1"))
    const trades = [5, 6, 7, 8, 9].map((n) => trade(`${ym}-0${n}`, 250, "alpha-1"))
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, priorPayouts), "Alpha")
    expect(el.conditions.hasEnoughWinningDays).toBe(true)
    expect(el.conditions.hasPositiveCycleProfit).toBe(true)
    expect(el.payoutsThisMonth).toBe(4)
    expect(el.maxPayoutsPerMonth).toBe(4)
    expect(el.conditions.hasPayoutsRemainingThisMonth).toBe(false)
    expect(el.isEligible).toBe(false)
    expect(el.missingConditions).toContain("All 4 payouts this month used")
  })

  it("a 4th request in the same month is still allowed (cap is 'up to 4', not 'up to 3')", () => {
    const account = alphaAccount()
    const ym = getTodayDateStr().slice(0, 7)
    const priorPayouts = [1, 2, 3].map((n) => payout(`${ym}-0${n}`, 300, n, "alpha-1"))
    const trades = [4, 5, 6, 7, 8].map((n) => trade(`${ym}-0${n}`, 250, "alpha-1"))
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, priorPayouts), "Alpha")
    expect(el.payoutsThisMonth).toBe(3)
    expect(el.conditions.hasPayoutsRemainingThisMonth).toBe(true)
    expect(el.isEligible).toBe(true)
  })

  it("resets across the calendar-month boundary — a prior month's payouts don't count toward this month's cap", () => {
    const account = alphaAccount()
    const todayStr = getTodayDateStr()
    const [y, m] = todayStr.slice(0, 7).split("-").map(Number)
    const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
    const thisYm = todayStr.slice(0, 7)
    const priorPayouts = [1, 2, 3, 4].map((n) => payout(`${prevYm}-0${n}`, 300, n, "alpha-1"))
    const trades = [5, 6, 7, 8, 9].map((n) => trade(`${thisYm}-0${n}`, 250, "alpha-1"))
    const el = expectFirm(getPayoutEligibility(account.id, trades, account, priorPayouts), "Alpha")
    expect(el.payoutsThisMonth).toBe(0)
    expect(el.conditions.hasPayoutsRemainingThisMonth).toBe(true)
    expect(el.isEligible).toBe(true)
  })

  it("maxPayoutsPerMonth is wired to 4 on all three Qualified tiers; lifetime maxPayouts stays the inert 99 for all of them", () => {
    for (const alphaTier of ["zero", "standard", "advanced"] as const) {
      const rules = getAccountRules({
        firm: "Alpha",
        type: "PA",
        drawdownType: "EOD",
        accountSize: alphaTier === "zero" ? 25000 : 50000,
        alphaTier,
      })
      expect(rules.maxPayoutsPerMonth, alphaTier).toBe(4)
      expect(rules.maxPayouts, alphaTier).toBe(99)
    }
  })
})

describe("Alpha Futures Qualified — MLL does not reset on payout (positive guard)", () => {
  it("floor keeps trailing normally after a payout — no payout-triggered snap to breakeven", () => {
    const account = alphaAccount()
    const trades = [trade("2026-07-01", 500, "alpha-1")]
    const withoutPayout = calculateAccountStats(account, trades, [])
    const withPayout = calculateAccountStats(account, trades, [payout("2026-07-02", 200, 1, "alpha-1")])
    // peak 25500, trailing floor = 25500-1000=24500 — below breakeven (25000)
    expect(withoutPayout.activeEodFloor).toBe(24500)
    // Unchanged by the payout — Alpha's floorLocksOnPayout stays false
    expect(withPayout.activeEodFloor).toBe(24500)
  })

  it("breakeven lock still engages via peak growth (a different mechanism) — a payout doesn't disable that either", () => {
    const account = alphaAccount()
    // Push peak to/above lockPeakThreshold (26000) so the ordinary trail-then-lock kicks in
    const trades = [trade("2026-07-01", 1500, "alpha-1")] // balance 26500 >= 26000
    const stats = calculateAccountStats(account, trades, [payout("2026-07-02", 200, 1, "alpha-1")])
    expect(stats.activeEodFloor).toBe(25000) // locked at breakeven via peak, not via the payout
  })
})
