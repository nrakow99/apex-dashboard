"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { buildComplianceItems, summarizeCompliance, type ComplianceKind } from "@/lib/compliance-center"
import { cn } from "@/lib/utils"
import { DemoDataBanner } from "@/components/demo-data-banner"

const filters: Array<{ value: "all" | ComplianceKind; label: string }> = [
  { value: "all", label: "All" },
  { value: "blocker", label: "Blockers" },
  { value: "action", label: "Actions" },
  { value: "watch", label: "Watch" },
  { value: "ready", label: "Ready" },
]

function Stat({ label, value, supporting }: { label: string; value: string; supporting: string }) {
  return <div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p><p className="mt-2 font-mono text-xl font-medium">{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{supporting}</p></div>
}

export default function CompliancePage() {
  const { accounts, trades, payouts, instrumentSpecs, userRiskProfile, loading, error } = useDashboardData()
  const [filter, setFilter] = useState<"all" | ComplianceKind>("all")
  const items = useMemo(() => buildComplianceItems({ accounts, trades, payouts, instrumentSpecs, userRiskProfile }), [accounts, instrumentSpecs, payouts, trades, userRiskProfile])
  const summary = useMemo(() => summarizeCompliance(items), [items])
  const visible = filter === "all" ? items : items.filter((entry) => entry.kind === filter)

  return (
    <AppShell eyebrow="Control" title="Compliance" description="One prioritized queue for account safety, rule configuration, and the next verified payout action.">
      <DemoDataBanner accounts={accounts} />
      {error && <div role="alert" className="mb-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">Some compliance inputs could not load: {error}</div>}

      <section className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Blockers" value={loading ? "—" : String(summary.blockers)} supporting="Do not rely on affected accounts" />
        <Stat label="Required actions" value={loading ? "—" : String(summary.actions)} supporting="Next steps with verified inputs" />
        <Stat label="Risk watches" value={loading ? "—" : String(summary.watches)} supporting="Configured risk or consistency" />
        <Stat label="Payout ready" value={loading ? "—" : String(summary.ready)} supporting="Portal confirmation still required" />
      </section>

      <section className="mt-6 border border-[var(--hairline)] bg-[var(--surface)]">
        <div className="flex flex-col gap-4 border-b border-[var(--hairline)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Prioritized queue</p><h2 className="mt-1 text-lg font-medium">What needs attention</h2></div>
          <div className="flex flex-wrap gap-1" aria-label="Compliance filters">
            {filters.map((option) => <button key={option.value} type="button" onClick={() => setFilter(option.value)} className={cn("h-8 rounded-[2px] px-3 text-xs", filter === option.value ? "bg-white text-black" : "bg-[var(--raised)] text-[var(--muted)] hover:text-white")}>{option.label}</button>)}
          </div>
        </div>

        {loading ? <p className="px-5 py-14 text-center text-sm text-[var(--muted)]">Evaluating verified rules and workspace data…</p> : visible.length === 0 ? (
          <div className="px-6 py-16 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-[var(--muted)]" /><p className="mt-4 text-base font-medium">No items in this view</p><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">The filter has no current actions. This does not replace checking the firm portal before a payout request.</p></div>
        ) : <div className="divide-y divide-[var(--hairline)]">{visible.map((entry) => (
          <div key={entry.id} className={cn("grid gap-4 px-5 py-5 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center", entry.kind === "blocker" && "border-l-2 border-l-white") }>
            <div><span className="inline-flex rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">{entry.kind}</span>{entry.accountName && <p className="mt-2 truncate text-[10px] text-[var(--muted)]">{entry.accountName}</p>}</div>
            <div><p className="text-sm font-medium">{entry.title}</p><p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">{entry.description}</p></div>
            <Button asChild variant="outline" size="sm"><Link href={entry.href}>{entry.action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          </div>
        ))}</div>}
      </section>

      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">Compliance items are calculated from saved account data and verified rule tables. PropDash withholds thresholds when a configuration or source value is unavailable.</p>
    </AppShell>
  )
}
