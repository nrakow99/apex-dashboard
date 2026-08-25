import { describe, expect, it } from "vitest"
import { isLikelyCsvDuplicate, parseTradeCsv } from "./csv-import"

describe("CSV trade import", () => {
  it("parses common headers, quoted money, and US dates", () => {
    const result = parseTradeCsv('Trade Date,Instrument,Net P&L,Qty\n08/21/2026,NQU6,"$1,234.50",2\n2026-08-22,MNQ,(125.25),1')
    expect(result.rows).toEqual([
      { rowNumber: 2, date: "2026-08-21", symbol: "NQ", pnl: 1234.5, contracts: 2 },
      { rowNumber: 3, date: "2026-08-22", symbol: "MNQ", pnl: -125.25, contracts: 1 },
    ])
  })

  it("rejects files without required columns", () => {
    expect(parseTradeCsv("date,symbol\n2026-08-21,NQ").errors[0]).toContain("net P&L")
  })

  it("screens likely duplicates without deleting them", () => {
    const row = { rowNumber: 2, date: "2026-08-21", symbol: "NQ", pnl: 100, contracts: 1 }
    expect(isLikelyCsvDuplicate(row, "a1", [{ id: "t1", accountId: "a1", date: row.date, symbol: row.symbol, pnl: row.pnl, contracts: 1 }])).toBe(true)
  })
})
