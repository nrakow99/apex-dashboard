import { getHeadroom, resolveRiskProfile } from "./headroom"
import type { ComplianceItem } from "./compliance-center"
import type { TodayAccount } from "./today-dashboard"
import type { Account, InstrumentSpec, RiskProfile } from "./types"

export type VerdictPrimary =
  | "request_payout"
  | "protect"
  | "eligible"
  | "blocked"
  | "needs_data"

export type VerdictConstraintKind =
  | "payout_progress"
  | "consistency"
  | "risk_watch"
  | "account_action"

export interface VerdictConstraint {
  kind: VerdictConstraintKind
  title: string
  detail: string
  href: string
}

export interface AccountVerdict {
  account: Account
  primary: VerdictPrimary
  reason: string
  dollarsOfRoom: number | null
  tradesOfRoom: number | null
  todayPnl: number
  rank: number | null
  constraints: VerdictConstraint[]
}

export interface PortfolioVerdict {
  accounts: AccountVerdict[]
  counts: Record<VerdictPrimary, number>
  focus: AccountVerdict | null
  headline: string
  summary: string
}

export interface VerdictInputs {
  rows: readonly TodayAccount[]
  complianceItems: readonly ComplianceItem[]
  instrumentSpecs: readonly InstrumentSpec[]
  userRiskProfile: RiskProfile | null
}

export interface VerdictDelta {
  accountId: string
  accountName: string
  previous: VerdictPrimary
  current: VerdictPrimary
  dollarsOfRoomChange: number | null
  tradesOfRoomChange: number | null
}

const hardBlockSuffixes = [":breached", ":floor"]
const missingDataSuffixes = [":rules", ":live-floor"]

function itemsForAccount(items: readonly ComplianceItem[], accountId: string): ComplianceItem[] {
  return items.filter((item) => item.accountId === accountId)
}

function hasSuffix(items: readonly ComplianceItem[], suffixes: readonly string[]): boolean {
  return items.some((item) => suffixes.some((suffix) => item.id.endsWith(suffix)))
}

function constraintKind(item: ComplianceItem): VerdictConstraintKind {
  if (item.id.endsWith(":consistency")) return "consistency"
  if (item.id.endsWith(":planned-loss")) return "risk_watch"
  if (item.id.includes("payout")) return "payout_progress"
  return "account_action"
}

function constraintsFor(row: TodayAccount, items: readonly ComplianceItem[]): VerdictConstraint[] {
  const constraints = items
    .filter((item) => item.kind === "watch" || item.kind === "action")
    .map((item) => ({
      kind: constraintKind(item),
      title: item.title,
      detail: item.description,
      href: item.href,
    }))

  if (
    row.account.type === "PA" &&
    !row.payoutReady &&
    row.payoutMissing[0] &&
    !constraints.some((constraint) => constraint.kind === "payout_progress")
  ) {
    constraints.push({
      kind: "payout_progress",
      title: "Next payout requirement",
      detail: row.payoutMissing[0],
      href: "/payouts",
    })
  }

  return constraints
}

function baseVerdict(
  row: TodayAccount,
  items: readonly ComplianceItem[],
  instrumentSpecs: readonly InstrumentSpec[],
  userRiskProfile: RiskProfile | null,
): AccountVerdict {
  const accountItems = itemsForAccount(items, row.account.id)
  const profile = resolveRiskProfile(row.account, userRiskProfile, instrumentSpecs)
  const headroom = row.drawdownRemaining == null
    ? { dollars: null, trades: null }
    : getHeadroom(row.drawdownRemaining, profile)
  const constraints = constraintsFor(row, accountItems)

  const common = {
    account: row.account,
    dollarsOfRoom: headroom.dollars,
    tradesOfRoom: headroom.trades,
    todayPnl: row.todayPnl,
    rank: null,
    constraints,
  }

  if (!row.rulesAvailable || hasSuffix(accountItems, missingDataSuffixes)) {
    const missing = accountItems.find((item) => missingDataSuffixes.some((suffix) => item.id.endsWith(suffix)))
    return {
      ...common,
      primary: "needs_data",
      reason: missing?.description ?? "Verified account rules are unavailable. Fix the configuration before relying on this account.",
    }
  }

  if (row.breached || hasSuffix(accountItems, hardBlockSuffixes)) {
    const blocker = accountItems.find((item) => hardBlockSuffixes.some((suffix) => item.id.endsWith(suffix)))
    return {
      ...common,
      primary: "blocked",
      reason: blocker?.description ?? "This account is breached or at its active floor. Keep it out of rotation.",
    }
  }

  if (row.account.status === "Passed" && row.account.type === "Eval") {
    return {
      ...common,
      primary: "protect",
      reason: "The evaluation is marked passed. Keep it out of rotation until the funded account is confirmed.",
    }
  }

  if (row.payoutReady) {
    return {
      ...common,
      primary: "request_payout",
      reason: "Saved requirements are complete. Confirm live values in the firm portal before requesting.",
    }
  }

  if (headroom.trades != null && headroom.trades < 1) {
    return {
      ...common,
      primary: "protect",
      reason: "The configured full-stop loss is not covered by the remaining account loss-room.",
    }
  }

  return {
    ...common,
    primary: "eligible",
    reason: headroom.trades == null
      ? "Verified dollar loss-room is available. Add a complete risk profile to estimate full-stop losses."
      : "Eligible for today’s rotation based on the saved account state.",
  }
}

