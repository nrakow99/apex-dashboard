import { describe, expect, it } from "vitest"
import { filterWorkspaceTrades, summarizeTradeWorkspace, tradeReviewAreaCount } from "./trades-workspace"
import type { Account, Trade } from "./types"

const accounts = [
  { id: "a", name: "Apex 50K" },
  { id: "b", name: "Lucid 100K" },
] as Account[]

const trades: Trade[] = [
  { id: "1", accountId: "a", date: "2026-08-20", symbol: "NQ", pnl: 200, session: "ny_am", grade: "A" },
  { id: "2", accountId: "a", date: "2026-08-21", symbol: "ES", pnl: -100 },
  { id: "3", accountId: "b", date: "2026-08-22", symbol: "MNQ", pnl: 50, importSource: "screenshot", notes: "Liquidity sweep" },
]

describe("trade workspace", () => {
  it("summarizes only real records and reports nullable rates", () => {
    expect(summarizeTradeWorkspace(trades)).toMatchObject({ records: 3, totalPnl: 150, wins: 2, losses: 1, reviewed: 2, imported: 1 })
    expect(summarizeTradeWorkspace([]).winRate).toBeNull()
    expect(summarizeTradeWorkspace([]).reviewCoverage).toBeNull()
  })

  it("filters by result, account, review state, imports, and searchable context", () => {
    expect(filterWorkspaceTrades(trades, accounts, { accountId: "all", filter: "wins", query: "" }).map((trade) => trade.id)).toEqual(["3", "1"])
    expect(filterWorkspaceTrades(trades, accounts, { accountId: "a", filter: "unreviewed", query: "" }).map((trade) => trade.id)).toEqual(["2"])
    expect(filterWorkspaceTrades(trades, accounts, { accountId: "all", filter: "imports", query: "" }).map((trade) => trade.id)).toEqual(["3"])
    expect(filterWorkspaceTrades(trades, accounts, { accountId: "all", filter: "all", query: "lucid" }).map((trade) => trade.id)).toEqual(["3"])
    expect(filterWorkspaceTrades(trades, accounts, { accountId: "all", filter: "all", query: "liquidity" }).map((trade) => trade.id)).toEqual(["3"])
  })

  it("counts review areas without inventing missing context", () => {
    expect(tradeReviewAreaCount(trades[0])).toBe(2)
    expect(tradeReviewAreaCount(trades[1])).toBe(0)
    expect(tradeReviewAreaCount(trades[2])).toBe(1)
  })
})
