import { describe, it, expect } from "vitest"
import { getAccountRules, resolveTradeifyProgram } from "./rules"
import { toTopstepSizeKey } from "./topstep-rules"
import type { Firm, AccountType, DrawdownType } from "./types"

// Golden-file tests for the rule engine.
//
// IMPORTANT: these values were read out of lib/rules.ts as-is. They lock in
// whatever is currently there. Verify each block against the firm's own rules
// page BEFORE trusting a green run — a stale value that passes is worse than
// a failing test, because it looks correct forever.
//
// Verified against firm site on: 2026-08-11 (Apex EOD PA payout caps / min
// daily profit per apextraderfunding.com/help-center/eod-trailing-drawdown-accounts/eod-payouts/
// — other firms/tables not reverified on this date)
//
// Verified against help.topstep.com on: 2026-08-11 (Eval profit target / Max
// Loss Limit / optional Daily Loss Limit / contract count, all sizes).
// Topstep funded (XFA) payout caps are NOT verified — see
// lib/topstep-rules.ts TOPSTEP_FUNDED_PAYOUT_CAP, left as TODO.

const acct = (
  firm: Firm,
  type: AccountType,
  drawdownType: DrawdownType,
  accountSize: number,
  extra: Record<string, unknown> = {},
) => ({ firm, type, drawdownType, accountSize, ...extra }) as Parameters<typeof getAccountRules>[0]

describe("Apex — Eval", () => {
  it("intraday 50K", () => {
    const r = getAccountRules(acct("Apex", "Eval", "Intraday", 50000))
    expect(r.maxDrawdown).toBe(2000)
    expect(r.profitTarget).toBe(3000)
    expect(r.hasProfitTarget).toBe(true)
    expect(r.hasDLL).toBe(false)
    expect(r.maxContracts).toBe("6 contracts")
  })

  it("EOD 50K carries a daily loss limit, intraday does not", () => {
    const eod = getAccountRules(acct("Apex", "Eval", "EOD", 50000))
    expect(eod.hasDLL).toBe(true)
    expect(eod.dailyLossLimit).toBe(1000)
    expect(eod.maxDrawdown).toBe(2000)
    expect(eod.profitTarget).toBe(3000)
  })

  it("scales across sizes", () => {
    expect(getAccountRules(acct("Apex", "Eval", "Intraday", 25000)).maxDrawdown).toBe(1000)
    expect(getAccountRules(acct("Apex", "Eval", "Intraday", 100000)).maxDrawdown).toBe(3000)
    expect(getAccountRules(acct("Apex", "Eval", "Intraday", 150000)).maxDrawdown).toBe(4000)
    expect(getAccountRules(acct("Apex", "Eval", "Intraday", 150000)).profitTarget).toBe(9000)
  })
})

describe("Apex — PA", () => {
  it("intraday 50K payout ladder", () => {
    const r = getAccountRules(acct("Apex", "PA", "Intraday", 50000))
    expect(r.payoutPolicyKind).toBe("apex_safety_net")
    expect(r.safetyNet).toBe(52100)
    expect(r.minBalanceToRequest).toBe(52600)
    expect(r.payoutCaps).toEqual([1500, 2000, 2500, 2500, 3000, 3000])
    expect(r.maxPayouts).toBe(6)
    expect(r.payoutCaps).toHaveLength(r.maxPayouts)
    expect(r.payoutSplit).toBe(1.0)
    expect(r.hasConsistency).toBe(true)
    expect(r.consistencyPercent).toBe(50)
    expect(r.minDailyProfit).toBe(200)
    expect(r.hasDLL).toBe(false)
  })

  it("EOD 50K differs from intraday on caps, DLL and min daily profit", () => {
    const r = getAccountRules(acct("Apex", "PA", "EOD", 50000))
    expect(r.payoutCaps).toEqual([1500, 1500, 2000, 2500, 2500, 3000])
    expect(r.hasDLL).toBe(true)
    expect(r.dailyLossLimit).toBe(1000)
    expect(r.minDailyProfit).toBe(250)
    expect(r.safetyNet).toBe(52100)
  })

  it("EOD 25K payout caps are flat at 1000, not the tiered intraday ladder", () => {
    const r = getAccountRules(acct("Apex", "PA", "EOD", 25000))
    expect(r.payoutCaps).toEqual([1000, 1000, 1000, 1000, 1000, 1000])
  })

  it("EOD 100K min daily profit is 300, payout #3 caps at 2500", () => {
    const r = getAccountRules(acct("Apex", "PA", "EOD", 100000))
    expect(r.minDailyProfit).toBe(300)
    expect(r.payoutCaps).toEqual([2000, 2500, 2500, 3000, 4000, 4000])
  })

  it("EOD 150K min daily profit is 350, payout #4 caps at 3000", () => {
    const r = getAccountRules(acct("Apex", "PA", "EOD", 150000))
    expect(r.minDailyProfit).toBe(350)
    expect(r.payoutCaps).toEqual([2500, 3000, 3000, 3000, 4000, 5000])
  })

  it("every PA size has caps matching maxPayouts", () => {
    for (const size of [25000, 50000, 100000, 150000]) {
      for (const dd of ["EOD", "Intraday"] as DrawdownType[]) {
        const r = getAccountRules(acct("Apex", "PA", dd, size))
        expect(r.payoutCaps).toHaveLength(r.maxPayouts)
        expect(r.minBalanceToRequest).toBeGreaterThan(r.safetyNet)
      }
    }
  })
})

