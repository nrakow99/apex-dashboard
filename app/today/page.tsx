"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, RefreshCw, ShieldAlert, Sparkles } from "lucide-react"
import { AddTradeModal } from "@/components/add-trade-modal"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { fetchAccounts, fetchInstrumentSpecs, fetchPayouts, fetchTrades, fetchUserSettings, createTrade } from "@/lib/supabase/database"
import { localTodayKey } from "@/lib/date-utils"
import { formatCurrency, formatPnL, pnlColorClass, cn } from "@/lib/utils"
import type { Account, InstrumentSpec, Payout, RiskProfile, Trade } from "@/lib/types"
import type { TradeMeta } from "@/lib/trade-meta"
import { buildTodayAccounts } from "@/lib/today-dashboard"
import { buildComplianceItems } from "@/lib/compliance-center"

export default function TodayPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [instrumentSpecs, setInstrumentSpecs] = useState<InstrumentSpec[]>([])
  const [userRiskProfile, setUserRiskProfile] = useState<RiskProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [accountResult, tradeResult, payoutResult, specsResult, settingsResult] = await Promise.all([fetchAccounts(), fetchTrades(), fetchPayouts(), fetchInstrumentSpecs(), fetchUserSettings()])
    const failure = accountResult.error ?? tradeResult.error ?? payoutResult.error
    if (failure) setError(failure.message)
    else {
      setAccounts(accountResult.data ?? [])
      setTrades(tradeResult.data ?? [])
      setPayouts(payoutResult.data ?? [])
      setInstrumentSpecs(specsResult.data ?? [])
      setUserRiskProfile(settingsResult.data ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(
    () => buildTodayAccounts(accounts, trades, payouts, localTodayKey()),
    [accounts, trades, payouts],
  )
  const complianceItems = useMemo(
    () => buildComplianceItems({ accounts, trades, payouts, instrumentSpecs, userRiskProfile }),
    [accounts, instrumentSpecs, payouts, trades, userRiskProfile],
  )
  const attentionItems = complianceItems.filter((entry) => entry.kind !== "ready")

  const todayPnl = rows.reduce((sum, row) => sum + row.todayPnl, 0)
  const readyCount = rows.filter((row) => row.payoutReady).length
  const breachedCount = rows.filter((row) => row.breached).length
  const configurationCount = rows.filter((row) => !row.rulesAvailable).length
  const activeTodayCount = rows.filter((row) => row.tradeCountToday > 0).length
  const needsAttention = attentionItems.length
  const briefing = breachedCount > 0
    ? `${breachedCount} account${breachedCount === 1 ? " is" : "s are"} off limits. Keep risk on the healthy accounts.`
    : complianceItems.some((entry) => entry.kind === "blocker")
      ? complianceItems.find((entry) => entry.kind === "blocker")!.title + "."
    : configurationCount > 0
      ? `${configurationCount} account${configurationCount === 1 ? " needs" : "s need"} rule configuration before its risk can be trusted.`
    : readyCount > 0
      ? `${readyCount} account${readyCount === 1 ? " is" : "s are"} ready for a payout request.`
      : activeTodayCount === 0
        ? "No trading activity has been logged today. Review risk before the next entry."
      : "No account is in immediate danger. Trade the plan, not the buffer."

  const posture = needsAttention > 0
    ? "Selective"
    : activeTodayCount === 0
      ? "Pre-trade"
      : "Clear"

  const addTrade = async (trade: { date: string; symbol: string; pnl: number; notes?: string }, meta: TradeMeta, accountIds: string[]) => {
    await Promise.all(accountIds.map((accountId) => createTrade({ ...trade, accountId }, meta)))
    await load()
  }

  return (
    <AppShell
      eyebrow="Daily command center"
      title="Today"
      description="Your risk, rules, and next payout move—before the session starts."
      actions={<>
        <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
        {accounts.length > 0 && <AddTradeModal accounts={accounts} selectedAccountId={accounts[0].id} onAddTrade={addTrade} />}
      </>}
    >
      {error ? (
        <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-6"><p className="text-sm">Today’s account data is unavailable.</p><p className="mt-1 text-xs text-[var(--muted)]">{error}</p></Card>
      ) : loading ? (
        <p className="text-sm text-[var(--muted)]">Loading today’s accounts…</p>
      ) : <>
        <section className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.65fr)]">
          <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]">
                {breachedCount > 0 ? <ShieldAlert className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.17em] text-[var(--muted)]">Daily briefing</p>
                <h2 className="mt-2 max-w-3xl text-xl font-medium leading-snug tracking-[-0.025em] sm:text-2xl">{briefing}</h2>
                <p className="mt-3 text-sm text-[var(--muted)]">Loss room is ranked from tightest to widest. Payout requirements use the current cycle.</p>
              </div>
            </div>
          </Card>
          <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-6 sm:p-7">
            <p className="text-[10px] font-medium uppercase tracking-[0.17em] text-[var(--muted)]">Session posture</p>
            <p className="mt-3 text-lg font-medium">{posture}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {needsAttention > 0
                ? `${needsAttention} compliance item${needsAttention === 1 ? " needs" : "s need"} attention today.`
                : activeTodayCount === 0
                  ? "Waiting for the first reviewed result."
                  : "No urgent risk flags detected."}
            </p>
          </Card>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--hairline)] lg:grid-cols-4">
          <Summary label="Tracked accounts" value={String(rows.length)} />
          <Summary label="Today’s net P&L" value={formatPnL(todayPnl)} signed />
          <Summary label="Payout ready" value={String(readyCount)} />
          <Summary label="Needs attention" value={String(needsAttention)} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.8fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Risk queue</p><h2 className="mt-1 text-xl font-medium">Closest to the floor</h2></div><span className="text-xs text-[var(--muted)]">Lowest room first</span></div>
            <div className="overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)]">
              {rows.length === 0 && <div className="p-6 text-sm text-[var(--muted)]">Add an account to build today’s risk queue.</div>}
              {rows.map((row) => <Link href={`/?account=${row.account.id}`} key={row.account.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-5 border-b border-[var(--hairline)] p-4 transition-colors last:border-0 hover:bg-[var(--raised)] sm:grid-cols-[minmax(0,1fr)_120px_170px] sm:items-center sm:px-5", (row.breached || !row.rulesAvailable) && "border-l-2 border-l-[var(--text)]")}>
                <div><p className="font-medium">{row.account.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{row.breached ? "Do not trade · breached" : !row.rulesAvailable ? "Rules unavailable · update account" : `${row.account.firm} · ${row.account.type}`}</p></div>
                <div className="text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Today</p><p className={cn("mt-1 font-mono text-sm", pnlColorClass(row.todayPnl))}>{formatPnL(row.todayPnl)}</p></div>
                <div className="col-span-2 sm:col-span-1"><div className="flex justify-between text-[10px] text-[var(--muted)]"><span>Loss room</span><span className="font-mono text-[var(--text)]">{row.drawdownRemaining == null ? "Unavailable" : formatCurrency(row.drawdownRemaining)}</span></div>{row.drawdownPercent != null && <div className="mt-2 h-1 rounded-[2px] bg-[var(--hairline)]"><div className="h-full rounded-[2px] bg-[var(--text)]" style={{ width: `${Math.min(100, row.drawdownPercent * 100)}%` }} /></div>}{row.dailyRemaining != null && <p className="mt-2 text-[10px] text-[var(--muted)]">Daily room {formatCurrency(row.dailyRemaining)}</p>}</div>
              </Link>)}
            </div>
          </section>
          <aside className="space-y-7">
            <section>
              <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Action center</p><h2 className="mt-1 text-xl font-medium">Next moves</h2></div><Link href="/compliance" className="text-xs text-[var(--muted)] hover:text-white">View all</Link></div>
              <div className="space-y-2">
                {complianceItems.length === 0 && <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4"><p className="text-sm">No open compliance actions</p><p className="mt-1 text-xs text-[var(--muted)]">Continue checking the firm portal before requests.</p></Card>}
                {complianceItems.slice(0, 3).map((entry) => <Link href={entry.href} key={entry.id} className="block"><Card className={cn("rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--faint)] hover:bg-[var(--raised)]", entry.kind === "blocker" && "border-l-2 border-l-white")}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{entry.title}</p><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{entry.accountName ? `${entry.accountName} · ` : ""}{entry.description}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted)]" /></div></Card></Link>)}
              </div>
            </section>
            <section>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Next payout</p><h2 className="mb-3 mt-1 text-xl font-medium">Readiness</h2>
              <div className="space-y-2">
              {rows.filter((row) => row.account.type === "PA").length === 0 && <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4"><p className="text-sm text-[var(--muted)]">No funded accounts to review.</p></Card>}
              {rows.filter((row) => row.account.type === "PA").map((row) => <Link href={`/?account=${row.account.id}`} key={row.account.id} className="block"><Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--faint)] hover:bg-[var(--raised)]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{row.account.name}</p><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{row.payoutReady ? "Ready to request" : row.payoutMissing[0] ?? "Payout tracking unavailable"}</p></div><ArrowUpRight className="h-4 w-4 text-[var(--muted)]" /></div></Card></Link>)}
              </div>
            </section>
          </aside>
        </div>
      </>}
    </AppShell>
  )
}

function Summary({ label, value, signed = false }: { label: string; value: string; signed?: boolean }) {
  return <div className="bg-[var(--surface)] p-4 sm:p-5"><p className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p><p className={cn("mt-2 font-mono text-2xl font-medium tracking-[-0.04em]", signed && value.startsWith("+") && "text-[var(--gain)]", signed && value.startsWith("-") && "text-[var(--loss)]")}>{value}</p></div>
}
