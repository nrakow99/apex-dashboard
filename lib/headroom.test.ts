import { describe, it, expect } from "vitest"
import { resolveRiskProfile, resolvedRiskContracts, hasMixedRiskContracts, getHeadroom, formatHeadroom, tradesSuffix, lossEndsAccountText, riskPerTrade } from "@/lib/headroom"
import { BUILTIN_INSTRUMENTS, pointsToTicks, ticksToPoints, findInstrumentSpec } from "@/lib/instrument-specs"
import type { Account, RiskProfile } from "@/lib/types"

function acct(overrides: Partial<Pick<Account, "riskSymbol" | "riskContracts" | "riskStopTicks">>): Pick<
  Account,
  "riskSymbol" | "riskContracts" | "riskStopTicks"
> {
  return { riskSymbol: null, riskContracts: null, riskStopTicks: null, ...overrides }
}

describe("instrument-specs: points/ticks conversion", () => {
  it("NQ: 20 points -> 80 ticks (4 ticks/point) and back", () => {
    const nq = findInstrumentSpec(BUILTIN_INSTRUMENTS, "NQ")!
    const ticks = pointsToTicks(20, nq.tickSize)
    expect(ticks).toBe(80)
    expect(ticksToPoints(ticks, nq.tickSize)).toBe(20)
  })

  it("CL: 0.50 points -> 50 ticks (100 ticks/point)", () => {
    const cl = findInstrumentSpec(BUILTIN_INSTRUMENTS, "CL")!
    expect(pointsToTicks(0.5, cl.tickSize)).toBe(50)
  })

  it("GC: 5 points -> 50 ticks (10 ticks/point)", () => {
    const gc = findInstrumentSpec(BUILTIN_INSTRUMENTS, "GC")!
    expect(pointsToTicks(5, gc.tickSize)).toBe(50)
  })

  it("rounds to the nearest whole tick and echoes back a rounding artifact", () => {
    const nq = findInstrumentSpec(BUILTIN_INSTRUMENTS, "NQ")!
    // 20.1 points isn't a multiple of 0.25 -> rounds to nearest tick (80),
    // echoed-back points (20.00) differ from the raw input (20.1).
    const ticks = pointsToTicks(20.1, nq.tickSize)
    expect(ticks).toBe(80)
    expect(ticksToPoints(ticks, nq.tickSize)).toBe(20)
  })

  it("symbol lookup is case/whitespace insensitive", () => {
    expect(findInstrumentSpec(BUILTIN_INSTRUMENTS, " nq ")?.symbol).toBe("NQ")
    expect(findInstrumentSpec(BUILTIN_INSTRUMENTS, "unknown")).toBeNull()
  })

  it("a user row for a symbol takes precedence over the built-in row", () => {
    const specs = [
      ...BUILTIN_INSTRUMENTS,
      { symbol: "NQ", label: "My NQ override", tickSize: 0.25, tickValue: 999, isBuiltin: false },
    ]
    const match = findInstrumentSpec(specs, "NQ")
    expect(match?.isBuiltin).toBe(false)
    expect(match?.tickValue).toBe(999)
  })
})