function rankEligible(accounts: AccountVerdict[]): AccountVerdict[] {
  const ranked = accounts
    .filter((verdict) => verdict.primary === "eligible")
    .sort((a, b) => {
      if (a.tradesOfRoom != null || b.tradesOfRoom != null) {
        const roomOrder = (b.tradesOfRoom ?? -1) - (a.tradesOfRoom ?? -1)
        if (roomOrder !== 0) return roomOrder
      } else {
        const roomOrder = (b.dollarsOfRoom ?? -1) - (a.dollarsOfRoom ?? -1)
        if (roomOrder !== 0) return roomOrder
      }
      return a.account.name.localeCompare(b.account.name) || a.account.id.localeCompare(b.account.id)
    })

  const ranks = new Map(ranked.map((verdict, index) => [verdict.account.id, index + 1]))
  return accounts.map((verdict) => ({ ...verdict, rank: ranks.get(verdict.account.id) ?? null }))
}

function portfolioCopy(accounts: readonly AccountVerdict[]) {
  const blocked = accounts.filter((item) => item.primary === "blocked")
  const missing = accounts.filter((item) => item.primary === "needs_data")
  const payouts = accounts.filter((item) => item.primary === "request_payout")
  const eligible = accounts.filter((item) => item.primary === "eligible").sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
  const protectedAccounts = accounts.filter((item) => item.primary === "protect")

  if (blocked[0]) return {
    focus: blocked[0],
    headline: `Keep ${blocked[0].account.name} out of rotation`,
    summary: blocked[0].reason,
  }
  if (missing[0]) return {
    focus: missing[0],
    headline: `Update ${missing[0].account.name} before relying on it`,
    summary: missing[0].reason,
  }
  if (payouts[0]) return {
    focus: payouts[0],
    headline: `Verify the payout on ${payouts[0].account.name}`,
    summary: payouts[0].reason,
  }
  if (eligible[0]) return {
    focus: eligible[0],
    headline: `${eligible[0].account.name} leads today’s rotation`,
    summary: eligible[0].tradesOfRoom == null
      ? `${eligible[0].reason} It currently has the widest verified dollar loss-room among eligible accounts.`
      : `It has the strongest configured full-stop buffer among eligible accounts.`,
  }
  if (protectedAccounts[0]) return {
    focus: protectedAccounts[0],
    headline: "Protect the remaining accounts",
    summary: protectedAccounts[0].reason,
  }
  return {
    focus: null,
    headline: "Add a real account to build today’s verdict",
    summary: "PropDash needs an exact firm, program, stage, and size before it can resolve a trustworthy next action.",
  }
}

export function buildPortfolioVerdict(input: VerdictInputs): PortfolioVerdict {
  const accounts = rankEligible(input.rows.map((row) => baseVerdict(
    row,
    input.complianceItems,
    input.instrumentSpecs,
    input.userRiskProfile,
  )))
  const copy = portfolioCopy(accounts)

  return {
    accounts,
    counts: {
      request_payout: accounts.filter((item) => item.primary === "request_payout").length,
      protect: accounts.filter((item) => item.primary === "protect").length,
      eligible: accounts.filter((item) => item.primary === "eligible").length,
      blocked: accounts.filter((item) => item.primary === "blocked").length,
      needs_data: accounts.filter((item) => item.primary === "needs_data").length,
    },
    ...copy,
  }
}

export function comparePortfolioVerdicts(
  previous: PortfolioVerdict,
  current: PortfolioVerdict,
  accountIds: readonly string[],
): VerdictDelta[] {
  const wanted = new Set(accountIds)
  const previousById = new Map(previous.accounts.map((item) => [item.account.id, item]))

  return current.accounts
    .filter((item) => wanted.has(item.account.id))
    .flatMap((item) => {
      const before = previousById.get(item.account.id)
      if (!before) return []
      const dollarsOfRoomChange = before.dollarsOfRoom == null || item.dollarsOfRoom == null
        ? null
        : item.dollarsOfRoom - before.dollarsOfRoom
      const tradesOfRoomChange = before.tradesOfRoom == null || item.tradesOfRoom == null
        ? null
        : item.tradesOfRoom - before.tradesOfRoom
      const materiallyChanged = before.primary !== item.primary ||
        (dollarsOfRoomChange != null && Math.abs(dollarsOfRoomChange) >= 0.01) ||
        (tradesOfRoomChange != null && tradesOfRoomChange !== 0)
      if (!materiallyChanged) return []
      return [{
        accountId: item.account.id,
        accountName: item.account.name,
        previous: before.primary,
        current: item.primary,
        dollarsOfRoomChange,
        tradesOfRoomChange,
      }]
    })
}

export const verdictLabel: Record<VerdictPrimary, string> = {
  request_payout: "Request payout",
  protect: "Protect",
  eligible: "Eligible",
  blocked: "Blocked",
  needs_data: "Needs data",
}
