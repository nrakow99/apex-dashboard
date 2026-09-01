"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowUpRight, RefreshCw } from "lucide-react"
import { AddTradeModal } from "@/components/add-trade-modal"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DailySessionPlanCard } from "@/components/daily-session-plan"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { PortfolioVerdictPanel } from "@/components/portfolio-verdict"
import { VerdictDeltaPanel } from "@/components/verdict-delta"
import { createTrade, fetchAccounts, fetchInstrumentSpecs, fetchPayouts, fetchTrades, fetchUserSettings } from "@/lib/supabase/database"
import { localTodayKey } from "@/lib/date-utils"
import { cn, formatCurrency, formatPnL, pnlColorClass } from "@/lib/utils"
import type { Account, InstrumentSpec, Payout, RiskProfile, Trade } from "@/lib/types"
import type { TradeMeta } from "@/lib/trade-meta"
import { buildTodayAccounts } from "@/lib/today-dashboard"
import { buildComplianceItems } from "@/lib/compliance-center"
import { scopeDecisionWorkspace } from "@/lib/workspace-scope"
import { buildPortfolioVerdict, comparePortfolioVerdicts, type VerdictDelta, verdictLabel } from "@/lib/verdict"
import { saveAccountTrades } from "@/lib/today-trade-save"

export default function TodayPage() {
  return <Suspense fallback={null}><TodayContent /></Suspense>
}

function TodayContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [instrumentSpecs, setInstrumentSpecs] = useState<InstrumentSpec[]>([])
  const [userRiskProfile, setUserRiskProfile] = useState<RiskProfile | null>(null)
  const [deltas, setDeltas] = useState<VerdictDelta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tradeSaveNotice, setTradeSaveNotice] = useState<string | null>(null)

  const load = useCallback(async (options?: { preserveOnFailure?: boolean }) => {
    setLoading(true)
    setError(null)
    const [accountResult, tradeResult, payoutResult, specsResult, settingsResult] = await Promise.all([
      fetchAccounts(), fetchTrades(), fetchPayouts(), fetchInstrumentSpecs(), fetchUserSettings(),
    ])
    const failure = accountResult.error ?? tradeResult.error ?? payoutResult.error
    if (failure) {
      if (!options?.preserveOnFailure) setError(failure.message)
      setLoading(false)
      return false
    } else {
      setAccounts(accountResult.data ?? [])
      setTrades(tradeResult.data ?? [])
      setPayouts(payoutResult.data ?? [])
      setInstrumentSpecs(specsResult.data ?? [])
      setUserRiskProfile(settingsResult.data ?? null)
    }
    setLoading(false)
    return true
  }, [])

  useEffect(() => { void load() }, [load])

  const workspace = useMemo(() => scopeDecisionWorkspace(accounts, trades, payouts), [accounts, trades, payouts])
  const today = localTodayKey()
  const rows = useMemo(() => buildTodayAccounts(workspace.accounts, workspace.trades, workspace.payouts, today), [today, workspace])
  const complianceItems = useMemo(() => buildComplianceItems({ accounts: workspace.accounts, trades: workspace.trades, payouts: workspace.payouts, instrumentSpecs, userRiskProfile }), [instrumentSpecs, userRiskProfile, workspace])
  const verdict = useMemo(() => buildPortfolioVerdict({ rows, complianceItems, instrumentSpecs, userRiskProfile }), [complianceItems, instrumentSpecs, rows, userRiskProfile])
  const verdictByAccount = useMemo(() => new Map(verdict.accounts.map((item) => [item.account.id, item])), [verdict.accounts])

  const todayPnl = rows.reduce((sum, row) => sum + row.todayPnl, 0)
  const quickLogRequested = searchParams.get("log") === "1"
  const quickLogAccountId = verdict.accounts.filter((item) => item.primary === "eligible").sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0]?.account.id ?? workspace.accounts[0]?.id ?? ""

  const addTrade = async (trade: { date: string; symbol: string; pnl: number; notes?: string }, meta: TradeMeta, accountIds: string[]) => {
    setTradeSaveNotice(null)
    const result = await saveAccountTrades<Trade>({
      accountIds,
      create: (accountId) => createTrade({ ...trade, accountId }, meta),
      applyInserted: (inserted) => {
      const nextTrades = [...workspace.trades, ...inserted]
      const nextRows = buildTodayAccounts(workspace.accounts, nextTrades, workspace.payouts, today)
      const nextCompliance = buildComplianceItems({ accounts: workspace.accounts, trades: nextTrades, payouts: workspace.payouts, instrumentSpecs, userRiskProfile })
      const nextVerdict = buildPortfolioVerdict({ rows: nextRows, complianceItems: nextCompliance, instrumentSpecs, userRiskProfile })
      setDeltas(comparePortfolioVerdicts(verdict, nextVerdict, inserted.map((item) => item.accountId)))
      setTrades((current) => [...current, ...inserted])
      },
      reload: () => load({ preserveOnFailure: true }),
    })
    const failedNames = result.failedAccountIds.map((id) => workspace.accounts.find((account) => account.id === id)?.name ?? id)
    const messages = []
    if (failedNames.length) messages.push(`Not saved: ${failedNames.join(", ")}. Only these accounts remain selected for retry.`)
    if (!result.reloadSucceeded) messages.push("Saved trades remain applied locally, but fresh account data could not be loaded.")
    setTradeSaveNotice(messages.join(" ") || null)
    return { failedAccountIds: result.failedAccountIds }
  }

  return <AppShell
    eyebrow="Daily operating plan"
    title="Today"
    description="One portfolio verdict before the session—and a clear explanation after every result."
    actions={<>
      <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
      {workspace.accounts.length > 0 && <AddTradeModal accounts={workspace.accounts} selectedAccountId={quickLogAccountId} userDefaultRiskProfile={userRiskProfile} onAddTrade={addTrade} requestedOpen={quickLogRequested} onOpenChange={(open) => { if (!open && quickLogRequested) router.replace("/today", { scroll: false }) }} />}
    </>}
  >
    <DemoDataBanner accounts={accounts} />
    {tradeSaveNotice && <div role="status" className="mb-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">{tradeSaveNotice}</div>}
    {error ? <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-6"><p className="text-sm">Today’s account data is unavailable.</p><p className="mt-1 text-xs text-[var(--muted)]">{error}</p></Card> : loading ? <p className="text-sm text-[var(--muted)]">Building today’s verdict…</p> : <>
      <PortfolioVerdictPanel verdict={verdict} />
      <VerdictDeltaPanel deltas={deltas} onDismiss={() => setDeltas([])} />

      <section className="mb-6 grid grid-cols-3 gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
        <Summary label="Tracked" value={String(rows.length)} />
        <Summary label="Today’s net P&L" value={formatPnL(todayPnl)} signed />
        <Summary label="Payout ready" value={String(verdict.counts.request_payout)} />
      </section>

      <DailySessionPlanCard date={today} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.8fr)]">
        <section>
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Account detail</p><h2 className="mt-1 text-xl font-medium">Loss-room queue</h2></div><span className="text-xs text-[var(--muted)]">Personal estimate first · firm room second</span></div>
          <div className="overflow-hidden border border-[var(--hairline)] bg-[var(--surface)]">
            {rows.length === 0 && <div className="p-6 text-sm text-[var(--muted)]">Add an account to build today’s account queue.</div>}
            {rows.map((row) => {
              const item = verdictByAccount.get(row.account.id)
              return <Link href={`/accounts?account=${row.account.id}`} key={row.account.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-5 border-b border-[var(--hairline)] p-4 transition-colors last:border-0 hover:bg-[var(--raised)] sm:grid-cols-[minmax(0,1fr)_125px_210px] sm:items-center sm:px-5", (item?.primary === "blocked" || item?.primary === "needs_data") && "border-l-2 border-l-white")}>
                <div><div className="flex items-center gap-2"><p className="font-medium">{row.account.name}</p><span className="border border-[var(--hairline)] bg-[var(--raised)] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">{item ? verdictLabel[item.primary] : "Unavailable"}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{row.account.firm} · {row.account.type}</p></div>
                <div className="text-right"><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Today</p><p className={cn("mt-1 font-mono text-sm", pnlColorClass(row.todayPnl))}>{formatPnL(row.todayPnl)}</p></div>
                <div className="col-span-2 text-right sm:col-span-1"><p className="font-mono text-sm">{item?.tradesOfRoom == null ? "Risk estimate unavailable" : `${item.tradesOfRoom} estimated full-stop loss${item.tradesOfRoom === 1 ? "" : "es"}`}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{row.drawdownRemaining == null ? "Verified account room unavailable" : `${formatCurrency(row.drawdownRemaining)} verified account room`}</p>{row.dailyRemaining != null && <p className="mt-1 text-[10px] text-[var(--muted)]">Today’s firm loss-room {formatCurrency(row.dailyRemaining)}</p>}</div>
              </Link>
            })}
          </div>
        </section>

        <aside>
          <div className="mb-3"><p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Prioritized queue</p><h2 className="mt-1 text-xl font-medium">Next moves</h2></div>
          <div className="space-y-2">
            {complianceItems.length === 0 && <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4"><p className="text-sm">No open actions</p><p className="mt-1 text-xs text-[var(--muted)]">Continue checking the firm portal before payout requests.</p></Card>}
            {complianceItems.slice(0, 5).map((entry) => <Link href={entry.href} key={entry.id} className="block"><Card className={cn("rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--faint)] hover:bg-[var(--raised)]", entry.kind === "blocker" && "border-l-2 border-l-white")}><div className="flex items-start justify-between gap-3"><div><p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[var(--faint)]">{entry.kind === "blocker" ? "Resolve first" : entry.kind === "watch" ? "Review" : entry.kind === "ready" ? "Opportunity" : "Next step"}</p><p className="text-sm font-medium">{entry.title}</p><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{entry.accountName ? `${entry.accountName} · ` : ""}{entry.description}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted)]" /></div></Card></Link>)}
            {complianceItems.length > 5 && <details className="border border-[var(--hairline)] bg-[var(--surface)]"><summary className="cursor-pointer list-none px-4 py-3 text-center text-xs text-[var(--muted)] hover:bg-[var(--raised)]">Show {complianceItems.length - 5} more</summary><div className="divide-y divide-[var(--hairline)]">{complianceItems.slice(5).map((entry) => <Link key={entry.id} href={entry.href} className="block px-4 py-3 text-xs hover:bg-[var(--raised)]"><span>{entry.title}</span>{entry.accountName && <span className="ml-2 text-[var(--muted)]">{entry.accountName}</span>}</Link>)}</div></details>}
          </div>
        </aside>
      </div>
    </>}
  </AppShell>
}

function Summary({ label, value, signed = false }: { label: string; value: string; signed?: boolean }) {
  return <div className="bg-[var(--surface)] p-4 sm:p-5"><p className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p><p className={cn("mt-2 font-mono text-xl font-medium tracking-[-0.04em] sm:text-2xl", signed && value.startsWith("+") && "text-[var(--gain)]", signed && value.startsWith("-") && "text-[var(--loss)]")}>{value}</p></div>
}
