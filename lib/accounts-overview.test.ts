import { describe, it, expect } from "vitest"
import { getAccountsOverview, AT_RISK_DRAWDOWN_FRACTION } from "./accounts-overview"
import { toLocalDateKey } from "./date-utils"
import type { Account, Trade } from "./types"

function daysAgoIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function dateKeyDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalDateKey(d)
}

function apexPa(overrides: Partial<Account> = {}): Account {
  return {
    id: "pa-1",
    name: "Apex 50K PA",
    firm: "Apex",
    type: "PA",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 50000,
    startingBalance: 50000,
    balance: 50000,
    maxBalance: 50000,
    maxDrawdown: 2000,
    dailyLossLimit: 0,
    createdAt: daysAgoIso(10),
    ...overrides,
  }
}

function trade(accountId: string, date: string, pnl: number): Trade {
  return { id: `t-${accountId}-${date}-${pnl}`, date, accountId, symbol: "NQ", pnl }
}

describe("getAccountsOverview", () => {
  it("returns zeros for an empty list", () => {
    expect(getAccountsOverview([], [], [])).toEqual({
      roomToday: 0,
      atRisk: 0,
      payoutReady: 0,
      needsUpdate: 0,
    })
  })

  it("sums remaining floor buffer across live accounts and multiplies quantity", () => {
    const a = apexPa({ id: "a", quantity: 2 })
    const overview = getAccountsOverview([a], [], [])
    expect(overview.roomToday).toBe(4000)
  })

  it("excludes breached accounts from every column — a dead account has no room", () => {
    const dead = apexPa({ id: "dead", status: "Breached" })
    const overview = getAccountsOverview([dead], [], [])
    expect(overview).toEqual({
      roomToday: 0,
      atRisk: 0,
      payoutReady: 0,
      needsUpdate: 0,
    })
  })

  it("counts At risk when remaining buffer is inside the card's At Risk band", () => {
    const a = apexPa({ id: "risk" })
    const loss = a.maxDrawdown * (1 - AT_RISK_DRAWDOWN_FRACTION) + 50
    const overview = getAccountsOverview(
      [a],
      [trade(a.id, dateKeyDaysAgo(1), -loss)],
      [],
    )
    expect(overview.atRisk).toBe(1)
    expect(overview.roomToday).toBeLessThan(a.maxDrawdown * AT_RISK_DRAWDOWN_FRACTION)
  })

  it("counts Needs update when owned > 1 day and today's result is not logged", () => {
    const a = apexPa({ id: "stale" })
    const overview = getAccountsOverview(
      [a],
      [trade(a.id, dateKeyDaysAgo(1), 100)],
      [],
    )
    expect(overview.needsUpdate).toBe(1)
  })

  it("does not count Needs update when today's result is logged", () => {
    const a = apexPa({ id: "fresh" })
    const overview = getAccountsOverview(
      [a],
      [trade(a.id, dateKeyDaysAgo(0), 100)],
      [],
    )
    expect(overview.needsUpdate).toBe(0)
  })

  it("does not count a brand-new account as Needs update", () => {
    const a = apexPa({ id: "new", createdAt: daysAgoIso(0) })
    const overview = getAccountsOverview([a], [], [])
    expect(overview.needsUpdate).toBe(0)
  })
})
