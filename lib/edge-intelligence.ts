import { buildTradeAnalytics, type AnalyticsBreakdownRow } from "./trade-analytics"
import type { ComplianceItem } from "./compliance-center"
import type { TodayAccount } from "./today-dashboard"
import type { Account, Trade } from "./types"

const MIN_PATTERN_RECORDS = 3
const MIN_PROCESS_RECORDS = 2

export interface EvidencePattern {
  dimension: "market" | "session" | "setup" | "process"
  label: string
  records: number
  pnl: number
  averagePnl: number
  winRate: number | null
}

export interface SameDayConcentration {
  date: string
  symbol: string
  accountCount: number
  recordCount: number
  netPnl: number
}

export interface RotationDecision {
  posture: "stop" | "protect" | "deploy" | "configure"
  title: string
  description: string
  accountId: string | null
  protectedAccountCount: number
}

function strongestPositive(
  dimension: EvidencePattern["dimension"],
  rows: readonly AnalyticsBreakdownRow[],
  minimumRecords: number,
): EvidencePattern | null {
  const row = rows
    .filter((candidate) => candidate.records >= minimumRecords && candidate.averagePnl > 0)
    .sort((a, b) => b.averagePnl - a.averagePnl || b.records - a.records)[0]
  return row ? { dimension, ...row } : null
}

function costliestNegative(
  rows: readonly AnalyticsBreakdownRow[],
): EvidencePattern | null {
  const row = rows
    .filter((candidate) => candidate.records >= MIN_PROCESS_RECORDS && candidate.averagePnl < 0)
    .sort((a, b) => a.averagePnl - b.averagePnl || b.records - a.records)[0]
  return row ? { dimension: "process", ...row } : null
}

/**
 * Builds evidence-backed observations from the trader's own reviewed records.
 * These are historical comparisons, never trade signals or prop-firm rules.
 */
export function buildBehavioralEdge(trades: readonly Trade[]) {
  const analytics = buildTradeAnalytics([...trades])
  const candidates = [
    strongestPositive("market", analytics.bySymbol, MIN_PATTERN_RECORDS),
    strongestPositive("session", analytics.bySession, MIN_PATTERN_RECORDS),
    strongestPositive("setup", analytics.bySetup, MIN_PATTERN_RECORDS),
    strongestPositive("process", analytics.keptProcess, MIN_PROCESS_RECORDS),
  ].filter((candidate): candidate is EvidencePattern => candidate != null)

  const provenPattern = candidates.sort(
    (a, b) => b.averagePnl - a.averagePnl || b.records - a.records,
  )[0] ?? null

  return {
    provenPattern,
    processLeak: costliestNegative(analytics.processLeaks),
    reviewCoverage: analytics.reviewCoverage,
    reviewedRecords: analytics.reviewed,
    totalRecords: analytics.records,
  }
}

/**
 * Finds repeated same-day, same-market activity across accounts. Trade data
 * has no reliable timestamps, so this intentionally says same-day rather than
 * claiming positions were simultaneous.
 */
export function buildSameDayConcentration(
  trades: readonly Trade[],
): SameDayConcentration[] {
  const groups = new Map<string, Trade[]>()
  for (const trade of trades) {
    const symbol = trade.symbol.trim().toUpperCase()
    if (!symbol) continue
    const key = `${trade.date}:${symbol}`
    groups.set(key, [...(groups.get(key) ?? []), trade])
  }

  return [...groups.entries()]
    .map(([key, records]) => {
      const split = key.indexOf(":")
      return {
        date: key.slice(0, split),
        symbol: key.slice(split + 1),
        accountCount: new Set(records.map((trade) => trade.accountId)).size,
        recordCount: records.length,
        netPnl: records.reduce((sum, trade) => sum + trade.pnl, 0),
      }
    })
    .filter((group) => group.accountCount >= 2)
    .sort((a, b) => b.date.localeCompare(a.date) || b.accountCount - a.accountCount)
}

/**
 * Chooses a capital-routing posture from already-resolved Today rows. It does
 * not invent position size or modify firm rules: payout-ready accounts are
 * protected, blocked accounts are excluded, and the remaining verified rows
 * are ordered by proportional loss-room.
 */
export function buildRotationDecision(
  rows: readonly TodayAccount[],
  complianceItems: readonly ComplianceItem[],
): RotationDecision {
  const blockerIds = new Set(
    complianceItems
      .filter((item) => item.kind === "blocker" && item.accountId)
      .map((item) => item.accountId as string),
  )
  const protectedRows = rows.filter(
    (row) => row.payoutReady && row.rulesAvailable && !row.breached,
  )
  const blockedRows = rows.filter(
    (row) => row.breached || !row.rulesAvailable || blockerIds.has(row.account.id),
  )
  const candidates = rows
    .filter(
      (row) =>
        !row.payoutReady &&
        row.rulesAvailable &&
        !row.breached &&
        !blockerIds.has(row.account.id) &&
        row.drawdownPercent != null &&
        row.drawdownRemaining != null,
    )
    .sort(
      (a, b) =>
        (b.drawdownPercent ?? -1) - (a.drawdownPercent ?? -1) ||
        (b.drawdownRemaining ?? -1) - (a.drawdownRemaining ?? -1),
    )

  if (blockedRows.length === rows.length && rows.length > 0) {
    return {
      posture: "stop",
      title: "Do not deploy new risk",
      description: "Every tracked account is blocked, breached, or missing verified rule data.",
      accountId: blockedRows[0]?.account.id ?? null,
      protectedAccountCount: protectedRows.length,
    }
  }

  const candidate = candidates[0]
  if (candidate) {
    const protectedCopy = protectedRows.length
      ? ` Keep ${protectedRows.length} payout-ready account${protectedRows.length === 1 ? "" : "s"} out of unnecessary rotation.`
      : ""
    return {
      posture: "deploy",
      title: `Best available buffer: ${candidate.account.name}`,
      description: `${candidate.account.name} has the widest verified proportional loss-room among active accounts that are not payout-ready.${protectedCopy}`,
      accountId: candidate.account.id,
      protectedAccountCount: protectedRows.length,
    }
  }

  if (protectedRows.length > 0) {
    return {
      posture: "protect",
      title: "Protect payout-ready capital",
      description: `${protectedRows.length} account${protectedRows.length === 1 ? " is" : "s are"} ready. Confirm the firm portal before taking avoidable new risk.`,
      accountId: protectedRows[0].account.id,
      protectedAccountCount: protectedRows.length,
    }
  }

  return {
    posture: "configure",
    title: rows.length ? "No verified rotation candidate" : "Add an account to route capital",
    description: rows.length
      ? "Resolve account configuration and risk blockers before comparing available loss-room."
      : "Cross-firm capital routing starts after an exact account configuration is saved.",
    accountId: rows[0]?.account.id ?? null,
    protectedAccountCount: 0,
  }
}

export function accountNamesForConcentration(
  group: SameDayConcentration,
  trades: readonly Trade[],
  accounts: readonly Account[],
): string[] {
  const ids = new Set(
    trades
      .filter(
        (trade) =>
          trade.date === group.date && trade.symbol.trim().toUpperCase() === group.symbol,
      )
      .map((trade) => trade.accountId),
  )
  return accounts.filter((account) => ids.has(account.id)).map((account) => account.name)
}
