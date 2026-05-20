/**
 * Extended per-trade metadata stored in localStorage.
 * Kept separate from the core Trade type so it doesn't touch
 * Supabase schema or any calculation logic.
 */

import type { SessionId } from "./sessions"

export type TradeGrade = "A+" | "A" | "B" | "C" | "FOMO" | "Revenge"

export const DISCIPLINE_POSITIVE = [
  "Followed Plan",
  "Patient",
  "Good Risk",
] as const

export const DISCIPLINE_NEGATIVE = [
  "Overtraded",
  "Forced Entry",
  "Revenge Trade",
  "Moved Stop",
  "Cut Winner Early",
  "Ignored Bias",
] as const

export type DisciplineTag =
  | (typeof DISCIPLINE_POSITIVE)[number]
  | (typeof DISCIPLINE_NEGATIVE)[number]

export const SETUP_TAGS = [
  "Liquidity Sweep",
  "FVG",
  "IFVG",
  "CISD",
  "Reversal",
  "Trend Continuation",
  "Breakout",
  "Failed Breakout",
  "Retest",
] as const

export type SetupTag = (typeof SETUP_TAGS)[number]

export type TradeDirection = "long" | "short"

export interface TradeMeta {
  /**
   * Stable session identifier — preferred over the legacy `time` field.
   * Use `resolveSession(meta)` from lib/sessions.ts to read, which falls
   * back to deriving the session from the old `time` string automatically.
   */
  session?: SessionId
  /** @deprecated Legacy HH:MM time string — kept for backward-compat only */
  time?: string
  direction?: TradeDirection
  grade?: TradeGrade
  disciplineTags?: DisciplineTag[]
  setupTags?: SetupTag[]
  entryPrice?: number
  exitPrice?: number
  contracts?: number
}

const META_KEY = "propdash-trade-meta"

export function loadAllTradeMeta(): Record<string, TradeMeta> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "{}") as Record<string, TradeMeta>
  } catch {
    return {}
  }
}

export function saveTradeMeta(tradeId: string, meta: TradeMeta): void {
  if (typeof window === "undefined") return
  const all = loadAllTradeMeta()
  // Deep-merge so partial updates don't wipe existing fields
  all[tradeId] = { ...all[tradeId], ...meta }
  localStorage.setItem(META_KEY, JSON.stringify(all))
}

export function getTradeMeta(tradeId: string): TradeMeta {
  return loadAllTradeMeta()[tradeId] ?? {}
}

export function deleteTradeMeta(tradeId: string): void {
  if (typeof window === "undefined") return
  const all = loadAllTradeMeta()
  delete all[tradeId]
  localStorage.setItem(META_KEY, JSON.stringify(all))
}

// ── Grade display helpers ────────────────────────────────────────────────────

// ── Direction display helpers ────────────────────────────────────────────────

export const DIRECTION_OPTIONS: { id: TradeDirection; label: string }[] = [
  { id: "long",  label: "Long"  },
  { id: "short", label: "Short" },
]

export const DIRECTION_SELECTOR_STYLES: Record<
  TradeDirection,
  { inactive: string; active: string }
> = {
  long:  {
    inactive: "border-white/[0.08] text-[#E5E4E2]/28 hover:text-[#E5E4E2]/50 hover:border-[rgba(83,104,120,0.24)]",
    active:   "bg-[rgba(83,104,120,0.18)] border-[rgba(83,104,120,0.38)] text-[#94AAB8]",
  },
  short: {
    inactive: "border-white/[0.08] text-[#E5E4E2]/28 hover:text-[#E5E4E2]/50 hover:border-white/[0.14]",
    active:   "bg-[rgba(229,228,226,0.07)] border-white/[0.18] text-[#E5E4E2]/80",
  },
}

export const DIRECTION_BADGE_STYLES: Record<TradeDirection, string> = {
  long:  "bg-[rgba(83,104,120,0.14)] text-[#94AAB8] border-[rgba(83,104,120,0.26)]",
  short: "bg-[rgba(229,228,226,0.06)] text-[#E5E4E2]/55 border-white/[0.12]",
}

export const DIRECTION_LABELS: Record<TradeDirection, string> = {
  long:  "Long",
  short: "Short",
}

// ── Grade display helpers ────────────────────────────────────────────────────

export const GRADE_STYLES: Record<
  TradeGrade,
  { className: string; activeClassName: string }
> = {
  "A+":      { className: "border-teal-500/25 text-teal-400/60",      activeClassName: "bg-teal-500/[0.13] border-teal-500/35 text-teal-300" },
  "A":       { className: "border-emerald-500/22 text-emerald-400/60", activeClassName: "bg-emerald-500/[0.11] border-emerald-500/32 text-emerald-400" },
  "B":       { className: "border-amber-500/20 text-amber-400/55",    activeClassName: "bg-amber-500/[0.10] border-amber-500/30 text-amber-400" },
  "C":       { className: "border-orange-500/18 text-orange-400/50",  activeClassName: "bg-orange-500/[0.09] border-orange-500/26 text-orange-400" },
  "FOMO":    { className: "border-red-500/16 text-red-400/50",        activeClassName: "bg-red-500/[0.08] border-red-500/22 text-red-400/80" },
  "Revenge": { className: "border-red-500/20 text-red-400/55",        activeClassName: "bg-red-500/[0.10] border-red-500/28 text-red-400" },
}
