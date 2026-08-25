import { normalizeImportedSymbol } from "./screenshot-import"
import type { Trade } from "./types"

export interface CsvTradeRow {
  rowNumber: number
  date: string
  symbol: string
  pnl: number
  contracts: number | null
}

export interface CsvParseResult {
  rows: CsvTradeRow[]
  rejectedRows: number
  errors: string[]
}

function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(cell)
      cell = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell)
      if (row.some((value) => value.trim() !== "")) rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }
  row.push(cell)
  if (row.some((value) => value.trim() !== "")) rows.push(row)
  return rows
}

function headerKey(value: string): string {
  return value.toLowerCase().replaceAll("&", "and").replace(/[^a-z0-9]/g, "")
}

function findColumn(headers: string[], aliases: string[]): number {
  const keys = headers.map(headerKey)
  return aliases.map(headerKey).map((alias) => keys.indexOf(alias)).find((index) => index >= 0) ?? -1
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
  return null
}

function numberValue(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const negative = /^\(.*\)$/.test(trimmed)
  const parsed = Number(trimmed.replace(/[,$%()\s]/g, ""))
  if (!Number.isFinite(parsed)) return null
  return negative ? -Math.abs(parsed) : parsed
}

export function parseTradeCsv(text: string): CsvParseResult {
  const sourceRows = parseRows(text.replace(/^\uFEFF/, ""))
  if (sourceRows.length < 2) return { rows: [], rejectedRows: 0, errors: ["The CSV needs a header row and at least one data row."] }
  const headers = sourceRows[0]
  const dateIndex = findColumn(headers, ["date", "trade date", "trading date"])
  const symbolIndex = findColumn(headers, ["symbol", "instrument", "contract"])
  const pnlIndex = findColumn(headers, ["net pnl", "net p&l", "pnl", "p&l", "net profit", "profit and loss"])
  const quantityIndex = findColumn(headers, ["qty", "quantity", "contracts", "contract quantity"])
  const missing = [dateIndex < 0 ? "date" : null, symbolIndex < 0 ? "symbol" : null, pnlIndex < 0 ? "net P&L" : null].filter(Boolean)
  if (missing.length) return { rows: [], rejectedRows: sourceRows.length - 1, errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`] }

  const rows: CsvTradeRow[] = []
  const errors: string[] = []
  sourceRows.slice(1).forEach((source, index) => {
    const rowNumber = index + 2
    const date = normalizeDate(source[dateIndex] ?? "")
    const symbol = normalizeImportedSymbol(source[symbolIndex] ?? "").symbol ?? ""
    const pnl = numberValue(source[pnlIndex] ?? "")
    const quantity = quantityIndex >= 0 ? numberValue(source[quantityIndex] ?? "") : null
    if (!date || !symbol || pnl == null || (quantity != null && (!Number.isInteger(quantity) || quantity <= 0))) {
      if (errors.length < 5) errors.push(`Row ${rowNumber} has an invalid date, symbol, P&L, or quantity.`)
      return
    }
    rows.push({ rowNumber, date, symbol, pnl, contracts: quantity })
  })
  return { rows, rejectedRows: sourceRows.length - 1 - rows.length, errors }
}

export function isLikelyCsvDuplicate(row: CsvTradeRow, accountId: string, trades: Trade[]): boolean {
  return trades.some((trade) => trade.accountId === accountId && trade.date === row.date && trade.symbol.toUpperCase() === row.symbol.toUpperCase() && trade.pnl === row.pnl && (row.contracts == null || trade.contracts == null || trade.contracts === row.contracts))
}
