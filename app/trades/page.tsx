"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { AddTradeModal } from "@/components/add-trade-modal"
import { ScreenshotImportModal } from "@/components/screenshot-import-modal"
import { GlobalTradesTable } from "@/components/global-trades-table"
import { EditTradeModal } from "@/components/edit-trade-modal"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useToast } from "@/hooks/use-toast"
import { createTrade, deleteTrade, updateTrade } from "@/lib/supabase/database"
import { filterWorkspaceTrades, summarizeTradeWorkspace, type TradeWorkspaceFilter } from "@/lib/trades-workspace"
import type { Trade } from "@/lib/types"
import type { TradeMeta } from "@/lib/trade-meta"
import { cn, formatPnL, pnlColorClass } from "@/lib/utils"

const filters: { value: TradeWorkspaceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wins", label: "Wins" },
  { value: "losses", label: "Losses" },
  { value: "unreviewed", label: "Needs review" },
  { value: "imports", label: "Imports" },
]

function Stat({ label, value, supporting, valueClass }: { label: string; value: string; supporting: string; valueClass?: string }) {
  return <div className="border border-[var(--hairline)] bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p><p className={cn("mt-2 font-mono text-xl font-medium", valueClass)}>{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{supporting}</p></div>
}

export default function TradesPage() {
  const { accounts, trades, userRiskProfile, loading, error, reload, setTrades } = useDashboardData()
  const { toast } = useToast()
  const [accountId, setAccountId] = useState("all")
  const [filter, setFilter] = useState<TradeWorkspaceFilter>("all")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Trade | null>(null)
  const [deleting, setDeleting] = useState<Trade | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredTrades = useMemo(() => filterWorkspaceTrades(trades, accounts, { accountId, filter, query }), [trades, accounts, accountId, filter, query])
  const summary = useMemo(() => summarizeTradeWorkspace(accountId === "all" ? trades : trades.filter((trade) => trade.accountId === accountId)), [trades, accountId])
  const activeAccounts = accounts.filter((account) => account.status === "Active")
  const defaultAccountId = activeAccounts[0]?.id ?? accounts[0]?.id ?? ""

  const handleAdd = async (trade: { date: string; symbol: string; pnl: number; notes?: string }, meta: TradeMeta, accountIds: string[]) => {
    const results = await Promise.all(accountIds.map((id) => createTrade({ ...trade, accountId: id }, meta)))
    const inserted = results.flatMap((result) => result.data ? [result.data] : [])
    setTrades((current) => [...current, ...inserted])
    const failures = results.filter((result) => result.error)
    toast({ title: failures.length ? "Trade saved with exceptions" : "Trade recorded", description: failures.length ? `${inserted.length} saved · ${failures.length} failed.` : `${inserted.length} account record${inserted.length === 1 ? "" : "s"} added.` })
  }

  const handleSave = async (tradeId: string, updates: { date: string; accountId: string; symbol: string; pnl: number; notes?: string }, meta: TradeMeta) => {
    setIsSaving(true)
    const result = await updateTrade(tradeId, updates, meta)
    setIsSaving(false)
    if (result.error || !result.data) {
      toast({ variant: "destructive", title: "Trade was not updated", description: result.error?.message ?? "No record returned." })
      return
    }
    setTrades((current) => current.map((trade) => trade.id === tradeId ? result.data! : trade))
    setEditing(null)
    toast({ title: "Trade updated" })
  }

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    const result = await deleteTrade(deleting.id)
    setIsDeleting(false)
    if (result.error) {
      toast({ variant: "destructive", title: "Trade was not deleted", description: result.error.message })
      return
    }
    setTrades((current) => current.filter((trade) => trade.id !== deleting.id))
    setDeleting(null)
    toast({ title: "Trade deleted" })
  }

  return (
    <AppShell
      eyebrow="Journal"
      title="Trades"
      description="Search every account record, finish reviews, and keep imported history clean."
      actions={accounts.length > 0 ? <><ScreenshotImportModal accounts={accounts} selectedAccountId={defaultAccountId} existingTrades={trades} onImported={async (result) => { await reload(); toast({ title: result.insertedCount ? "History imported" : "No new rows imported", description: `${result.insertedCount} added · ${result.duplicateCount} duplicates skipped.` }) }} /><AddTradeModal accounts={activeAccounts.length ? activeAccounts : accounts} selectedAccountId={defaultAccountId} userDefaultRiskProfile={userRiskProfile} onAddTrade={handleAdd} /></> : <Button asChild><Link href="/">Add an account</Link></Button>}
    >
      {error && <div role="alert" className="mb-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">Some workspace data could not load: {error}</div>}

      <section className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net P&L" value={summary.records ? formatPnL(summary.totalPnl) : "Unavailable"} supporting={`${summary.records} account-level records`} valueClass={summary.records ? pnlColorClass(summary.totalPnl) : undefined} />
        <Stat label="Win rate" value={summary.winRate == null ? "Unavailable" : `${summary.winRate.toFixed(1)}%`} supporting={`${summary.wins} wins · ${summary.losses} losses`} />
        <Stat label="Review coverage" value={summary.reviewCoverage == null ? "Unavailable" : `${summary.reviewCoverage.toFixed(0)}%`} supporting={`${summary.reviewed} of ${summary.records} reviewed`} />
        <Stat label="Screenshot imports" value={String(summary.imported)} supporting="Reviewed aggregate rows" />
      </section>

      <section className="mt-6 border border-[var(--hairline)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol, account, setup, or note" aria-label="Search trades" className="h-10 w-full rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] pl-9 pr-3 text-sm outline-none focus:border-[var(--faint)]" />
          </div>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Filter by account" className="h-10 min-w-[190px] rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 text-xs outline-none focus:border-[var(--faint)]">
            <option value="all">All accounts</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <div className="flex max-w-full gap-1 overflow-x-auto" aria-label="Trade result filters">
            {filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("h-10 whitespace-nowrap rounded-[2px] border px-3 text-xs transition-colors", filter === item.value ? "border-[var(--text)] bg-[var(--text)] text-[var(--ground)]" : "border-[var(--hairline)] bg-[var(--raised)] text-[var(--muted)] hover:text-[var(--text)]")}>{item.label}</button>)}
          </div>
        </div>
      </section>

      <div className="mt-3">
        {loading ? <div className="border border-[var(--hairline)] bg-[var(--surface)] px-5 py-16 text-center text-sm text-[var(--muted)]">Loading trade records…</div> : <GlobalTradesTable trades={filteredTrades} accounts={accounts} onEdit={setEditing} onDelete={setDeleting} />}
      </div>

      <EditTradeModal trade={editing} accounts={accounts} open={editing != null} onOpenChange={(open) => { if (!open) setEditing(null) }} onSave={handleSave} isSaving={isSaving} />
      <DeleteConfirmationModal open={deleting != null} onOpenChange={(open) => { if (!open) setDeleting(null) }} title="Delete trade record?" description="This permanently removes the record from account metrics and payout calculations." warningText="This action cannot be undone." itemDetails={deleting ? <div className="flex items-center justify-between"><span className="font-mono text-sm">{deleting.symbol} · {deleting.date}</span><span className={cn("font-mono text-sm", pnlColorClass(deleting.pnl))}>{formatPnL(deleting.pnl)}</span></div> : undefined} onConfirm={handleDelete} isDeleting={isDeleting} confirmText="Delete trade" />
    </AppShell>
  )
}
