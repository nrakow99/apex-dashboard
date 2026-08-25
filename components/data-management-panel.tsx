"use client"

import Link from "next/link"
import { Download, FileJson, TableProperties } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildDataHealth } from "@/lib/data-health"
import { exportAccountCostsCsv, exportPayoutsCsv, exportTradesCsv, exportWorkspaceJson } from "@/lib/data-export"
import type { Account, AccountCost, Payout, Trade } from "@/lib/types"

interface Props { accounts: Account[]; trades: Trade[]; payouts: Payout[]; accountCosts: AccountCost[] | null }

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportDate() { return new Date().toISOString().slice(0, 10) }

export function DataManagementPanel({ accounts, trades, payouts, accountCosts }: Props) {
  const health = buildDataHealth(accounts, trades, payouts)
  const checks = [
    ["Unsupported rule configurations", health.unsupportedRuleAccounts],
    ["Possible duplicate trade groups", health.possibleDuplicateGroups],
    ["Orphaned trade records", health.orphanedTrades],
    ["Orphaned payout records", health.orphanedPayouts],
    ["Payouts missing saved split", health.payoutsMissingSplit],
    ["Low-confidence screenshot rows", health.lowConfidenceImports],
  ] as const

  return (
    <section className="border border-[var(--hairline)] bg-[var(--surface)]">
      <div className="flex flex-col gap-4 border-b border-[var(--hairline)] px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Ownership</p><h2 className="mt-1 text-base font-medium">Data quality and exports</h2><p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[var(--muted)]">Download portable copies of the current workspace. Exports preserve unavailable fields as blank rather than replacing them with zero.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadText(`propdash-workspace-${exportDate()}.json`, exportWorkspaceJson(accounts, trades, payouts, accountCosts, new Date().toISOString()), "application/json")}><FileJson />Workspace JSON</Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(`propdash-trades-${exportDate()}.csv`, exportTradesCsv(trades, accounts), "text/csv")}><TableProperties />Trades CSV</Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(`propdash-payouts-${exportDate()}.csv`, exportPayoutsCsv(payouts, accounts), "text/csv")}><Download />Payouts CSV</Button>
          <Button variant="outline" size="sm" disabled={accountCosts == null} onClick={() => accountCosts && downloadText(`propdash-costs-${exportDate()}.csv`, exportAccountCostsCsv(accountCosts, accounts), "text/csv")}><Download />Costs CSV</Button>
        </div>
      </div>
      <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-3">
        {checks.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 bg-[var(--surface)] px-5 py-4"><span className="text-xs text-[var(--muted)]">{label}</span><span className="font-mono text-sm">{value}</span></div>)}
      </div>
      <div className="flex flex-col gap-3 border-t border-[var(--hairline)] px-5 py-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between"><p>{health.issueCount === 0 ? "No structural data issues detected." : `${health.issueCount} review item${health.issueCount === 1 ? "" : "s"} detected. Possible duplicates are candidates, not automatic deletions.`}</p><Button asChild variant="ghost" size="sm"><Link href="/trades">Review trade records</Link></Button></div>
    </section>
  )
}