describe("headroom: risk profile resolution", () => {
  const userDefault: RiskProfile = { symbol: "NQ", contracts: 2, riskStopTicks: 80 } // 2x, 20pt stop

  it("resolves the user default when the account has no override fields", () => {
    const profile = resolveRiskProfile(acct({}), userDefault, BUILTIN_INSTRUMENTS)
    expect(profile).not.toBeNull()
    expect(profile!.symbol).toBe("NQ")
    expect(profile!.contracts).toBe(2)
    expect(profile!.stopTicks).toBe(80)
    expect(profile!.tickValue).toBe(5.0)
  })

  it("resolves a complete account override, ignoring the user default entirely", () => {
    const profile = resolveRiskProfile(
      acct({ riskSymbol: "GC", riskContracts: 1, riskStopTicks: 50 }),
      userDefault,
      BUILTIN_INSTRUMENTS,
    )
    expect(profile!.symbol).toBe("GC")
    expect(profile!.contracts).toBe(1)
    expect(profile!.stopTicks).toBe(50)
    expect(profile!.tickValue).toBe(10.0)
  })

  it("treats a partial account override as no profile at all — never blends with the default", () => {
    // symbol overridden but contracts/stop left unset: must not fall back to
    // (GC symbol, NQ-default contracts/stop) or to the plain user default.
    const profile = resolveRiskProfile(acct({ riskSymbol: "GC" }), userDefault, BUILTIN_INSTRUMENTS)
    expect(profile).toBeNull()
  })

  it("returns null with no user default and no override", () => {
    expect(resolveRiskProfile(acct({}), null, BUILTIN_INSTRUMENTS)).toBeNull()
  })

  it("returns null when the resolved symbol isn't in the instrument table", () => {
    const profile = resolveRiskProfile(
      acct({}),
      { symbol: "ZB", contracts: 1, riskStopTicks: 10 },
      BUILTIN_INSTRUMENTS,
    )
    expect(profile).toBeNull()
  })

  it("resolvedRiskContracts reads the override / default without needing the instrument table", () => {
    expect(resolvedRiskContracts(acct({}), userDefault)).toBe(2)
    expect(resolvedRiskContracts(acct({ riskSymbol: "GC", riskContracts: 1, riskStopTicks: 50 }), userDefault)).toBe(1)
    expect(resolvedRiskContracts(acct({ riskSymbol: "GC" }), userDefault)).toBeNull()
  })

  it("hasMixedRiskContracts warns only when resolved contract counts actually differ", () => {
    const two = acct({ riskSymbol: "NQ", riskContracts: 2, riskStopTicks: 80 })
    const alsoTwo = acct({ riskSymbol: "MNQ", riskContracts: 2, riskStopTicks: 40 })
    const three = acct({ riskSymbol: "NQ", riskContracts: 3, riskStopTicks: 80 })
    expect(hasMixedRiskContracts([two, alsoTwo], userDefault)).toBe(false)
    expect(hasMixedRiskContracts([two, three], userDefault)).toBe(true)
    expect(hasMixedRiskContracts([acct({}), acct({})], userDefault)).toBe(false)
  })
})

describe("headroom: dollars -> trades", () => {
  const nqProfile = resolveRiskProfile(acct({}), { symbol: "NQ", contracts: 2, riskStopTicks: 80 }, BUILTIN_INSTRUMENTS)!

  it("computes risk-per-trade as contracts x stopTicks x tickValue", () => {
    // 2 contracts x 80 ticks x $5/tick = $800/trade
    expect(riskPerTrade(nqProfile)).toBe(800)
  })

  it("floors partial trades — a trade you can't fully risk doesn't count", () => {
    const headroom = getHeadroom(2411, nqProfile)
    expect(headroom.dollars).toBe(2411)
    expect(headroom.trades).toBe(3) // floor(2411 / 800) = 3
  })

  it("returns trades: null when no profile resolves, dollars-only", () => {
    const headroom = getHeadroom(2411, null)
    expect(headroom.dollars).toBe(2411)
    expect(headroom.trades).toBeNull()
  })

  it("clamps negative drawdown-remaining to 0, same as every other display of it", () => {
    const headroom = getHeadroom(-500, nqProfile)
    expect(headroom.dollars).toBe(0)
    expect(headroom.trades).toBe(0)
  })

  it("formatHeadroom renders the dollars-and-trades string", () => {
    expect(formatHeadroom(getHeadroom(2411, nqProfile))).toBe("$2,411.00 · 3 trades")
  })

  it("formatHeadroom renders dollars only when trades is null", () => {
    expect(formatHeadroom(getHeadroom(2411, null))).toBe("$2,411.00")
  })

  it("tradesSuffix is singular for exactly 1 trade and empty when null", () => {
    // 1 contract, 1 tick, $1 tick value -> $1/trade, so $1 of headroom = 1 trade
    const oneDollarProfile = resolveRiskProfile(
      acct({}),
      { symbol: "MYM", contracts: 1, riskStopTicks: 1 },
      BUILTIN_INSTRUMENTS,
    )!
    expect(tradesSuffix(getHeadroom(0.5, oneDollarProfile))).toBe(" · 1 trade")
    expect(tradesSuffix(getHeadroom(2411, null))).toBe("")
  })

  it("lossEndsAccountText is the inverse framing of drawdown remaining, independent of any risk profile", () => {
    expect(lossEndsAccountText(2411)).toBe("A $2,411.00 loss ends this account.")
    expect(lossEndsAccountText(-10)).toBe("A $0.00 loss ends this account.")
  })
})