describe("Lucid", () => {
  it("25K eval target is 1250, not 1500", () => {
    const r = getAccountRules(acct("Lucid", "Eval", "EOD", 25000))
    expect(r.profitTarget).toBe(1250)
    expect(r.maxDrawdown).toBe(1000)
    expect(r.consistencyPercent).toBe(50)
    expect(r.maxContracts).toBe("2 mini / 20 micros")
  })

  it("150K eval drawdown is 4500, not 4000 like Apex", () => {
    expect(getAccountRules(acct("Lucid", "Eval", "EOD", 150000)).maxDrawdown).toBe(4500)
  })

  it("PA uses cycle-profit payouts with a 90/10 split and no consistency", () => {
    const r = getAccountRules(acct("Lucid", "PA", "EOD", 100000))
    expect(r.payoutPolicyKind).toBe("lucid_cycle")
    expect(r.payoutSplit).toBe(0.9)
    expect(r.payoutMaxPercent).toBe(0.5)
    expect(r.payoutAbsoluteCap).toBe(2500)
    expect(r.maxPayouts).toBe(5)
    expect(r.hasConsistency).toBe(false)
    expect(r.lucidFlexFloor).not.toBeNull()
  })

  it("25K PA has no absolute payout cap", () => {
    expect(getAccountRules(acct("Lucid", "PA", "EOD", 25000)).payoutAbsoluteCap).toBe(0)
  })
})

describe("Tradeify", () => {
  it("eval uses a 40 percent consistency rule and 3 minimum days", () => {
    const r = getAccountRules(acct("Tradeify", "Eval", "EOD", 50000))
    expect(r.hasConsistency).toBe(true)
    expect(r.consistencyPercent).toBe(40)
    expect(r.minTradingDays).toBe(3)
    expect(r.payoutPolicyKind).toBe("none")
  })

  it("flex funded has a lock floor and no daily loss limit", () => {
    const r = getAccountRules(acct("Tradeify", "PA", "EOD", 50000, { program: "select_flex" }))
    expect(r.payoutPolicyKind).toBe("tradeify_flex")
    expect(r.hasDLL).toBe(false)
    expect(r.payoutSplit).toBe(0.9)
    expect(r.lucidFlexFloor).not.toBeNull()
  })

  it("daily funded has a daily loss limit and a buffer", () => {
    const r = getAccountRules(acct("Tradeify", "PA", "EOD", 50000, { program: "select_daily" }))
    expect(r.payoutPolicyKind).toBe("tradeify_daily")
    expect(r.hasDLL).toBe(true)
    expect(r.dailyLossLimit).toBeGreaterThan(0)
    expect(r.bufferAmount).toBeGreaterThan(0)
  })

  it("legacy funded rows infer their program from the daily loss limit", () => {
    expect(
      resolveTradeifyProgram({ firm: "Tradeify", type: "PA", program: null, dailyLossLimit: 1000 }),
    ).toBe("select_daily")
    expect(
      resolveTradeifyProgram({ firm: "Tradeify", type: "PA", program: null, dailyLossLimit: 0 }),
    ).toBe("select_flex")
    expect(
      resolveTradeifyProgram({ firm: "Apex", type: "PA", program: null, dailyLossLimit: 0 }),
    ).toBeNull()
  })
})

