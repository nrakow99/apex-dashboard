import { describe, expect, it } from "vitest"
import {
  accountNamesForConcentration,
  buildBehavioralEdge,
  buildRotationDecision,
  buildSameDayConcentration,
} from "./edge-intelligence"
import type { Account, Trade } from "./types"
import type { TodayAccount } from "./today-dashboard"

const account = (id: string, name: string): Account => ({
  id,
  name,
  firm: "Apex",
  type: "PA",
  status: "Active",
  drawdownType: "EOD",
  accountSize: 50000,
  balance: 50000,
  startingBalance: 50000,
  maxBalance: 50000,
  maxDrawdown: 2500,
  dailyLossLimit: 0,
})

const trade = (id: string, accountId: string, date: string, pnl: number, extras: Partial<Trade> = {}): Trade => ({
  id,
  accountId,
  date,
  pnl,
  symbol: "NQ",
  ...extras,
})

const todayRow = (value: Account, drawdownPercent: number, payoutReady = false): TodayAccount => ({
  account: value,
  todayPnl: 0,
  tradeCountToday: 0,
  drawdownRemaining: drawdownPercent * 2500,
  drawdownPercent,
  dailyRemaining: null,
  payoutReady,
  payoutMissing: [],
  breached: false,
  rulesAvailable: true,
})

describe("edge intelligence", () => {
  it("surfaces only patterns with enough supporting records", () => {
    const records = [
      trade("1", "a", "2026-08-01", 100, { session: "ny_am", setupTags: ["Opening range"] }),
      trade("2", "a", "2026-08-02", 150, { session: "ny_am", setupTags: ["Opening range"] }),
      trade("3", "a", "2026-08-03", 200, { session: "ny_am", setupTags: ["Opening range"] }),
      trade("4", "a", "2026-08-04", 1000, { symbol: "ES", session: "london" }),
    ]
    const edge = buildBehavioralEdge(records)
    expect(edge.provenPattern).toMatchObject({ records: 3, averagePnl: 150 })
  })

  it("identifies repeated same-day activity across distinct accounts", () => {
    const records = [
      trade("1", "a", "2026-08-20", 100),
      trade("2", "b", "2026-08-20", -50),
      trade("3", "a", "2026-08-19", 25),
    ]
    const groups = buildSameDayConcentration(records)
    expect(groups).toEqual([{ date: "2026-08-20", symbol: "NQ", accountCount: 2, recordCount: 2, netPnl: 50 }])
    expect(accountNamesForConcentration(groups[0], records, [account("a", "One"), account("b", "Two")])).toEqual(["One", "Two"])
  })

  it("protects payout-ready accounts and routes to the widest eligible buffer", () => {
    const one = account("a", "Ready")
    const two = account("b", "Wider")
    const three = account("c", "Tighter")
    const decision = buildRotationDecision([
      todayRow(one, 0.9, true),
      todayRow(two, 0.8),
      todayRow(three, 0.4),
    ], [])
    expect(decision).toMatchObject({ posture: "deploy", accountId: "b", protectedAccountCount: 1 })
    expect(decision.description).toContain("payout-ready")
  })

  it("refuses to route capital when every row is unavailable or blocked", () => {
    const blocked = todayRow(account("a", "Unknown"), 0.8)
    blocked.rulesAvailable = false
    expect(buildRotationDecision([blocked], [])).toMatchObject({ posture: "stop", accountId: "a" })
  })
})
