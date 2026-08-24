import { describe, expect, it } from "vitest"
import {
  createScreenshotImportKey,
  isImportableScreenshotRow,
  isLikelyExistingTrade,
  isValidImportDate,
  normalizeImportedSymbol,
  sanitizeScreenshotExtraction,
} from "@/lib/screenshot-import"

describe("screenshot import safety", () => {
  it("normalizes dated futures contracts while preserving the raw symbol", () => {
    expect(normalizeImportedSymbol(" NQU6 ")).toEqual({
      rawSymbol: "NQU6",
      symbol: "NQ",
      recognized: true,
    })
    expect(normalizeImportedSymbol("MNQU6").symbol).toBe("MNQ")
    expect(normalizeImportedSymbol("MESU6").symbol).toBe("MES")
  })

  it("does not pretend an unknown contract is recognized", () => {
    expect(normalizeImportedSymbol("6EU6")).toEqual({
      rawSymbol: "6EU6",
      symbol: "6EU6",
      recognized: false,
    })
  })

  it("accepts only real ISO calendar dates", () => {
    expect(isValidImportDate("2026-08-21")).toBe(true)
    expect(isValidImportDate("2026-02-30")).toBe(false)
    expect(isValidImportDate("08/21/2026")).toBe(false)
  })

  it("keeps unavailable screenshot values null instead of converting them to zero", () => {
    const result = sanitizeScreenshotExtraction({
      source: "lucid_trading_history",
      rows: [
        {
          date: "2026-08-14",
          rawSymbol: "NQU6",
          netPnl: -3.5,
          pnlHigh: -3.5,
          pnlLow: -3.5,
          quantity: 1,
          commission: 3.5,
          avgWin: null,
          avgLoss: 0,
          winDurationSeconds: 0,
          lossDurationSeconds: 267,
          winRatePercent: 0,
          confidence: "high",
          warnings: [],
        },
      ],
      coverageStart: "2026-08-14",
      coverageEnd: "2026-08-14",
      isLikelyComplete: false,
      warnings: ["Screenshot may continue below the visible area."],
    })

    expect(result.rows[0].avgWin).toBeNull()
    expect(result.rows[0].avgLoss).toBe(0)
    expect(result.rows[0].symbol).toBe("NQ")
    expect(result.isLikelyComplete).toBe(false)
  })

  it("flags malformed required values and prevents importing the row", () => {
    const row = sanitizeScreenshotExtraction({
      rows: [{ date: "2026-99-99", rawSymbol: "", netPnl: "$50", confidence: "certain" }],
    }).rows[0]

    expect(row.date).toBeNull()
    expect(row.netPnl).toBeNull()
    expect(row.confidence).toBe("low")
    expect(row.warnings).toContain("Net P&L is unavailable.")
    expect(isImportableScreenshotRow(row)).toBe(false)
  })

  it("keeps impossible percentages unavailable", () => {
    const row = sanitizeScreenshotExtraction({
      rows: [
        {
          date: "2026-08-21",
          rawSymbol: "NQU6",
          netPnl: 10,
          winRatePercent: 134.78,
          confidence: "medium",
        },
      ],
    }).rows[0]
    expect(row.winRatePercent).toBeNull()
  })

  it("builds stable keys and warns about likely existing rows", () => {
    const row = sanitizeScreenshotExtraction({
      rows: [
        {
          date: "2026-08-21",
          rawSymbol: "MNQU6",
          netPnl: 43.5,
          quantity: 3,
          commission: 3,
          confidence: "high",
        },
      ],
    }).rows[0]
    expect(isImportableScreenshotRow(row)).toBe(true)
    if (!isImportableScreenshotRow(row)) throw new Error("Expected importable fixture")

    expect(createScreenshotImportKey("account-1", row)).toBe(
      "screenshot-v1|account-1|2026-08-21|MNQU6|MNQ|43.5|3|3",
    )
    expect(
      isLikelyExistingTrade(row, "account-1", [
        {
          id: "trade-1",
          accountId: "account-1",
          date: "2026-08-21",
          symbol: "MNQ",
          pnl: 43.5,
          contracts: 3,
        },
      ]),
    ).toBe(true)
  })
})
