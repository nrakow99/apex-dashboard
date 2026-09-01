import { describe, expect, it } from "vitest"
import type { ComplianceItem } from "./compliance-center"
import type { TodayAccount } from "./today-dashboard"
import type { Account, InstrumentSpec, RiskProfile } from "./types"
import { buildPortfolioVerdict, comparePortfolioVerdicts } from "./verdict"

const spec: InstrumentSpec = {
  symbol: "NQ",
  label: "Nasdaq 100 E-mini",
  tickSize: 0.25,
  tickValue: 5,
  isBuiltin: true,
}

const profile: RiskProfile = { symbol: "NQ", contracts: 2, riskStopTicks: 40 }

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    firm: "Apex",
    type: "PA",
    status: "Active",
    drawdownType: "EOD",
    accountSize: 50000,
    balance: 52000,
    startingBalance: 50000,
    maxBalance: 52000,
    maxDrawdown: 2500,
    dailyLossLimit: 0,
    ...overrides,
  }
}

function row(id: string, overrides: Partial<TodayAccount> = {}): TodayAccount {
  return {
    account: account(id),
    todayPnl: 0,
    tradeCountToday: 0,
    drawdownRemaining: 1600,
    drawdownPercent: 0.64,
    dailyRemaining: null,
    payoutReady: false,
    payoutMissing: ["One more qualifying day"],
    breached: false,
    rulesAvailable: true,
    ...overrides,
  }
}

function compliance(id: string, suffix: string, kind: ComplianceItem["kind"]): ComplianceItem {
  return {
    id: `${id}:${suffix}`,
    kind,
    accountId: id,
    accountName: id,
    title: suffix,
    description: `${suffix} detail`,
    href: `/accounts?account=${id}`,
    action: "Review",
    rank: 1,
  }
}

describe("buildPortfolioVerdict", () => {
  it("keeps hard blocks, missing data, and payout readiness distinct", () => {
    const result = buildPortfolioVerdict({
      rows: [
        row("ready", { payoutReady: true }),
        row("blocked", { breached: true }),
        row("unknown", { rulesAvailable: false, drawdownRemaining: null }),
      ],
      complianceItems: [],
      instrumentSpecs: [spec],
      userRiskProfile: profile,
    })

    expect(result.accounts.find((item) => item.account.id === "ready")?.primary).toBe("request_payout")
    expect(result.accounts.find((item) => item.account.id === "blocked")?.primary).toBe("blocked")
    expect(result.accounts.find((item) => item.account.id === "unknown")?.primary).toBe("needs_data")
    expect(result.focus?.account.id).toBe("blocked")
  })

  it("uses missing live intraday floor as data unavailable rather than a hard trade command", () => {
    const live = row("live", { account: account("live", { drawdownType: "Intraday" }) })
    const result = buildPortfolioVerdict({
      rows: [live],
      complianceItems: [compliance("live", "live-floor", "blocker")],
      instrumentSpecs: [spec],
      userRiskProfile: profile,
    })

    expect(result.accounts[0].primary).toBe("needs_data")
    expect(result.accounts[0].reason).toContain("live-floor detail")
  })

  it("protects an account when one configured full-stop loss is not covered", () => {
    const result = buildPortfolioVerdict({
      rows: [row("thin", { drawdownRemaining: 300 })],
      complianceItems: [],
      instrumentSpecs: [spec],
      userRiskProfile: profile,
    })

    expect(result.accounts[0].primary).toBe("protect")
    expect(result.accounts[0].tradesOfRoom).toBe(0)
  })

  it("keeps verified dollar room eligible when the optional risk profile is absent", () => {
    const result = buildPortfolioVerdict({
      rows: [row("dollars-only")],
      complianceItems: [],
      instrumentSpecs: [spec],
      userRiskProfile: null,
    })

    expect(result.accounts[0].primary).toBe("eligible")
    expect(result.accounts[0].dollarsOfRoom).toBe(1600)
    expect(result.accounts[0].tradesOfRoom).toBeNull()
  })

  it("ranks eligible accounts by configured full-stop losses of room", () => {
    const result = buildPortfolioVerdict({
      rows: [row("smaller", { drawdownRemaining: 1200 }), row("larger", { drawdownRemaining: 2400 })],
      complianceItems: [],
      instrumentSpecs: [spec],
      userRiskProfile: profile,
    })

    expect(result.accounts.find((item) => item.account.id === "larger")?.rank).toBe(1)
    expect(result.accounts.find((item) => item.account.id === "smaller")?.rank).toBe(2)
  })

  it("breaks equal-room ties by account name and then id", () => {
    const result = buildPortfolioVerdict({
      rows: [row("z", { account: account("z", { name: "Zulu" }) }), row("a", { account: account("a", { name: "Alpha" }) })],
      complianceItems: [], instrumentSpecs: [spec], userRiskProfile: profile,
    })
    expect(result.accounts.find((item) => item.account.id === "a")?.rank).toBe(1)
    expect(result.accounts.find((item) => item.account.id === "z")?.rank).toBe(2)
  })

  it("keeps a breached payout-ready account blocked", () => {
    const result = buildPortfolioVerdict({
      rows: [row("both", { breached: true, payoutReady: true })],
      complianceItems: [], instrumentSpecs: [spec], userRiskProfile: profile,
    })
    expect(result.accounts[0].primary).toBe("blocked")
  })

  it("carries consistency as a constraint instead of an exclusive verdict", () => {
    const result = buildPortfolioVerdict({
      rows: [row("watch")],
      complianceItems: [compliance("watch", "consistency", "watch")],
      instrumentSpecs: [spec],
      userRiskProfile: profile,
    })

    expect(result.accounts[0].primary).toBe("eligible")
    expect(result.accounts[0].constraints[0].kind).toBe("consistency")
  })
})

describe("comparePortfolioVerdicts", () => {
  it("reports changes only for affected accounts", () => {
    const before = buildPortfolioVerdict({
      rows: [row("a", { drawdownRemaining: 1600 }), row("b")],
      complianceItems: [],
      instrumentSpecs: [spec],
      userRiskProfile: profile,
    })
    const after = buildPortfolioVerdict({
      rows: [row("a", { drawdownRemaining: 1100 }), row("b")],
      complianceItems: [],
      instrumentSpecs: [spec],
      userRiskProfile: profile,
    })

    expect(comparePortfolioVerdicts(before, after, ["a"])).toEqual([expect.objectContaining({
      accountId: "a",
      dollarsOfRoomChange: -500,
      tradesOfRoomChange: -2,
    })])
  })

  it("omits delta rows when classification and displayed headroom did not materially change", () => {
    const before = buildPortfolioVerdict({ rows: [row("a")], complianceItems: [], instrumentSpecs: [spec], userRiskProfile: profile })
    const after = buildPortfolioVerdict({ rows: [row("a", { drawdownRemaining: 1600.001 })], complianceItems: [], instrumentSpecs: [spec], userRiskProfile: profile })
    expect(comparePortfolioVerdicts(before, after, ["a"])).toEqual([])
  })
})
