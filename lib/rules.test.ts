import { describe, it, expect } from "vitest"
import { getAccountRules, resolveTradeifyProgram } from "./rules"
import { toTopstepSizeKey, TOPSTEP_XFA_BASE_PAYOUT_CAP, topstepXfaPayoutCap } from "./topstep-rules"
import { toAlphaZeroSizeKey, toAlphaMidSizeKey } from "./alpha-futures-rules"
import type { Firm, AccountType, DrawdownType } from "./types"

// Golden-file tests for the rule engine.
//
// IMPORTANT: these values were read out of lib/rules.ts as-is. They lock in
// whatever is currently there. Verify each block against the firm's own rules
// page BEFORE trusting a green run — a stale value that passes is worse than
// a failing test, because it looks correct forever.
//
// Verified against firm site on 2026-08-11:
// - Apex EOD PA payout caps / min daily profit per
//   apextraderfunding.com/help-center/eod-trailing-drawdown-accounts/eod-payouts/
// - Apex EOD Eval daily loss limits per
//   apextraderfunding.com/help-center/eod-trailing-drawdown-accounts/eod-evaluations/
//   — 100K/150K DLL corrected to 1500/2000, was wrongly 2000/3000
// - Apex Intraday Eval (profit target / drawdown / contracts, feeds the
//   Intraday PA maxDrawdown/maxContracts fields) and Apex Intraday PA payout
//   ladder per apextraderfunding.com/help-center — all four ladder sizes
//   diffed against the official table and matched exactly, no correction needed
// - Lucid LucidFlex Payouts per
//   support.lucidtrading.com/en/articles/12945796-lucidflex-payouts —
//   25K minDailyProfit corrected 150→100 and payoutAbsoluteCap corrected
//   0→1000 (was effectively uncapped; should be flat $1000 like every other
//   size, not a scaling ladder). 50K/100K/150K already matched.
// - Lucid Eval profit target and drawdown — all four sizes matched, no
//   correction needed
// - Tradeify Select Evaluation Accounts per
//   help.tradeify.co/en/articles/12853921-select-evaluation-accounts —
//   Select Eval profit target/drawdown/contracts (4 sizes) and Select Flex
//   payout caps (4 sizes) and Select Daily payout caps/DLL/buffer (4 sizes
//   × 3 fields) all matched exactly, no correction needed. One bug found:
//   TRADEIFY_FLEX 25K lockPeakThreshold was 26600 (implied a $1500
//   drawdown that doesn't exist anywhere), corrected to 26100 (25000 start
//   + 1000 drawdown + 100, per "locks $100 above start once EOD balance
//   exceeds drawdown+100" — the other 11 lock thresholds across Flex/Daily
//   already satisfied that formula). NOT reverified this pass: Select
//   Daily's own maxDrawdown (2500/3500 at 100K/150K, differs from Eval's
//   3000/4500) — wasn't part of the verified numbers given, and the source
//   page today was Evaluation Accounts, not the funded/Daily page.
//
// — other firms/tables not reverified on this date
//
// Verified against help.topstep.com on: 2026-08-11, including
// help.topstep.com/en/articles/8284233 for XFA payout policy (Eval profit
// target / Max Loss Limit / optional Daily Loss Limit / contract count, all
// sizes; XFA base payout ceilings per size+path, the 2x-on-DLL rule, 90/10
// split, $125 min payout, MLL start/lock shape). Topstep changed the payout
// grid 2026-04-28 — reverify TOPSTEP_XFA_BASE_PAYOUT_CAP if it's been a
// while since this date.
//
// Verified against help.alpha-futures.com on: 2026-08-11 (Zero/Standard/
// Advanced Account Overview, Maximum Loss Limit, Daily Loss Guard,
// Consistency Rule, Payout Policy articles — see lib/alpha-futures-rules.ts
// for per-article links). One exception: Standard-qualified DLG dollar
// figures ($1,000/$2,000/$3,000) were pulled directly off the Standard
// Account Overview page during this verification pass rather than supplied
// pre-verified like the rest of this block — flagged in
// lib/alpha-futures-rules.ts, worth an independent second look.

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

  it("EOD daily loss limit does NOT scale 1:1 with drawdown at 100K/150K", () => {
    // 100K/150K DLL is 1500/2000, not the naively-scaled 2000/3000 — the
    // ratio to maxDrawdown/profitTarget breaks at these two sizes, unlike
    // 25K/50K where DLL happens to equal maxDrawdown ÷ 2.
    const eod25 = getAccountRules(acct("Apex", "Eval", "EOD", 25000))
    const eod50 = getAccountRules(acct("Apex", "Eval", "EOD", 50000))
    const eod100 = getAccountRules(acct("Apex", "Eval", "EOD", 100000))
    const eod150 = getAccountRules(acct("Apex", "Eval", "EOD", 150000))
    expect(eod25.dailyLossLimit).toBe(500)
    expect(eod50.dailyLossLimit).toBe(1000)
    expect(eod100.dailyLossLimit).toBe(1500)
    expect(eod150.dailyLossLimit).toBe(2000)
    // Drawdown and profit target are untouched by this fix.
    expect(eod100.maxDrawdown).toBe(3000)
    expect(eod100.profitTarget).toBe(6000)
    expect(eod150.maxDrawdown).toBe(4000)
    expect(eod150.profitTarget).toBe(9000)
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

  it("intraday PA payout ladder matches the verified table at every size", () => {
    // Diffed against Apex's official Intraday Payouts table 2026-08-11 —
    // all four sizes matched exactly, no correction needed. Locking that in.
    const a = (size: number) => getAccountRules(acct("Apex", "PA", "Intraday", size)).payoutCaps
    expect(a(25000)).toEqual([1000, 1000, 1000, 1000, 1000, 1000])
    expect(a(50000)).toEqual([1500, 2000, 2500, 2500, 3000, 3000])
    expect(a(100000)).toEqual([2000, 2500, 3000, 3000, 4000, 4000])
    expect(a(150000)).toEqual([2500, 3000, 3000, 4000, 4000, 5000])
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

  it("LucidFlex PA payout ladder matches the verified table at every size", () => {
    // Diffed against support.lucidtrading.com/en/articles/12945796 on
    // 2026-08-11. 25K was wrong on both fields — minDailyProfit was 150
    // (should be 100) and payoutAbsoluteCap was 0/uncapped (should be
    // 1000, flat, same as every other size — not a scaling ladder).
    // 50K/100K/150K already matched exactly.
    const a = (size: number) => getAccountRules(acct("Lucid", "PA", "EOD", size))
    expect(a(25000).minDailyProfit).toBe(100)
    expect(a(25000).payoutAbsoluteCap).toBe(1000)
    expect(a(50000).minDailyProfit).toBe(150)
    expect(a(50000).payoutAbsoluteCap).toBe(2000)
    expect(a(100000).minDailyProfit).toBe(200)
    expect(a(100000).payoutAbsoluteCap).toBe(2500)
    expect(a(150000).minDailyProfit).toBe(250)
    expect(a(150000).payoutAbsoluteCap).toBe(3000)
    for (const size of [25000, 50000, 100000, 150000]) {
      const r = getAccountRules(acct("Lucid", "PA", "EOD", size))
      expect(r.maxPayouts).toBe(5)
      expect(r.minPayoutAmount).toBe(500)
      expect(r.payoutSplit).toBe(0.9)
      expect(r.payoutMaxPercent).toBe(0.5)
    }
  })

  it("Lucid Eval profit target and drawdown match the verified table at every size", () => {
    // Diffed against the same verification pass — all four sizes already
    // matched, no correction needed.
    const a = (size: number) => getAccountRules(acct("Lucid", "Eval", "EOD", size))
    expect(a(25000).profitTarget).toBe(1250)
    expect(a(25000).maxDrawdown).toBe(1000)
    expect(a(50000).profitTarget).toBe(3000)
    expect(a(50000).maxDrawdown).toBe(2000)
    expect(a(100000).profitTarget).toBe(6000)
    expect(a(100000).maxDrawdown).toBe(3000)
    expect(a(150000).profitTarget).toBe(9000)
    expect(a(150000).maxDrawdown).toBe(4500)
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

  it("Select Eval profit target / drawdown / contracts match the verified table at every size", () => {
    // Diffed against help.tradeify.co/en/articles/12853921 on 2026-08-11.
    // All four sizes already matched exactly, no correction needed.
    const a = (size: number) => getAccountRules(acct("Tradeify", "Eval", "EOD", size))
    expect(a(25000).profitTarget).toBe(1500)
    expect(a(25000).maxDrawdown).toBe(1000)
    expect(a(25000).maxContracts).toBe("1 mini / 10 micros")
    expect(a(50000).profitTarget).toBe(3000)
    expect(a(50000).maxDrawdown).toBe(2000)
    expect(a(50000).maxContracts).toBe("4 minis / 40 micros")
    expect(a(100000).profitTarget).toBe(6000)
    expect(a(100000).maxDrawdown).toBe(3000)
    expect(a(100000).maxContracts).toBe("8 minis / 80 micros")
    expect(a(150000).profitTarget).toBe(9000)
    expect(a(150000).maxDrawdown).toBe(4500)
    expect(a(150000).maxContracts).toBe("12 minis / 120 micros")
    for (const size of [25000, 50000, 100000, 150000]) {
      const r = getAccountRules(acct("Tradeify", "Eval", "EOD", size))
      expect(r.hasDLL).toBe(false)
    }
  })

  it("flex funded has a lock floor and no daily loss limit", () => {
    const r = getAccountRules(acct("Tradeify", "PA", "EOD", 50000, { program: "select_flex" }))
    expect(r.payoutPolicyKind).toBe("tradeify_flex")
    expect(r.hasDLL).toBe(false)
    expect(r.payoutSplit).toBe(0.9)
    expect(r.lucidFlexFloor).not.toBeNull()
  })

  it("Select Flex payout caps match the verified table; no DLL, no funded consistency", () => {
    // Diffed against help.tradeify.co/en/articles/12853921 on 2026-08-11.
    // All four payout caps already matched. No changes to those.
    const a = (size: number) => getAccountRules(acct("Tradeify", "PA", "EOD", size, { program: "select_flex" }))
    expect(a(25000).payoutAbsoluteCap).toBe(1250)
    expect(a(50000).payoutAbsoluteCap).toBe(3000)
    expect(a(100000).payoutAbsoluteCap).toBe(4000)
    expect(a(150000).payoutAbsoluteCap).toBe(5000)
    for (const size of [25000, 50000, 100000, 150000]) {
      const r = getAccountRules(acct("Tradeify", "PA", "EOD", size, { program: "select_flex" }))
      expect(r.hasDLL).toBe(false)
      expect(r.bufferAmount).toBe(0)
      expect(r.hasConsistency).toBe(false)
      expect(r.payoutSplit).toBe(0.9)
    }
  })

  it("Flex 25K lock threshold was wrong — locks at $100 above starting balance once EOD balance exceeds drawdown+100", () => {
    // Bug found this pass: lockPeakThreshold was 26600 (implied a $1500
    // drawdown), corrected to 26100 (25000 start + 1000 drawdown + 100).
    // 50K/100K/150K already satisfied this formula exactly.
    const r = getAccountRules(acct("Tradeify", "PA", "EOD", 25000, { program: "select_flex" }))
    expect(r.lucidFlexFloor?.lockedFloor).toBe(25100)
    expect(r.lucidFlexFloor?.lockPeakThreshold).toBe(26100)
  })

  it("daily funded has a daily loss limit and a buffer", () => {
    const r = getAccountRules(acct("Tradeify", "PA", "EOD", 50000, { program: "select_daily" }))
    expect(r.payoutPolicyKind).toBe("tradeify_daily")
    expect(r.hasDLL).toBe(true)
    expect(r.dailyLossLimit).toBeGreaterThan(0)
    expect(r.bufferAmount).toBeGreaterThan(0)
  })

  it("Select Daily payout caps / DLL / buffer match the verified table at every size", () => {
    // Diffed against help.tradeify.co/en/articles/12853921 on 2026-08-11.
    // All twelve values (4 sizes × 3 fields) already matched exactly.
    const a = (size: number) => getAccountRules(acct("Tradeify", "PA", "EOD", size, { program: "select_daily" }))
    expect(a(25000).payoutAbsoluteCap).toBe(600)
    expect(a(25000).dailyLossLimit).toBe(500)
    expect(a(25000).bufferAmount).toBe(1100)
    expect(a(50000).payoutAbsoluteCap).toBe(1000)
    expect(a(50000).dailyLossLimit).toBe(1000)
    expect(a(50000).bufferAmount).toBe(2100)
    expect(a(100000).payoutAbsoluteCap).toBe(1500)
    expect(a(100000).dailyLossLimit).toBe(1250)
    expect(a(100000).bufferAmount).toBe(2600)
    expect(a(150000).payoutAbsoluteCap).toBe(2500)
    expect(a(150000).dailyLossLimit).toBe(1750)
    expect(a(150000).bufferAmount).toBe(3600)
    for (const size of [25000, 50000, 100000, 150000]) {
      const r = getAccountRules(acct("Tradeify", "PA", "EOD", size, { program: "select_daily" }))
      expect(r.hasConsistency).toBe(false)
      expect(r.payoutSplit).toBe(0.9)
    }
  })

  it("Daily lock thresholds all satisfy: locks $100 above start once EOD balance exceeds drawdown+100", () => {
    // Daily's own maxDrawdown differs from Eval's at 100K/150K (2500/3500
    // vs 3000/4500) — that wasn't part of this pass's verified numbers, not
    // touched, but flagging: worth checking against the funded/Daily-specific
    // help page directly, since today's source was the Evaluation page.
    const a = (size: number) => getAccountRules(acct("Tradeify", "PA", "EOD", size, { program: "select_daily" }))
    expect(a(25000).lucidFlexFloor?.lockedFloor).toBe(25100)
    expect(a(25000).lucidFlexFloor?.lockPeakThreshold).toBe(26100)
    expect(a(50000).lucidFlexFloor?.lockedFloor).toBe(50100)
    expect(a(50000).lucidFlexFloor?.lockPeakThreshold).toBe(52100)
    expect(a(100000).lucidFlexFloor?.lockedFloor).toBe(100100)
    expect(a(100000).lucidFlexFloor?.lockPeakThreshold).toBe(102600)
    expect(a(150000).lucidFlexFloor?.lockedFloor).toBe(150100)
    expect(a(150000).lucidFlexFloor?.lockPeakThreshold).toBe(153600)
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

describe("Topstep — XFA (funded) structure", () => {
  it("cap table is a single ceiling per (size, path), not a per-payout array", () => {
    for (const size of [50000, 100000, 150000] as const) {
      for (const path of ["standard", "consistency"] as const) {
        expect(Array.isArray(TOPSTEP_XFA_BASE_PAYOUT_CAP[size][path])).toBe(false)
        expect(typeof TOPSTEP_XFA_BASE_PAYOUT_CAP[size][path]).toBe("number")
      }
    }
  })

  it("all 6 base ceilings match help.topstep.com/en/articles/8284233", () => {
    expect(TOPSTEP_XFA_BASE_PAYOUT_CAP[50000].standard).toBe(2000)
    expect(TOPSTEP_XFA_BASE_PAYOUT_CAP[50000].consistency).toBe(3000)
    expect(TOPSTEP_XFA_BASE_PAYOUT_CAP[100000].standard).toBe(3000)
    expect(TOPSTEP_XFA_BASE_PAYOUT_CAP[100000].consistency).toBe(4000)
    expect(TOPSTEP_XFA_BASE_PAYOUT_CAP[150000].standard).toBe(5000)
    expect(TOPSTEP_XFA_BASE_PAYOUT_CAP[150000].consistency).toBe(6000)
  })

  it("electing the DLL exactly doubles the ceiling", () => {
    expect(topstepXfaPayoutCap(50000, "standard", false)).toBe(2000)
    expect(topstepXfaPayoutCap(50000, "standard", true)).toBe(4000)
    expect(topstepXfaPayoutCap(150000, "consistency", false)).toBe(6000)
    expect(topstepXfaPayoutCap(150000, "consistency", true)).toBe(12000)
  })

  it("getAccountRules resolves the doubled cap into payoutAbsoluteCap when DLL is elected", () => {
    const withoutDll = getAccountRules(
      acct("Topstep", "PA", "EOD", 100000, { topstepPayoutPath: "consistency" }),
    )
    const withDll = getAccountRules(
      acct("Topstep", "PA", "EOD", 100000, { topstepPayoutPath: "consistency", hasDailyLossLimit: true }),
    )
    expect(withoutDll.payoutAbsoluteCap).toBe(4000)
    expect(withDll.payoutAbsoluteCap).toBe(8000)
  })

  it("hasPayouts is on — getPayoutEligibility has a dedicated topstep_xfa branch now", () => {
    for (const path of ["standard", "consistency"] as const) {
      const r = getAccountRules(acct("Topstep", "PA", "EOD", 50000, { topstepPayoutPath: path }))
      expect(r.hasPayouts).toBe(true)
    }
  })

  it("floorLocksOnPayout is on — MLL locks at breakeven immediately on any approved payout", () => {
    for (const path of ["standard", "consistency"] as const) {
      const r = getAccountRules(acct("Topstep", "PA", "EOD", 50000, { topstepPayoutPath: path }))
      expect(r.floorLocksOnPayout).toBe(true)
    }
  })

  it("90/10 split and $125 minimum payout are wired regardless of path", () => {
    const r = getAccountRules(acct("Topstep", "PA", "EOD", 100000, { topstepPayoutPath: "standard" }))
    expect(r.payoutSplit).toBe(0.9)
    expect(r.minPayoutAmount).toBe(125)
    expect(r.payoutPolicyKind).toBe("topstep_xfa")
  })

  it("Standard path: 5 winning days of $150+; Consistency path: 3 trading days instead", () => {
    const standard = getAccountRules(acct("Topstep", "PA", "EOD", 50000, { topstepPayoutPath: "standard" }))
    expect(standard.minProfitDays).toBe(5)
    expect(standard.minDailyProfit).toBe(150)

    const consistency = getAccountRules(acct("Topstep", "PA", "EOD", 50000, { topstepPayoutPath: "consistency" }))
    expect(consistency.minTradingDays).toBe(3)
  })

  it("MLL starts at size − maxDrawdown and locks at breakeven (size), same shape as LucidFlex", () => {
    const r = getAccountRules(acct("Topstep", "PA", "EOD", 150000, { topstepPayoutPath: "standard" }))
    expect(r.maxDrawdown).toBe(4500)
    expect(r.lucidFlexFloor).not.toBeNull()
    expect(r.lucidFlexFloor?.minimumFloor).toBe(150000 - 4500)
    expect(r.lucidFlexFloor?.lockPeakThreshold).toBe(150000 + 4500)
    expect(r.lucidFlexFloor?.lockedFloor).toBe(150000)
  })

  it("funded MLL reuses the same $ figures as Eval for each size", () => {
    expect(getAccountRules(acct("Topstep", "PA", "EOD", 50000)).maxDrawdown).toBe(2000)
    expect(getAccountRules(acct("Topstep", "PA", "EOD", 100000)).maxDrawdown).toBe(3000)
    expect(getAccountRules(acct("Topstep", "PA", "EOD", 150000)).maxDrawdown).toBe(4500)
  })
})

describe("Topstep — XFA dual consistencyBasis (differs from Eval)", () => {
  it("Consistency path: 40% of total net profit, not 50% of a fixed target", () => {
    const r = getAccountRules(acct("Topstep", "PA", "EOD", 50000, { topstepPayoutPath: "consistency" }))
    expect(r.hasConsistency).toBe(true)
    expect(r.consistencyPercent).toBe(40)
    expect(r.consistencyBasis).toBe("total_profit")
  })

  it("Standard path: no consistency rule at all", () => {
    const r = getAccountRules(acct("Topstep", "PA", "EOD", 50000, { topstepPayoutPath: "standard" }))
    expect(r.hasConsistency).toBe(false)
    expect(r.consistencyPercent).toBe(0)
  })

  it("unset path defaults to Standard (no consistency claim without an explicit election)", () => {
    const r = getAccountRules(acct("Topstep", "PA", "EOD", 50000))
    expect(r.hasConsistency).toBe(false)
  })

  it("Eval and XFA-Consistency use different bases on the same firm: profit_target vs total_profit", () => {
    const eval_ = getAccountRules(acct("Topstep", "Eval", "EOD", 50000))
    const xfa = getAccountRules(acct("Topstep", "PA", "EOD", 50000, { topstepPayoutPath: "consistency" }))
    expect(eval_.consistencyBasis).toBe("profit_target")
    expect(xfa.consistencyBasis).toBe("total_profit")
    expect(eval_.consistencyPercent).toBe(50)
    expect(xfa.consistencyPercent).toBe(40)
  })
})

describe("Topstep — no 25K tier", () => {
  it("throws for any size under 50K instead of clamping to 50K", () => {
    expect(() => toTopstepSizeKey(25000)).toThrow()
    expect(() => toTopstepSizeKey(49999)).toThrow()
    expect(() => getAccountRules(acct("Topstep", "Eval", "EOD", 25000))).toThrow()
    expect(() => getAccountRules(acct("Topstep", "PA", "EOD", 25000))).toThrow()
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

describe("Alpha Futures — tier tables (rule variants, not size variants)", () => {
  it("Zero (25K/50K/100K): target/MLL/DLG match the verified table", () => {
    const a = (size: number) => getAccountRules(acct("Alpha", "Eval", "EOD", size, { alphaTier: "zero" }))
    expect(a(25000).profitTarget).toBe(1500)
    expect(a(25000).maxDrawdown).toBe(1000)
    expect(a(25000).dailyLossLimit).toBe(500)
    expect(a(50000).profitTarget).toBe(3000)
    expect(a(50000).maxDrawdown).toBe(2000)
    expect(a(50000).dailyLossLimit).toBe(1000)
    expect(a(100000).profitTarget).toBe(6000)
    expect(a(100000).maxDrawdown).toBe(3000)
    expect(a(100000).dailyLossLimit).toBe(2000)
    // DLG active on eval for every Zero size
    expect(a(25000).hasDLL).toBe(true)
    expect(a(50000).hasDLL).toBe(true)
    expect(a(100000).hasDLL).toBe(true)
  })

  it("Standard (50K/100K/150K): target/MLL match the verified table, no DLG on eval", () => {
    const a = (size: number) => getAccountRules(acct("Alpha", "Eval", "EOD", size, { alphaTier: "standard" }))
    expect(a(50000).profitTarget).toBe(3000)
    expect(a(50000).maxDrawdown).toBe(2000)
    expect(a(100000).profitTarget).toBe(6000)
    expect(a(100000).maxDrawdown).toBe(3000)
    expect(a(150000).profitTarget).toBe(9000)
    expect(a(150000).maxDrawdown).toBe(4500)
    expect(a(50000).hasDLL).toBe(false)
    expect(a(100000).hasDLL).toBe(false)
    expect(a(150000).hasDLL).toBe(false)
  })

  it("Advanced (50K/100K/150K): target/MLL match the verified table, no DLG anywhere", () => {
    const a = (size: number) => getAccountRules(acct("Alpha", "Eval", "EOD", size, { alphaTier: "advanced" }))
    expect(a(50000).profitTarget).toBe(4000)
    expect(a(50000).maxDrawdown).toBe(1750)
    expect(a(100000).profitTarget).toBe(8000)
    expect(a(100000).maxDrawdown).toBe(3500)
    expect(a(150000).profitTarget).toBe(12000)
    expect(a(150000).maxDrawdown).toBe(5250)
    expect(a(50000).hasDLL).toBe(false)

    const q = getAccountRules(acct("Alpha", "PA", "EOD", 50000, { alphaTier: "advanced" }))
    expect(q.hasDLL).toBe(false)
    expect(q.hasScaling).toBe(false)
  })

  it("Qualified payout ceilings and min withdrawal amounts match the verified table", () => {
    const zero = (size: number) => getAccountRules(acct("Alpha", "PA", "EOD", size, { alphaTier: "zero" }))
    expect(zero(25000).payoutAbsoluteCap).toBe(1000)
    expect(zero(50000).payoutAbsoluteCap).toBe(1500)
    expect(zero(100000).payoutAbsoluteCap).toBe(2500)
    expect(zero(25000).minPayoutAmount).toBe(200)

    const standard = (size: number) => getAccountRules(acct("Alpha", "PA", "EOD", size, { alphaTier: "standard" }))
    expect(standard(50000).payoutAbsoluteCap).toBe(3000)
    expect(standard(100000).payoutAbsoluteCap).toBe(4000)
    expect(standard(150000).payoutAbsoluteCap).toBe(5000)
    expect(standard(50000).minPayoutAmount).toBe(500)

    const advanced = (size: number) => getAccountRules(acct("Alpha", "PA", "EOD", size, { alphaTier: "advanced" }))
    expect(advanced(50000).payoutAbsoluteCap).toBe(15000)
    expect(advanced(100000).payoutAbsoluteCap).toBe(15000)
    expect(advanced(150000).payoutAbsoluteCap).toBe(15000)
    expect(advanced(50000).minPayoutAmount).toBe(1000)
  })

  it("90/10 split is flat across every tier and size, not tiered", () => {
    for (const tier of ["zero", "standard", "advanced"] as const) {
      const size = tier === "zero" ? 50000 : 100000
      expect(getAccountRules(acct("Alpha", "PA", "EOD", size, { alphaTier: tier })).payoutSplit).toBe(0.9)
    }
  })
})

describe("Alpha Futures — per-tier size keys throw on impossible combos", () => {
  it("25K throws on Standard and Advanced (Zero-only size)", () => {
    expect(() => toAlphaMidSizeKey("standard", 25000)).toThrow()
    expect(() => toAlphaMidSizeKey("advanced", 25000)).toThrow()
    expect(() => getAccountRules(acct("Alpha", "Eval", "EOD", 25000, { alphaTier: "standard" }))).toThrow()
    expect(() => getAccountRules(acct("Alpha", "Eval", "EOD", 25000, { alphaTier: "advanced" }))).toThrow()
  })

  it("150K throws on Zero (Zero has no 150K tier)", () => {
    expect(() => toAlphaZeroSizeKey(150000)).toThrow()
    expect(() => getAccountRules(acct("Alpha", "Eval", "EOD", 150000, { alphaTier: "zero" }))).toThrow()
    expect(() => getAccountRules(acct("Alpha", "PA", "EOD", 150000, { alphaTier: "zero" }))).toThrow()
  })

  it("no rounding/clamping between tiers — an in-between size throws rather than snapping to a neighbor", () => {
    expect(() => toAlphaZeroSizeKey(75000)).toThrow()
    expect(() => toAlphaMidSizeKey("standard", 75000)).toThrow()
  })

  it("each tier accepts exactly its own three sizes", () => {
    expect(toAlphaZeroSizeKey(25000)).toBe(25000)
    expect(toAlphaZeroSizeKey(50000)).toBe(50000)
    expect(toAlphaZeroSizeKey(100000)).toBe(100000)
    expect(toAlphaMidSizeKey("standard", 50000)).toBe(50000)
    expect(toAlphaMidSizeKey("standard", 150000)).toBe(150000)
    expect(toAlphaMidSizeKey("advanced", 150000)).toBe(150000)
  })

  it("throws if alphaTier is unset for an Alpha account — no safe default across tiers", () => {
    expect(() => getAccountRules(acct("Alpha", "Eval", "EOD", 50000))).toThrow()
  })
})

describe("Alpha Futures — consistency varies by tier AND stage", () => {
  it("Zero: none on eval, 40% on qualified", () => {
    const evalRules = getAccountRules(acct("Alpha", "Eval", "EOD", 50000, { alphaTier: "zero" }))
    expect(evalRules.hasConsistency).toBe(false)

    const qualifiedRules = getAccountRules(acct("Alpha", "PA", "EOD", 50000, { alphaTier: "zero" }))
    expect(qualifiedRules.hasConsistency).toBe(true)
    expect(qualifiedRules.consistencyPercent).toBe(40)
    expect(qualifiedRules.consistencyBasis).toBe("total_profit")
  })

  it("Standard: 50% on eval, 40% on qualified — both total_profit, not profit_target", () => {
    const evalRules = getAccountRules(acct("Alpha", "Eval", "EOD", 50000, { alphaTier: "standard" }))
    expect(evalRules.hasConsistency).toBe(true)
    expect(evalRules.consistencyPercent).toBe(50)
    expect(evalRules.consistencyBasis).toBe("total_profit")

    const qualifiedRules = getAccountRules(acct("Alpha", "PA", "EOD", 50000, { alphaTier: "standard" }))
    expect(qualifiedRules.hasConsistency).toBe(true)
    expect(qualifiedRules.consistencyPercent).toBe(40)
    expect(qualifiedRules.consistencyBasis).toBe("total_profit")
  })

  it("Advanced: 40% on eval, none on qualified", () => {
    const evalRules = getAccountRules(acct("Alpha", "Eval", "EOD", 50000, { alphaTier: "advanced" }))
    expect(evalRules.hasConsistency).toBe(true)
    expect(evalRules.consistencyPercent).toBe(40)
    expect(evalRules.consistencyBasis).toBe("total_profit")

    const qualifiedRules = getAccountRules(acct("Alpha", "PA", "EOD", 50000, { alphaTier: "advanced" }))
    expect(qualifiedRules.hasConsistency).toBe(false)
  })

  it("no cell uses profit_target basis — confirmed against the Consistency Rule article, not assumed", () => {
    const combos: Array<[Parameters<typeof getAccountRules>[0]["alphaTier"], AccountType]> = [
      ["zero", "PA"],
      ["standard", "Eval"],
      ["standard", "PA"],
      ["advanced", "Eval"],
    ]
    for (const [alphaTier, type] of combos) {
      const r = getAccountRules(acct("Alpha", type, "EOD", 50000, { alphaTier }))
      expect(r.hasConsistency, `${alphaTier}/${type}`).toBe(true)
      expect(r.consistencyBasis, `${alphaTier}/${type}`).toBe("total_profit")
    }
  })
})

describe("Alpha Futures — MLL does not reset on payout (positive guard)", () => {
  it("floorLocksOnPayout is explicitly false on every qualified tier, not just inherited from the default", () => {
    for (const tier of ["zero", "standard", "advanced"] as const) {
      const r = getAccountRules(acct("Alpha", "PA", "EOD", 50000, { alphaTier: tier }))
      expect(r.floorLocksOnPayout).toBe(false)
    }
  })

  it("MLL still locks at breakeven via peak growth (a different mechanism) — trail/lock shape is present", () => {
    const r = getAccountRules(acct("Alpha", "PA", "EOD", 100000, { alphaTier: "standard" }))
    expect(r.lucidFlexFloor).not.toBeNull()
    expect(r.lucidFlexFloor?.lockedFloor).toBe(100000) // breakeven = account size
    expect(r.lucidFlexFloor?.lockPeakThreshold).toBe(100000 + 3000)
    expect(r.lucidFlexFloor?.minimumFloor).toBe(100000 - 3000)
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
