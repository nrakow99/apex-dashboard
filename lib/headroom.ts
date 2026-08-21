import type { Account, InstrumentSpec, RiskProfile } from "@/lib/types"
import { findInstrumentSpec } from "@/lib/instrument-specs"

export interface ResolvedRiskProfile {
  symbol: string
  contracts: number
  stopTicks: number
  /** Dollars per tick, from the matched InstrumentSpec. */
  tickValue: number
  label: string
}

export interface Headroom {
  /** max(0, drawdownRemaining) — never negative, matches every other
   *  drawdown-remaining display in the app. */
  dollars: number
  /** null when no complete risk profile resolves (no user default, no
   *  account override, or the symbol isn't in the instrument table) —
   *  the UI must show dollars only, never guess a trade count. */
  trades: number | null
}

type RiskOverrideFields = Pick<Account, "riskSymbol" | "riskContracts" | "riskStopTicks">

/**
 * Resolves the risk profile to use for an account: its own override if
 * complete, else the user-level default, else null.
 *
 * The account override is all-or-nothing by design. A *partial* override
 * (e.g. symbol changed but contracts/stop left at whatever they were) is
 * treated as no override at all rather than silently blended with the
 * user default — mixing an overridden symbol with a stale default contract
 * count would produce a confidently wrong number, which is worse than no
 * number.
 */
export function resolveRiskProfile(
  account: RiskOverrideFields,
  userDefault: RiskProfile | null,
  specs: readonly InstrumentSpec[],
): ResolvedRiskProfile | null {
  const hasAnyOverrideField =
    account.riskSymbol != null || account.riskContracts != null || account.riskStopTicks != null

  let profile: RiskProfile | null = null
  if (hasAnyOverrideField) {
    if (account.riskSymbol && account.riskContracts && account.riskStopTicks) {
      profile = {
        symbol: account.riskSymbol,
        contracts: account.riskContracts,
        riskStopTicks: account.riskStopTicks,
      }
    } else {
      return null
    }
  } else {
    profile = userDefault
  }

  if (!profile || !(profile.contracts > 0) || !(profile.riskStopTicks > 0)) return null

  const spec = findInstrumentSpec(specs, profile.symbol)
  if (!spec) return null

  return {
    symbol: spec.symbol,
    contracts: profile.contracts,
    stopTicks: profile.riskStopTicks,
    tickValue: spec.tickValue,
    label: spec.label,
  }
}

/**
 * Contract count from the same all-or-nothing resolution as
 * resolveRiskProfile, but without requiring the instrument table.
 * Used by bulk trade logging to warn when selected accounts don't share
 * a size — account.quantity is the bundle count of identical cards, not
 * contracts; riskContracts (override) / user default is the real field.
 */
export function resolvedRiskContracts(
  account: RiskOverrideFields,
  userDefault: RiskProfile | null,
): number | null {
  const hasAnyOverrideField =
    account.riskSymbol != null || account.riskContracts != null || account.riskStopTicks != null
  if (hasAnyOverrideField) {
    if (account.riskSymbol && account.riskContracts && account.riskStopTicks && account.riskContracts > 0) {
      return account.riskContracts
    }
    return null
  }
  if (userDefault && userDefault.contracts > 0) return userDefault.contracts
  return null
}

/** True when at least two selected accounts resolve to different contract counts. Unknown/null profiles are ignored — they don't imply a mismatch. */
export function hasMixedRiskContracts(
  accounts: readonly RiskOverrideFields[],
  userDefault: RiskProfile | null,
): boolean {
  const counts = new Set<number>()
  for (const a of accounts) {
    const n = resolvedRiskContracts(a, userDefault)
    if (n != null) counts.add(n)
  }
  return counts.size > 1
}

/** Dollar risk of a single trade at this profile's size/stop. */
export function riskPerTrade(profile: ResolvedRiskProfile): number {
  return profile.contracts * profile.stopTicks * profile.tickValue
}

export function getHeadroom(drawdownRemaining: number, profile: ResolvedRiskProfile | null): Headroom {
  const dollars = Math.max(0, drawdownRemaining)
  if (!profile) return { dollars, trades: null }
  const perTrade = riskPerTrade(profile)
  if (!(perTrade > 0)) return { dollars, trades: null }
  return { dollars, trades: Math.floor(dollars / perTrade) }
}

function fmtDollars(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "$2,411.00 · 6 trades", or just the dollar figure when no profile resolves. */
export function formatHeadroom(headroom: Headroom): string {
  if (headroom.trades == null) return fmtDollars(headroom.dollars)
  return `${fmtDollars(headroom.dollars)} · ${headroom.trades} trade${headroom.trades === 1 ? "" : "s"}`
}

/** " · 6 trades" (or "") for appending to an existing dollar string, e.g.
 *  "$1,200.00 / $2,000.00 · 6 trades". */
export function tradesSuffix(headroom: Headroom): string {
  if (headroom.trades == null) return ""
  return ` · ${headroom.trades} trade${headroom.trades === 1 ? "" : "s"}`
}

/** "A $2,411.00 loss ends this account." — the inverse framing of drawdown
 *  remaining, independent of any risk profile. */
export function lossEndsAccountText(drawdownRemaining: number): string {
  return `A ${fmtDollars(Math.max(0, drawdownRemaining))} loss ends this account.`
}
