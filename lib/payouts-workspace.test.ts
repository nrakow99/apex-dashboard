import { describe, expect, it } from "vitest"
import { buildPayoutWorkspace, summarizePayoutWorkspace } from "./payouts-workspace"
import type { Account, Payout, Trade } from "./types"

const account = (overrides: Partial<Account> = {}): Account => ({
  id: "pa-1",
  name: "Apex PA",
  firm: "Apex",
  type: "PA",
  status: "Active",
  drawdownType: "EOD",
  accountSize: 50000,
  quantity: 1,
  balance: 50000,
  startingBalance: 50000,
  maxBalance: 50000,
  maxDrawdown: 2000,
  dailyLossLimit: 1000,
  ...overrides,
})

describe("payout workspace", () => {
  it("keeps invalid rule configurations visible but unavailable", () => {
    const rows = buildPayoutWorkspace([account({ accountSize: 250000 })], [], [])
    expect(rows).toHaveLength(1)
    expect(rows[0].rulesAvailable).toBe(false)
    expect(rows[0].eligibility).toBeNull()
    expect(rows[0].isReady).toBe(false)
  })

  it("does not mark a non-active account ready", () => {
    const trades: Trade[] = Array.from({ length: 5 }, (_, index) => ({ id: String(index), accountId: "pa-1", date: `2026-08-${10 + index}`, symbol: "NQ", pnl: 500 }))
    const rows = buildPayoutWorkspace([account({ status: "Breached" })], trades, [])
    expect(rows[0].isReady).toBe(false)
    expect(rows[0].missingConditions).toEqual(["Account status is breached"])
  })

  it("summarizes recorded gross from persisted payouts only", () => {
    const payouts: Payout[] = [{ id: "p", accountId: "pa-1", date: "2026-08-20", amount: 1000, payoutNumber: 1 }]
    const rows = buildPayoutWorkspace([account()], [], payouts)
    expect(summarizePayoutWorkspace(rows, payouts).recordedGross).toBe(1000)
  })
})
