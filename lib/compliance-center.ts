import { applyIntradayManualDrawdownToStats } from "./intraday-manual-drawdown"
import { getAccountRules } from "./rules"
import { calculateAccountStats, getConsistencyInfo, getPayoutEligibility } from "./storage"
import { resolveRiskProfile, riskPerTrade } from "./headroom"
import type { Account, InstrumentSpec, Payout, RiskProfile, Trade } from "./types"

export type ComplianceKind = "blocker" | "action" | "watch" | "ready"

export interface ComplianceItem {
  id: string
  kind: ComplianceKind
  accountId: string | null
  accountName: string | null
  title: string
  description: string
  href: string
  action: string
  rank: number
}

export interface ComplianceInputs {
  accounts: Account[]
  trades: Trade[]
  payouts: Payout[]
  instrumentSpecs: InstrumentSpec[]
  userRiskProfile: RiskProfile | null
}

function item(
  value: Omit<ComplianceItem, "rank"> & { rank?: number },
): ComplianceItem {
  return { ...value, rank: value.rank ?? 99 }
}

export function buildComplianceItems(input: ComplianceInputs): ComplianceItem[] {
  const items: ComplianceItem[] = []

  if (input.accounts.length === 0) {
    items.push(item({
      id: "workspace:no-account",
      kind: "action",
      accountId: null,
      accountName: null,
      title: "Add the first account",
      description: "Payout compliance cannot be calculated until an exact firm, program, size, and stage are configured.",
      href: "/accounts",
      action: "Add account",
      rank: 10,
    }))
  }

  if (input.accounts.length > 0 && input.userRiskProfile == null) {
    items.push(item({
      id: "workspace:no-risk-profile",
      kind: "action",
      accountId: null,
      accountName: null,
      title: "Default risk is not configured",
      description: "Floor distance is available, but trade-headroom checks remain unavailable until a complete risk profile is saved.",
      href: "/settings",
      action: "Set default risk",
      rank: 45,
    }))
  }

  if (input.accounts.length > 0 && input.trades.length === 0) {
    items.push(item({
      id: "workspace:no-history",
      kind: "action",
      accountId: null,
      accountName: null,
      title: "Trade history is empty",
      description: "Balances, consistency windows, qualifying days, and payout readiness need real trade records.",
      href: "/trades",
      action: "Add history",
      rank: 40,
    }))
  }

  for (const account of input.accounts) {
    const accountHref = `/accounts?account=${account.id}`
    if (account.status === "Breached") {
      items.push(item({
        id: `${account.id}:breached`,
        kind: "blocker",
        accountId: account.id,
        accountName: account.name,
        title: "Account is breached",
        description: "Keep this account out of the trading rotation. Its risk and payout actions are disabled.",
        href: accountHref,
        action: "Review account",
        rank: 0,
      }))
      continue
    }

    if (account.status === "Passed" && account.type === "Eval") {
      items.push(item({
        id: `${account.id}:passed`,
        kind: "action",
        accountId: account.id,
        accountName: account.name,
        title: "Evaluation is marked passed",
        description: "Record the funded activation only after the firm confirms the new account and its exact payout configuration.",
        href: accountHref,
        action: "Review activation",
        rank: 12,
      }))
    }

    if (account.drawdownType === "Intraday" && account.manualIntradayFloor == null && account.manualDrawdownRemaining == null) {
      items.push(item({
        id: `${account.id}:live-floor`,
        kind: "blocker",
        accountId: account.id,
        accountName: account.name,
        title: "Live intraday floor is missing",
        description: "The current platform floor must be entered before live drawdown room can be trusted.",
        href: accountHref,
        action: "Update floor",
        rank: 2,
      }))
    }

    try {
      const rules = getAccountRules(account)
      const stats = applyIntradayManualDrawdownToStats(
        account,
        calculateAccountStats(account, input.trades, input.payouts),
      )
      const profile = resolveRiskProfile(account, input.userRiskProfile, input.instrumentSpecs)

      if (!stats.isSafe) {
        items.push(item({
          id: `${account.id}:floor`,
          kind: "blocker",
          accountId: account.id,
          accountName: account.name,
          title: "Account is at or below its active floor",
          description: "Do not place another trade. Confirm the platform balance and account status before taking action.",
          href: accountHref,
          action: "Review floor",
          rank: 1,
        }))
      } else if (profile) {
        const plannedLoss = riskPerTrade(profile)
        if (plannedLoss >= stats.drawdownRemaining) {
          items.push(item({
            id: `${account.id}:planned-loss`,
            kind: "watch",
            accountId: account.id,
            accountName: account.name,
            title: "Configured loss can reach the floor",
            description: `The saved ${profile.contracts}-contract risk plan is not covered by the remaining drawdown room.`,
            href: accountHref,
            action: "Review risk",
            rank: 20,
          }))
        }
      }

      if (rules.hasConsistency) {
        const consistency = getConsistencyInfo(account.id, input.trades, account, input.payouts)
        if (!consistency.isValid && consistency.totalProfit > 0) {
          items.push(item({
            id: `${account.id}:consistency`,
            kind: "watch",
            accountId: account.id,
            accountName: account.name,
            title: "Consistency requirement is not met",
            description: consistency.additionalProfitNeeded > 0
              ? `$${consistency.additionalProfitNeeded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} additional profit is required by the verified consistency calculation.`
              : "The largest winning day is outside the verified consistency limit for this account.",
            href: account.type === "PA" ? "/payouts" : accountHref,
            action: "Review consistency",
            rank: 22,
          }))
        }
      }

      if (account.type === "PA" && rules.hasPayouts) {
        const eligibility = getPayoutEligibility(account.id, input.trades, account, input.payouts)
        if (eligibility?.isEligible) {
          items.push(item({
            id: `${account.id}:payout-ready`,
            kind: "ready",
            accountId: account.id,
            accountName: account.name,
            title: "Payout requirements are complete",
            description: "Every currently verified requirement is met. Confirm the firm portal before recording the request.",
            href: "/payouts",
            action: "Verify payout",
            rank: 15,
          }))
        } else if (eligibility?.missingConditions[0]) {
          items.push(item({
            id: `${account.id}:next-payout-step`,
            kind: "action",
            accountId: account.id,
            accountName: account.name,
            title: "Next payout requirement",
            description: eligibility.missingConditions[0],
            href: "/payouts",
            action: "Open payout plan",
            rank: 35,
          }))
        }
      }
    } catch {
      items.push(item({
        id: `${account.id}:rules`,
        kind: "blocker",
        accountId: account.id,
        accountName: account.name,
        title: "Verified rules are unavailable",
        description: "This configuration does not resolve to a verified rule set. Thresholds and payout guidance are withheld.",
        href: accountHref,
        action: "Fix configuration",
        rank: 3,
      }))
    }
  }

  return items.sort((a, b) => a.rank - b.rank || (a.accountName ?? "").localeCompare(b.accountName ?? ""))
}

export function summarizeCompliance(items: readonly ComplianceItem[]) {
  return {
    blockers: items.filter((entry) => entry.kind === "blocker").length,
    actions: items.filter((entry) => entry.kind === "action").length,
    watches: items.filter((entry) => entry.kind === "watch").length,
    ready: items.filter((entry) => entry.kind === "ready").length,
  }
}
