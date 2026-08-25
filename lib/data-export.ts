import type { Account, AccountCost, Payout, Trade } from "./types"

function csvCell(value: unknown): string {
  if (value == null) return ""
  const valueText = String(value)
  return /[",\n]/.test(valueText) ? `"${valueText.replaceAll('"', '""')}"` : valueText
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n"
}

export function exportTradesCsv(trades: Trade[], accounts: Account[]): string {
  const names = new Map(accounts.map((account) => [account.id, account.name]))
  return csv([
    ["date", "account", "account_id", "symbol", "net_pnl", "source", "session", "direction", "grade", "setups", "process_tags", "notes"],
    ...trades.map((trade) => [trade.date, names.get(trade.accountId) ?? "Unavailable account", trade.accountId, trade.symbol, trade.pnl, trade.importSource ?? "manual", trade.session ?? "", trade.direction ?? "", trade.grade ?? "", trade.setupTags?.join("|") ?? "", trade.disciplineTags?.join("|") ?? "", trade.notes ?? ""]),
  ])
}

export function exportPayoutsCsv(payouts: Payout[], accounts: Account[]): string {
  const names = new Map(accounts.map((account) => [account.id, account.name]))
  return csv([
    ["date", "account", "account_id", "payout_number", "gross_amount", "trader_received", "firm_split", "trader_split_percent", "notes"],
    ...payouts.map((payout) => [payout.date, names.get(payout.accountId) ?? "Unavailable account", payout.accountId, payout.payoutNumber, payout.amount, payout.traderReceived ?? "", payout.firmSplit ?? "", payout.payoutSplitPercent ?? "", payout.notes ?? ""]),
  ])
}

export function exportAccountCostsCsv(costs: AccountCost[], accounts: Account[]): string {
  const names = new Map(accounts.map((account) => [account.id, account.name]))
  return csv([
    ["date", "account", "account_id", "category", "amount", "notes"],
    ...costs.map((cost) => [cost.date, names.get(cost.accountId) ?? "Unavailable account", cost.accountId, cost.category, cost.amount, cost.notes ?? ""]),
  ])
}

export function exportWorkspaceJson(accounts: Account[], trades: Trade[], payouts: Payout[], accountCosts: AccountCost[] | null, generatedAt: string): string {
  return JSON.stringify({ format: "propdash-workspace", version: 2, generatedAt, accounts, trades, payouts, accountCosts }, null, 2)
}
