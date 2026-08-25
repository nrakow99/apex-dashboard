import { getAccountRules } from "./rules"
import type { Account, Payout, Trade } from "./types"

export interface DataHealthReport {
  possibleDuplicateGroups: number
  possibleDuplicateRecords: number
  orphanedTrades: number
  orphanedPayouts: number
  unsupportedRuleAccounts: number
  payoutsMissingSplit: number
  lowConfidenceImports: number
  issueCount: number
}

export function buildDataHealth(accounts: Account[], trades: Trade[], payouts: Payout[]): DataHealthReport {
  const accountIds = new Set(accounts.map((account) => account.id))
  const duplicateCounts = new Map<string, number>()
  for (const trade of trades) {
    const key = [trade.accountId, trade.date, trade.symbol.toUpperCase(), trade.pnl].join("|")
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1)
  }
  const duplicateGroups = [...duplicateCounts.values()].filter((count) => count > 1)
  const unsupportedRuleAccounts = accounts.filter((account) => {
    try {
      getAccountRules(account)
      return false
    } catch {
      return true
    }
  }).length

  const report = {
    possibleDuplicateGroups: duplicateGroups.length,
    possibleDuplicateRecords: duplicateGroups.reduce((sum, count) => sum + count, 0),
    orphanedTrades: trades.filter((trade) => !accountIds.has(trade.accountId)).length,
    orphanedPayouts: payouts.filter((payout) => !accountIds.has(payout.accountId)).length,
    unsupportedRuleAccounts,
    payoutsMissingSplit: payouts.filter((payout) => payout.traderReceived == null || payout.firmSplit == null).length,
    lowConfidenceImports: trades.filter((trade) => trade.importSource === "screenshot" && trade.extractionConfidence === "low").length,
    issueCount: 0,
  }
  report.issueCount = report.possibleDuplicateGroups + report.orphanedTrades + report.orphanedPayouts + report.unsupportedRuleAccounts + report.payoutsMissingSplit + report.lowConfidenceImports
  return report
}
