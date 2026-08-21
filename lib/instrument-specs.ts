import type { InstrumentSpec } from "@/lib/types"

/**
 * Built-in instrument table — narrow and verified rather than broad and
 * guessed. A wrong tick value produces a wrong headroom number, the same
 * failure class as a wrong rule value, so this starts at 12 confirmed
 * entries instead of a larger unverified list.
 *
 * Source: CME Group's own contract spec pages (cmegroup.com) for
 * NQ/MNQ/ES/MES, cross-checked against CME's published Micro E-mini FAQ and
 * independent contract-spec references (NinjaTrader, Barchart) for
 * YM/MYM/RTY/M2K/CL/MCL/GC/MGC. Verified 2026-08-20.
 *
 * Exchange contract specs — unlike prop-firm rules — effectively never
 * change, so a dated snapshot is sufficient; there's no re-verification
 * cadence here the way there is for lib/rules.ts.
 *
 * This mirrors the seed in supabase/migrations/20260820120000_headroom_risk_profile.sql
 * and exists so the app has a correct instrument list even before that
 * fetch resolves, and so lib/headroom.test.ts can run fully offline. The
 * database (built-ins + user rows) is the actual source of truth at
 * runtime — see fetchInstrumentSpecs in lib/supabase/database.ts.
 */
export const BUILTIN_INSTRUMENTS: readonly InstrumentSpec[] = [
  { symbol: "NQ", label: "E-mini Nasdaq-100", tickSize: 0.25, tickValue: 5.0, source: "CME Group contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "MNQ", label: "Micro E-mini Nasdaq-100", tickSize: 0.25, tickValue: 0.5, source: "CME Group contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "ES", label: "E-mini S&P 500", tickSize: 0.25, tickValue: 12.5, source: "CME Group contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "MES", label: "Micro E-mini S&P 500", tickSize: 0.25, tickValue: 1.25, source: "CME Group contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "YM", label: "E-mini Dow ($5)", tickSize: 1.0, tickValue: 5.0, source: "CME Group (CBOT) contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "MYM", label: "Micro E-mini Dow", tickSize: 1.0, tickValue: 0.5, source: "CME Group (CBOT) contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "RTY", label: "E-mini Russell 2000", tickSize: 0.1, tickValue: 5.0, source: "CME Group contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "M2K", label: "Micro E-mini Russell 2000", tickSize: 0.1, tickValue: 0.5, source: "CME Group contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "CL", label: "Crude Oil (WTI)", tickSize: 0.01, tickValue: 10.0, source: "CME Group (NYMEX) contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "MCL", label: "Micro WTI Crude Oil", tickSize: 0.01, tickValue: 1.0, source: "CME Group (NYMEX) contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "GC", label: "Gold", tickSize: 0.1, tickValue: 10.0, source: "CME Group (COMEX) contract specs, verified 2026-08-20", isBuiltin: true },
  { symbol: "MGC", label: "Micro Gold", tickSize: 0.1, tickValue: 1.0, source: "CME Group (COMEX) contract specs, verified 2026-08-20", isBuiltin: true },
]

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

/** Points are the trader-facing input unit; ticks are what gets stored and
 *  computed on. Rounds to the nearest whole tick — callers that need to
 *  flag a rounding artifact should compare the input against
 *  ticksToPoints(pointsToTicks(input, tickSize), tickSize). */
export function pointsToTicks(points: number, tickSize: number): number {
  if (!(tickSize > 0)) return 0
  return Math.round(points / tickSize)
}

export function ticksToPoints(ticks: number, tickSize: number): number {
  return ticks * tickSize
}

/**
 * Looks up a symbol against a combined instrument list (built-ins + a
 * user's own rows). A user row for a given symbol always wins over a
 * built-in row for the same symbol — that's how a trader corrects an entry
 * they believe is wrong without a code change.
 */
export function findInstrumentSpec(
  specs: readonly InstrumentSpec[],
  symbol: string | null | undefined,
): InstrumentSpec | null {
  if (!symbol) return null
  const norm = normalizeSymbol(symbol)
  const userMatch = specs.find((s) => !s.isBuiltin && s.symbol === norm)
  if (userMatch) return userMatch
  return specs.find((s) => s.isBuiltin && s.symbol === norm) ?? null
}
