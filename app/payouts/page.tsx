"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Trash2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { PayoutStatusPanel } from "@/components/payout-status-panel"
import { PayoutImpactPlanner } from "@/components/payout-impact-planner"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useToast } from "@/hooks/use-toast"
import { buildPayoutWorkspace, summarizePayoutWorkspace } from "@/lib/payouts-workspace"
import { createPayout, deletePayout } from "@/lib/supabase/database"
import { getAccountRules } from "@/lib/rules"
import type { Payout } from "@/lib/types"
import { cn, formatCurrency } from "@/lib/utils"
import { buildCapitalMetrics } from "@/lib/capital-metrics"

function Stat({ label, value, supporting }: { label: string; value: string; supporting: string }) {
  return <div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p><p className="mt-2 font-mono text-xl font-medium">{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{supporting}</p></div>
}

function localDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PayoutsPage() {
  const { accounts, trades, payouts, loading, error, setPayouts } = useDashboardData()
  const { toast } = useToast()
  const [requestedAccountId, setRequestedAccountId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Payout | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const rows = useMemo(() => buildPayoutWorkspace(accounts, trades, payouts), [accounts, trades, payouts])
  const summary = useMemo(() => summarizePayoutWorkspace(rows, payouts), [rows, payouts])
  const capital = useMemo(() => buildCapitalMetrics(accounts, payouts), [accounts, payouts])

  const defaultSelection = rows.find((row) => row.isReady) ?? rows.find((row) => row.rulesAvailable) ?? rows[0] ?? null
  const selected = rows.find((row) => row.account.id === requestedAccountId) ?? defaultSelection
  const selectedAccountId = selected?.account.id ?? null
  const sortedPayouts = [...payouts].sort((a, b) => b.date.localeCompare(a.date) || b.payoutNumber - a.payoutNumber)
  const accountMap = new Map(accounts.map((account) => [account.id, account]))

  const handleAddPayout = async (input: { date: string; amount: number; notes?: string }) => {
    if (!selected?.eligibility) return
    let rules
    try {
      rules = getAccountRules(selected.account)
    } catch {
      toast({ variant: "destructive", title: "Payout rules unavailable", description: "The payout was not recorded." })
      return
    }
    const result = await createPayout({
      accountId: selected.account.id,
      date: input.date,
      amount: input.amount,
      payoutNumber: selected.accountPayouts.length + 1,
      notes: input.notes,
      traderReceived: input.amount * rules.payoutSplit,
      firmSplit: input.amount * (1 - rules.payoutSplit),
      payoutSplitPercent: rules.payoutSplit,
    })
    if (result.error || !result.data) {
      toast({ variant: "destructive", title: "Payout was not recorded", description: result.error?.message ?? "No record returned." })
      return
    }
    setPayouts((current) => [...current, result.data!])
    toast({ title: "Payout recorded", description: `${formatCurrency(input.amount)} gross added to ${selected.account.name}.` })
  }

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    const result = await deletePayout(deleting.id)
    setIsDeleting(false)
    if (result.error) {
      toast({ variant: "destructive", title: "Payout was not deleted", description: result.error.message })
      return
    }
    setPayouts((current) => current.filter((payout) => payout.id !== deleting.id))
    setDeleting(null)
    toast({ title: "Payout deleted", description: "Account balance and payout-cycle metrics have been recalculated." })
  }

  return (
    <AppShell eyebrow="Capital" title="Payouts" description="Prioritize funded accounts, verify every condition, and keep withdrawals auditable.">
      {error && <div role="alert" className="mb-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">Some payout data could not load: {error}</div>}

      <section className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ready now" value={loading ? "—" : String(summary.readyAccounts)} supporting={`${summary.fundedAccounts} funded accounts`} />
        <Stat label="Available gross" value={loading ? "—" : formatCurrency(summary.availableGross)} supporting="Across verified rule sets" />
        <Stat label="Recorded gross" value={loading ? "—" : formatCurrency(summary.recordedGross)} supporting={`${payouts.length} completed payouts`} />
        <Stat label="Rule coverage" value={loading ? "—" : summary.rulesUnavailable ? `${summary.rulesUnavailable} unavailable` : "Complete"} supporting="Unknown configurations fail closed" />
      </section>

      {loading ? (
        <div className="mt-6 border border-[var(--hairline)] bg-[var(--surface)] px-5 py-16 text-center text-sm text-[var(--muted)]">Calculating payout readiness…</div>
      ) : rows.length === 0 ? (
        <div className="mt-6 border border-[var(--hairline)] bg-[var(--surface)] px-6 py-16 text-center"><p className="text-base font-medium">No funded accounts yet</p><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">Convert an eligible evaluation or add a funded account. Payout rules will appear only when the configuration is verified.</p><Button asChild className="mt-5"><Link href="/">Open accounts</Link></Button></div>
      ) : (
        <div className="mt-6 grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="border border-[var(--hairline)] bg-[var(--surface)]">
            <div className="border-b border-[var(--hairline)] px-4 py-3"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Funded queue</p><p className="mt-1 text-sm">Ordered by readiness</p></div>
            <div className="divide-y divide-[var(--hairline)]">
              {rows.map((row) => {
                const active = row.account.id === selectedAccountId
                const available = row.eligibility?.maxWithdrawable
                return (
                  <button key={row.account.id} type="button" onClick={() => setRequestedAccountId(row.account.id)} className={cn("flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--raised)]", active && "bg-[var(--raised)]")}>
                    <span className={cn("h-2 w-2 shrink-0 rounded-[2px]", row.isReady ? "bg-white" : "border border-[var(--faint)]")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.account.name}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{row.rulesAvailable ? row.isReady ? "Ready to request" : row.missingConditions[0] ?? "Requirements remaining" : "Rules unavailable"}</span>
                    </span>
                    <span className="text-right"><span className="block font-mono text-xs">{row.rulesAvailable && available != null ? formatCurrency(available) : "Unavailable"}</span><span className="mt-1 block text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Gross</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--faint)]" />
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            {selected?.rulesAvailable && selected.eligibility && selected.account.status === "Active" ? (
              <>
                <PayoutStatusPanel account={selected.account} eligibility={selected.eligibility} payouts={selected.accountPayouts} onAddPayout={handleAddPayout} />
                <PayoutImpactPlanner key={selected.account.id} account={selected.account} trades={trades} payouts={payouts} minAmount={selected.eligibility.minPayoutAmount} maxAmount={selected.eligibility.maxWithdrawable} eligible={selected.eligibility.isEligible} />
              </>
            ) : (
              <div className="border border-[var(--hairline)] bg-[var(--surface)] p-6"><p className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Withdrawal readiness</p><h2 className="mt-2 text-lg font-medium">Payout data unavailable</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">{selected?.account.status !== "Active" ? `This account is ${selected?.account.status.toLowerCase()}. Readiness is calculated only for active funded accounts.` : selected?.unavailableReason ?? "A verified rule set could not be resolved."}</p></div>
            )}
          </section>
        </div>
      )}

      <section className="mt-8 border border-[var(--hairline)] bg-[var(--surface)]">
        <div className="border-b border-[var(--hairline)] px-5 py-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Tracked capital</p><h2 className="mt-1 text-base font-medium">Payout economics</h2><p className="mt-1 text-xs text-[var(--muted)]">Only amounts present in saved payout records are included. Cost-based ROI remains unavailable until account fees are tracked.</p></div>
        <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Gross payouts" value={formatCurrency(capital.grossPayouts)} supporting={`${payouts.length} recorded requests`} />
          <Stat label="Trader proceeds" value={capital.traderProceeds == null ? "Unavailable" : formatCurrency(capital.traderProceeds)} supporting="Withheld if any split is missing" />
          <Stat label="Tracked conversion" value={capital.trackedConversionRate == null ? "Unavailable" : `${Math.round(capital.trackedConversionRate * 100)}%`} supporting={`${capital.trackedFundedConversions} of ${capital.trackedEvaluations} tracked evaluations`} />
          <Stat label="Time to first payout" value={capital.averageDaysToFirstPayout == null ? "Unavailable" : `${Math.round(capital.averageDaysToFirstPayout)}d`} supporting={`${capital.fundedAccountsWithPayout} funded accounts paid`} />
        </div>
      </section>

      <section className="mt-8 border border-[var(--hairline)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4"><div><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Ledger</p><h2 className="mt-1 text-base font-medium">Payout history</h2></div><span className="font-mono text-xs text-[var(--muted)]">{payouts.length} records</span></div>
        {sortedPayouts.length ? <div className="divide-y divide-[var(--hairline)]">{sortedPayouts.map((payout) => {
          const account = accountMap.get(payout.accountId)
          return <div key={payout.id} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[1fr_150px_150px_44px]"><div className="min-w-0"><p className="truncate text-sm">{account?.name ?? "Unavailable account"}</p><p className="mt-1 text-[10px] text-[var(--muted)]">Payout {payout.payoutNumber} · {localDate(payout.date)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Gross</p><p className="mt-1 font-mono text-sm">{formatCurrency(payout.amount)}</p></div><div><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Trader received</p><p className="mt-1 font-mono text-sm">{payout.traderReceived == null ? "Unavailable" : formatCurrency(payout.traderReceived)}</p></div><Button variant="ghost" size="icon" onClick={() => setDeleting(payout)} aria-label="Delete payout"><Trash2 /></Button></div>
        })}</div> : <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">No payouts have been recorded.</p>}
      </section>

      <DeleteConfirmationModal open={deleting != null} onOpenChange={(open) => { if (!open) setDeleting(null) }} title="Delete payout record?" description="This will restore the amount to calculated account balance and reopen the affected payout cycle." warningText="Use this only to correct an inaccurate record." itemDetails={deleting ? <div className="flex items-center justify-between"><span className="text-sm">{accountMap.get(deleting.accountId)?.name ?? "Account"}</span><span className="font-mono text-sm">{formatCurrency(deleting.amount)}</span></div> : undefined} onConfirm={handleDelete} isDeleting={isDeleting} confirmText="Delete payout" />
    </AppShell>
  )
}
