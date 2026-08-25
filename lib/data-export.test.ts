import { describe, expect, it } from "vitest"
import { exportAccountCostsCsv, exportPayoutsCsv, exportTradesCsv, exportWorkspaceJson } from "./data-export"
import type { Account } from "./types"

const account: Account = {
  id: "a1", name: "Comma, Account", firm: "Lucid", type: "Eval", status: "Active", drawdownType: "EOD",
  accountSize: 50000, balance: 50000, startingBalance: 50000, maxBalance: 50000, maxDrawdown: 2000, dailyLossLimit: 0,
}

describe("data export", () => {
  it("escapes CSV and preserves unknown payout split fields as blank", () => {
    expect(exportTradesCsv([{ id: "t1", accountId: "a1", date: "2026-08-24", symbol: "NQ", pnl: 100, notes: "A, B" }], [account])).toContain('"Comma, Account"')
    expect(exportPayoutsCsv([{ id: "p1", accountId: "a1", date: "2026-08-24", amount: 500, payoutNumber: 1 }], [account])).toContain("500,,,")
  })

  it("labels the JSON backup format and version", () => {
    const parsed = JSON.parse(exportWorkspaceJson([account], [], [], [], "2026-08-24T00:00:00.000Z"))
    expect(parsed).toMatchObject({ format: "propdash-workspace", version: 2, accountCosts: [] })
  })

  it("exports tracked account costs without inventing notes", () => {
    const contents = exportAccountCostsCsv([{ id: "c1", accountId: "a1", date: "2026-08-24", category: "evaluation", amount: 99 }], [account])
    expect(contents).toContain('2026-08-24,"Comma, Account",a1,evaluation,99,')
  })
})