describe("Topstep — Eval", () => {
  it("50K: $3,000 target / $2,000 MLL / 5 minis, DLL off by default", () => {
    const r = getAccountRules(acct("Topstep", "Eval", "EOD", 50000))
    expect(r.profitTarget).toBe(3000)
    expect(r.maxDrawdown).toBe(2000)
    expect(r.maxContracts).toBe("5 minis")
    expect(r.hasProfitTarget).toBe(true)
    expect(r.floorLabel).toBe("EOD Trailing Max Loss Limit")
    expect(r.hasDLL).toBe(false)
    expect(r.dailyLossLimit).toBe(0)
  })

  it("50K: electing the optional DLL sets it to $1,000", () => {
    const r = getAccountRules(acct("Topstep", "Eval", "EOD", 50000, { hasDailyLossLimit: true }))
    expect(r.hasDLL).toBe(true)
    expect(r.dailyLossLimit).toBe(1000)
    // Electing DLL doesn't change the MLL or profit target.
    expect(r.maxDrawdown).toBe(2000)
    expect(r.profitTarget).toBe(3000)
  })

  it("100K: $6,000 target / $3,000 MLL / $2,000 DLL / 10 minis", () => {
    const r = getAccountRules(acct("Topstep", "Eval", "EOD", 100000, { hasDailyLossLimit: true }))
    expect(r.profitTarget).toBe(6000)
    expect(r.maxDrawdown).toBe(3000)
    expect(r.dailyLossLimit).toBe(2000)
    expect(r.maxContracts).toBe("10 minis")
  })

  it("150K: $9,000 target / $4,500 MLL / $3,000 DLL / 15 minis", () => {
    const r = getAccountRules(acct("Topstep", "Eval", "EOD", 150000, { hasDailyLossLimit: true }))
    expect(r.profitTarget).toBe(9000)
    expect(r.maxDrawdown).toBe(4500)
    expect(r.dailyLossLimit).toBe(3000)
    expect(r.maxContracts).toBe("15 minis")
  })

  it("consistency is 50% of profit target, not 50% of total profit", () => {
    for (const size of [50000, 100000, 150000]) {
      const r = getAccountRules(acct("Topstep", "Eval", "EOD", size))
      expect(r.hasConsistency).toBe(true)
      expect(r.consistencyPercent).toBe(50)
      expect(r.consistencyBasis).toBe("profit_target")
    }
  })
})

describe("Topstep — no 25K tier", () => {
  it("throws for any size under 50K instead of clamping to 50K", () => {
    expect(() => toTopstepSizeKey(25000)).toThrow()
    expect(() => toTopstepSizeKey(49999)).toThrow()
    expect(() => getAccountRules(acct("Topstep", "Eval", "EOD", 25000))).toThrow()
  })

  it("accepts the three real tiers without throwing", () => {
    expect(toTopstepSizeKey(50000)).toBe(50000)
    expect(toTopstepSizeKey(100000)).toBe(100000)
    expect(toTopstepSizeKey(150000)).toBe(150000)
  })

  it("rounds sizes between tiers up to the next tier, same convention as toSizeKey", () => {
    expect(toTopstepSizeKey(75000)).toBe(100000)
    expect(toTopstepSizeKey(120000)).toBe(150000)
  })
})

describe("cross-firm invariants", () => {
  const firms: Firm[] = ["Apex", "Lucid", "Tradeify"]
  const sizes = [25000, 50000, 100000, 150000]

  it("never returns a zero or negative max drawdown", () => {
    for (const firm of firms) {
      for (const type of ["Eval", "PA"] as AccountType[]) {
        for (const dd of ["EOD", "Intraday"] as DrawdownType[]) {
          for (const size of sizes) {
            const r = getAccountRules(acct(firm, type, dd, size))
            expect(r.maxDrawdown, `${firm}/${type}/${dd}/${size}`).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it("evals have a profit target, funded accounts do not", () => {
    for (const firm of firms) {
      for (const size of sizes) {
        expect(getAccountRules(acct(firm, "Eval", "EOD", size)).hasProfitTarget).toBe(true)
        expect(getAccountRules(acct(firm, "PA", "EOD", size)).hasProfitTarget).toBe(false)
      }
    }
  })

  it("consistency percent is zero whenever consistency is off", () => {
    for (const firm of firms) {
      for (const type of ["Eval", "PA"] as AccountType[]) {
        for (const size of sizes) {
          const r = getAccountRules(acct(firm, type, "EOD", size))
          if (!r.hasConsistency) expect(r.consistencyPercent).toBe(0)
          else expect(r.consistencyPercent).toBeGreaterThan(0)
        }
      }
    }
  })

  it("payout split is between 0 and 1", () => {
    for (const firm of firms) {
      for (const size of sizes) {
        const r = getAccountRules(acct(firm, "PA", "EOD", size))
        expect(r.payoutSplit).toBeGreaterThan(0)
        expect(r.payoutSplit).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe("known bug — size clamping", () => {
  it("BUG: 250K silently resolves to the 150K rule set", () => {
    const big = getAccountRules(acct("Apex", "Eval", "Intraday", 250000))
    const oneFifty = getAccountRules(acct("Apex", "Eval", "Intraday", 150000))
    expect(big.maxDrawdown).toBe(oneFifty.maxDrawdown)
    // This test documents current behaviour, it does not endorse it.
    // Fix toSizeKey to either support larger sizes or throw, then invert this.
  })

  it("sizes between tiers round down to the tier below", () => {
    expect(getAccountRules(acct("Apex", "Eval", "Intraday", 75000)).maxDrawdown).toBe(
      getAccountRules(acct("Apex", "Eval", "Intraday", 100000)).maxDrawdown,
    )
  })
})
