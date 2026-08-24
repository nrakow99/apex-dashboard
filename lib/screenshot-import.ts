import { TRADING_SYMBOLS } from "@/lib/trading-symbols"
import type { Trade } from "@/lib/types"

export type ScreenshotImportSource =
  | "lucid_trading_history"
  | "generic_trading_history"
  | "unknown"

export type ExtractionConfidence = "high" | "medium" | "low"

export interface ExtractedScreenshotTradeRow {
  date: string | null
  rawSymbol: string | null
  symbol: string | null
  symbolRecognized: boolean
  netPnl: number | null
  pnlHigh: number | null
  pnlLow: number | null
  quantity: number | null
  commission: number | null
  avgWin: number | null
  avgLoss: number | null
  winDurationSeconds: number | null
  lossDurationSeconds: number | null
  winRatePercent: number | null
  confidence: ExtractionConfidence
  warnings: string[]
}

export interface ScreenshotExtractionResult {
  source: ScreenshotImportSource
  rows: ExtractedScreenshotTradeRow[]
  coverageStart: string | null
  coverageEnd: string | null
  isLikelyComplete: boolean | null
  warnings: string[]
}

export interface ImportableScreenshotTradeRow extends ExtractedScreenshotTradeRow {
  date: string
  rawSymbol: string
  symbol: string
  netPnl: number
}

const FUTURES_MONTH_CODE = /^[FGHJKMNQUVXZ]\d{1,2}$/
const KNOWN_ROOTS = [...TRADING_SYMBOLS].sort((a, b) => b.length - a.length)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function nullableNonNegativeNumber(value: unknown): number | null {
  const parsed = nullableFiniteNumber(value)
  return parsed !== null && parsed >= 0 ? parsed : null
}

function nullablePercent(value: unknown): number | null {
  const parsed = nullableFiniteNumber(value)
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

/** True only for a real calendar date already serialized as YYYY-MM-DD. */
export function isValidImportDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  )
}

/**
 * Preserves the contract printed in the screenshot while resolving a stable
 * root for dashboard aggregation. Unknown symbols are returned unchanged and
 * explicitly marked unrecognized so the review UI can require confirmation.
 */
export function normalizeImportedSymbol(value: unknown): {
  rawSymbol: string | null
  symbol: string | null
  recognized: boolean
} {
  const rawSymbol = nullableText(value)?.toUpperCase().replace(/\s+/g, "") ?? null
  if (!rawSymbol) return { rawSymbol: null, symbol: null, recognized: false }

  for (const root of KNOWN_ROOTS) {
    if (rawSymbol === root) return { rawSymbol, symbol: root, recognized: true }
    const suffix = rawSymbol.slice(root.length)
    if (rawSymbol.startsWith(root) && FUTURES_MONTH_CODE.test(suffix)) {
      return { rawSymbol, symbol: root, recognized: true }
    }
  }

  return { rawSymbol, symbol: rawSymbol, recognized: false }
}

/**
 * Treat model output as hostile input. Invalid values become null and are
 * surfaced for review; they are never coerced into plausible-looking data.
 */
export function sanitizeScreenshotExtraction(value: unknown): ScreenshotExtractionResult {
  const root = isRecord(value) ? value : {}
  const rawRows = Array.isArray(root.rows) ? root.rows : []
  const resultWarnings = stringList(root.warnings)

  const rows = rawRows.map((candidate): ExtractedScreenshotTradeRow => {
    const row = isRecord(candidate) ? candidate : {}
    const normalizedSymbol = normalizeImportedSymbol(row.rawSymbol)
    const date = isValidImportDate(row.date) ? row.date : null
    const netPnl = nullableFiniteNumber(row.netPnl)
    const warnings = stringList(row.warnings)

    if (row.date != null && date === null) warnings.push("Date could not be verified.")
    if (!normalizedSymbol.rawSymbol) warnings.push("Symbol is unavailable.")
    else if (!normalizedSymbol.recognized) warnings.push("Symbol root needs confirmation.")
    if (netPnl === null) warnings.push("Net P&L is unavailable.")

    const rawConfidence = row.confidence
    const confidence: ExtractionConfidence =
      rawConfidence === "high" || rawConfidence === "medium" || rawConfidence === "low"
        ? rawConfidence
        : "low"

    return {
      date,
      rawSymbol: normalizedSymbol.rawSymbol,
      symbol: normalizedSymbol.symbol,
      symbolRecognized: normalizedSymbol.recognized,
      netPnl,
      pnlHigh: nullableFiniteNumber(row.pnlHigh),
      pnlLow: nullableFiniteNumber(row.pnlLow),
      quantity: nullableNonNegativeNumber(row.quantity),
      commission: nullableNonNegativeNumber(row.commission),
      avgWin: nullableFiniteNumber(row.avgWin),
      avgLoss: nullableFiniteNumber(row.avgLoss),
      winDurationSeconds: nullableNonNegativeNumber(row.winDurationSeconds),
      lossDurationSeconds: nullableNonNegativeNumber(row.lossDurationSeconds),
      winRatePercent: nullablePercent(row.winRatePercent),
      confidence,
      warnings: [...new Set(warnings)],
    }
  })

  const source: ScreenshotImportSource =
    root.source === "lucid_trading_history" ||
    root.source === "generic_trading_history" ||
    root.source === "unknown"
      ? root.source
      : "unknown"

  return {
    source,
    rows,
    coverageStart: isValidImportDate(root.coverageStart) ? root.coverageStart : null,
    coverageEnd: isValidImportDate(root.coverageEnd) ? root.coverageEnd : null,
    isLikelyComplete: typeof root.isLikelyComplete === "boolean" ? root.isLikelyComplete : null,
    warnings: [...new Set(resultWarnings)],
  }
}

export function isImportableScreenshotRow(
  row: ExtractedScreenshotTradeRow,
): row is ImportableScreenshotTradeRow {
  return (
    isValidImportDate(row.date) &&
    typeof row.rawSymbol === "string" &&
    row.rawSymbol.length > 0 &&
    typeof row.symbol === "string" &&
    row.symbol.length > 0 &&
    typeof row.netPnl === "number" &&
    Number.isFinite(row.netPnl)
  )
}

function canonicalNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ""
  return Number(value).toString()
}

/** Stable, reviewable identity used by both client warnings and the DB index. */
export function createScreenshotImportKey(
  accountId: string,
  row: Pick<
    ImportableScreenshotTradeRow,
    "date" | "rawSymbol" | "symbol" | "netPnl" | "quantity" | "commission"
  >,
): string {
  return [
    "screenshot-v1",
    accountId,
    row.date,
    row.rawSymbol.toUpperCase(),
    row.symbol.toUpperCase(),
    canonicalNumber(row.netPnl),
    canonicalNumber(row.quantity),
    canonicalNumber(row.commission),
  ].join("|")
}

/** Conservative match: enough to warn, never enough to silently delete a row. */
export function isLikelyExistingTrade(
  row: ImportableScreenshotTradeRow,
  accountId: string,
  existingTrades: Trade[],
): boolean {
  const exactKey = createScreenshotImportKey(accountId, row)
  return existingTrades.some((trade) => {
    if (trade.accountId !== accountId) return false
    if (trade.importKey && trade.importKey === exactKey) return true
    return (
      trade.date === row.date &&
      trade.symbol.toUpperCase() === row.symbol.toUpperCase() &&
      Number(trade.pnl) === row.netPnl &&
      (trade.contracts == null || row.quantity == null || Number(trade.contracts) === row.quantity)
    )
  })
}
