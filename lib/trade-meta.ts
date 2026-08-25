/**
 * Per-trade journal metadata — persisted on Trade rows in Supabase.
 * Legacy localStorage is read only by the one-time migration at the bottom
 * of this file; it never participates in normal display or editing.
 */

import type { Trade } from "./types"
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

function parseTagArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((t): t is string => typeof t === "string")
}

/** Read metadata fields stored on a Trade row. */
export function metaFromTrade(trade: Trade): TradeMeta {
  const meta: TradeMeta = {}
  if (trade.session) meta.session = trade.session as SessionId
  if (trade.direction === "long" || trade.direction === "short") meta.direction = trade.direction
  if (trade.grade) meta.grade = trade.grade as TradeGrade
  const setup = parseTagArray(trade.setupTags)
  if (setup.length > 0) meta.setupTags = setup as SetupTag[]
  const discipline = parseTagArray(trade.disciplineTags)
  if (discipline.length > 0) meta.disciplineTags = discipline as DisciplineTag[]
  if (trade.entryPrice != null) meta.entryPrice = trade.entryPrice
  if (trade.exitPrice != null) meta.exitPrice = trade.exitPrice
  if (trade.contracts != null) meta.contracts = trade.contracts
  return meta
}

export function hasPersistedTradeMeta(trade: Trade): boolean {
  const m = metaFromTrade(trade)
  return (
    !!m.session ||
    !!m.direction ||
    !!m.grade ||
    (m.setupTags?.length ?? 0) > 0 ||
    (m.disciplineTags?.length ?? 0) > 0 ||
    m.entryPrice != null ||
    m.exitPrice != null ||
    m.contracts != null
  )
}

function hasMetaContent(meta: TradeMeta): boolean {
  return (
    !!meta.session ||
    !!meta.time ||
    !!meta.direction ||
    !!meta.grade ||
    (meta.setupTags?.length ?? 0) > 0 ||
    (meta.disciplineTags?.length ?? 0) > 0 ||
    meta.entryPrice != null ||
    meta.exitPrice != null ||
    meta.contracts != null
  )
}

/** Read metadata from the persisted Trade row only. */
export function getTradeMeta(tradeOrId: string | Trade, trades?: Trade[]): TradeMeta {
  const trade =
    typeof tradeOrId === "string"
      ? trades?.find((t) => t.id === tradeOrId)
      : tradeOrId
  return trade ? metaFromTrade(trade) : {}
}

/** Build id → meta map for analytics and tables. */
export function buildMetaMapFromTrades(trades: Trade[]): Record<string, TradeMeta> {
  const map: Record<string, TradeMeta> = {}
  for (const t of trades) {
    map[t.id] = metaFromTrade(t)
  }
  return map
}

/** DB column payload for create/update. */
export function metaToDbPayload(meta: TradeMeta): {
  session: string | null
  direction: string | null
  grade: string | null
  setup_tags: string[]
  discipline_tags: string[]
  entry_price: number | null
  exit_price: number | null
  contracts: number | null
} {
  return {
    session: meta.session ?? null,
    direction: meta.direction ?? null,
    grade: meta.grade ?? null,
    setup_tags: meta.setupTags ?? [],
    discipline_tags: meta.disciplineTags ?? [],
    entry_price: meta.entryPrice ?? null,
    exit_price: meta.exitPrice ?? null,
    contracts: meta.contracts ?? null,
  }
}

function loadLegacyTradeMeta(): Record<string, TradeMeta> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "{}") as Record<string, TradeMeta>
  } catch {
    return {}
  }
}

/** Push device-local metadata to Supabase for trades missing persisted fields. */
export async function migrateLocalTradeMetadata(
  trades: Trade[],
  updateFn: (
    tradeId: string,
    updates: {
      date: string
      accountId: string
      symbol: string
      pnl: number
      notes?: string | null
    },
    meta: TradeMeta,
  ) => Promise<{ data: Trade | null; error: Error | null }>,
): Promise<Trade[]> {
  const local = loadLegacyTradeMeta()
  const byId = new Map(trades.map((t) => [t.id, t]))
  let migrationFailed = false

  for (const trade of trades) {
    const legacy = local[trade.id]
    if (!legacy || !hasMetaContent(legacy) || hasPersistedTradeMeta(trade)) continue
    const result = await updateFn(
      trade.id,
      {
        date: trade.date,
        accountId: trade.accountId,
        symbol: trade.symbol,
        pnl: trade.pnl,
        notes: trade.notes ?? null,
      },
      legacy,
    )
    if (result.data) byId.set(trade.id, result.data)
    if (result.error) migrationFailed = true
  }

  if (!migrationFailed && typeof window !== "undefined") {
    localStorage.removeItem(META_KEY)
  }

  return trades.map((t) => byId.get(t.id) ?? t)
}

// ── Direction display helpers ────────────────────────────────────────────────

export const DIRECTION_OPTIONS: { id: TradeDirection; label: string }[] = [
  { id: "long",  label: "Long"  },
  { id: "short", label: "Short" },
]

export const DIRECTION_LABELS: Record<TradeDirection, string> = {
  long:  "Long",
  short: "Short",
}
