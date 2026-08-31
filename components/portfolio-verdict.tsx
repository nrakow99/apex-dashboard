import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn, formatCurrency, formatPnL, pnlColorClass } from "@/lib/utils"
import type { AccountVerdict, PortfolioVerdict, VerdictPrimary } from "@/lib/verdict"
import { verdictLabel } from "@/lib/verdict"

const groupOrder: VerdictPrimary[] = [
  "eligible",
  "request_payout",
  "protect",
  "blocked",
  "needs_data",
]

const groupDescription: Record<VerdictPrimary, string> = {
  eligible: "Available for rotation",
  request_payout: "Verify in the firm portal",
  protect: "Keep out of normal rotation",
  blocked: "Known hard stop",
  needs_data: "PropDash refuses to guess",
}

function Room({ verdict }: { verdict: AccountVerdict }) {
  if (verdict.dollarsOfRoom == null) {
    return <p className="text-xs text-[var(--muted)]">Loss-room unavailable</p>
  }
  return <div className="text-right">
    {verdict.tradesOfRoom == null ? (
      <p className="font-mono text-sm">{formatCurrency(verdict.dollarsOfRoom)}</p>
    ) : (
      <p className="font-mono text-sm">{verdict.tradesOfRoom} estimated loss{verdict.tradesOfRoom === 1 ? "" : "es"}</p>
    )}
    <p className="mt-1 text-[10px] text-[var(--muted)]">
      {verdict.tradesOfRoom == null ? "Set risk to estimate full-stop losses" : `${formatCurrency(verdict.dollarsOfRoom)} verified account room`}
    </p>
  </div>
}

function VerdictRow({ verdict }: { verdict: AccountVerdict }) {
  return <Link href={`/accounts?account=${verdict.account.id}`} className={cn(
    "grid gap-3 border-t border-[var(--hairline)] px-4 py-4 transition-colors hover:bg-[var(--raised)] sm:grid-cols-[minmax(0,1fr)_210px_105px] sm:items-center sm:px-5",
    (verdict.primary === "blocked" || verdict.primary === "needs_data") && "border-l-2 border-l-white",
  )}>
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-medium">{verdict.account.name}</p>
        {verdict.rank != null && <span className="border border-[var(--hairline)] bg-[var(--raised)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted)]">#{verdict.rank}</span>}
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{verdict.account.firm} · {verdict.account.type}</p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">{verdict.reason}</p>
      {verdict.constraints[0] && <p className="mt-2 border-l border-[var(--faint)] pl-2 text-[10px] leading-relaxed text-[var(--muted)]"><span className="text-[var(--text)]">{verdict.constraints[0].title}:</span> {verdict.constraints[0].detail}</p>}
    </div>
    <Room verdict={verdict} />
    <div className="flex items-center justify-between sm:justify-end sm:gap-3">
      <div className="sm:text-right"><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--faint)]">Today</p><p className={cn("mt-1 font-mono text-xs", pnlColorClass(verdict.todayPnl))}>{formatPnL(verdict.todayPnl)}</p></div>
      <ArrowUpRight className="h-4 w-4 text-[var(--muted)]" />
    </div>
  </Link>
}

function Groups({ verdict, accountIds }: { verdict: PortfolioVerdict; accountIds: Set<string> }) {
  return <>{groupOrder.map((primary) => {
    const rows = verdict.accounts.filter((item) => item.primary === primary && accountIds.has(item.account.id))
    if (rows.length === 0) return null
    return <section key={primary}>
      <div className="flex items-center justify-between border-t border-[var(--hairline)] bg-[var(--raised)] px-4 py-2.5 sm:px-5">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em]">{verdictLabel[primary]}</p>
        <p className="text-[9px] text-[var(--muted)]">{groupDescription[primary]} · {rows.length}</p>
      </div>
      {rows.map((item) => <VerdictRow key={item.account.id} verdict={item} />)}
    </section>
  })}</>
}

export function PortfolioVerdictPanel({ verdict }: { verdict: PortfolioVerdict }) {
  const ordered = groupOrder.flatMap((primary) => verdict.accounts
    .filter((item) => item.primary === primary)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)))
  const visible = new Set(ordered.slice(0, 6).map((item) => item.account.id))
  const remaining = new Set(ordered.slice(6).map((item) => item.account.id))

  return <section className="mb-6 overflow-hidden border border-[var(--hairline)] bg-[var(--surface)]">
    <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Today’s verdict</p>
        <h2 className="mt-3 max-w-4xl text-2xl font-medium leading-tight tracking-[-0.035em] sm:text-3xl">{verdict.headline}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{verdict.summary}</p>
      </div>
      <div className="grid grid-cols-5 gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
        {groupOrder.map((primary) => <div key={primary} className="min-w-[82px] bg-[var(--raised)] px-3 py-2.5 text-center"><p className="font-mono text-base">{verdict.counts[primary]}</p><p className="mt-1 text-[8px] uppercase tracking-[0.11em] text-[var(--muted)]">{verdictLabel[primary]}</p></div>)}
      </div>
    </div>

    <Groups verdict={verdict} accountIds={visible} />
    {remaining.size > 0 && <details className="border-t border-[var(--hairline)]">
      <summary className="cursor-pointer list-none px-5 py-3 text-center text-xs text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]">Show {remaining.size} more account{remaining.size === 1 ? "" : "s"}</summary>
      <Groups verdict={verdict} accountIds={remaining} />
    </details>}
    <p className="border-t border-[var(--hairline)] px-5 py-3 text-[10px] leading-relaxed text-[var(--faint)]">Firm rules and saved workspace data determine account state. Full-stop loss counts are personal estimates. Confirm live values in the firm portal.</p>
  </section>
}
