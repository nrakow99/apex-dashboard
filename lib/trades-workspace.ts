import type { Account, Trade } from "./types"
import { hasPersistedTradeMeta } from "./trade-meta"

export type TradeWorkspaceFilter = "all" | "wins" | "losses" | "unreviewed" | "imports"

export function hasTradeReview(trade: Trade): boolean {
  return Boolean(trade.notes?.trim()) || hasPersistedTradeMeta(trade)
}

export function tradeReviewAreaCount(trade: Trade): number {
  return [
    Boolean(trade.session || trade.direction || trade.entryPrice != null || trade.exitPrice != null || trade.contracts != null),
    Boolean(trade.grade || trade.setupTags?.length),
    Boolean(trade.disciplineTags?.length),
    Boolean(trade.notes?.trim()),
  ].filter(Boolean).length
}

export function summarizeTradeWorkspace(trades: Trade[]) {
  const wins = trades.filter((trade) => trade.pnl > 0).length
  const losses = trades.filter((trade) => trade.pnl < 0).length
  const reviewed = trades.filter(hasTradeReview).length
  return {
    records: trades.length,
    totalPnl: trades.reduce((sum, trade) => sum + trade.pnl, 0),
    wins,
    losses,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
    reviewed,
    reviewCoverage: trades.length > 0 ? (reviewed / trades.length) * 100 : null,
    imported: trades.filter((trade) => trade.importSource === "screenshot").length,
  }
}

export function filterWorkspaceTrades(
  trades: Trade[],
  accounts: Account[],
  options: { accountId: string; filter: TradeWorkspaceFilter; query: string },
): Trade[] {
  const accountNames = new Map(accounts.map((account) => [account.id, account.name.toLowerCase()]))
  const query = options.query.trim().toLowerCase()
  return trades
    .filter((trade) => options.accountId === "all" || trade.accountId === options.accountId)
    .filter((trade) => {
      if (options.filter === "wins") return trade.pnl > 0
      if (options.filter === "losses") return trade.pnl < 0
      if (options.filter === "unreviewed") return !hasTradeReview(trade)
      if (options.filter === "imports") return trade.importSource === "screenshot"
      return true
    })
    .filter((trade) => {
      if (!query) return true
      return [
        trade.symbol,
        trade.notes,
        accountNames.get(trade.accountId),
        ...(trade.setupTags ?? []),
        ...(trade.disciplineTags ?? []),
      ].some((value) => value?.toLowerCase().includes(query))
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}
