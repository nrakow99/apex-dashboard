"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, RefreshCw, ShieldAlert, Sparkles } from "lucide-react"
import { AddTradeModal } from "@/components/add-trade-modal"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { fetchAccounts, fetchPayouts, fetchTrades, createTrade } from "@/lib/supabase/database"
import { calculateAccountStats, getPayoutEligibility, tradesEffectiveForAccount } from "@/lib/storage"
import { getAccountRules } from "@/lib/rules"
import { getApexPaScalingTier } from "@/lib/apex-pa-scaling"
import { localTodayKey } from "@/lib/date-utils"
import { formatCurrency, formatPnL, pnlColorClass, cn } from "@/lib/utils"
import type { Account, Payout, Trade } from "@/lib/types"
import type { TradeMeta } from "@/lib/trade-meta"

type TodayAccount = {
  account: Account
  balance: number
  todayPnl: number
  drawdownRemaining: number
  drawdownPercent: number
  dailyRemaining: number | null
  payoutReady: boolean
  payoutMissing: string[]
  breached: boolean
}

export default function TodayPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [accountResult, tradeResult, payoutResult] = await Promise.all([fetchAccounts(), fetchTrades(), fetchPayouts()])
    const failure = accountResult.error ?? tradeResult.error ?? payoutResult.error
    if (failure) setError(failure.message)
    else {
      setAccounts(accountResult.data ?? [])
      setTrades(tradeResult.data ?? [])
      setPayouts(payoutResult.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo<TodayAccount[]>(() => {
    const today = localTodayKey()
    return accounts.map((account) => {
      const rules = getAccountRules(account)
      const stats = calculateAccountStats(account, trades, payouts)
      const apexScaling = account.firm === "Apex" && account.type === "PA"
        ? getApexPaScalingTier(account, stats)
        : null
      const dailyLimit = apexScaling?.dailyLossLimit ?? rules.dailyLossLimit
      const todayPnl = tradesEffectiveForAccount(account, trades)
        .filter((trade) => trade.date === today)
        .reduce((sum, trade) => sum + trade.pnl, 0)
      const eligibility = account.type === "PA" && rules.hasPayouts
        ? getPayoutEligibility(account.id, trades, account, payouts)
        : null
      return {
        account,
        balance: stats.currentBalance,
        todayPnl,
        drawdownRemaining: Math.max(0, stats.drawdownRemaining),
        drawdownPercent: rules.maxDrawdown > 0 ? Math.max(0, stats.drawdownRemaining / rules.maxDrawdown) : 1,
        dailyRemaining: rules.hasDLL ? Math.max(0, dailyLimit + Math.min(0, todayPnl)) : null,
        payoutReady: eligibility?.isEligible ?? false,
        payoutMissing: eligibility?.missingConditions ?? [],
        breached: account.status === "Breached" || !stats.isSafe,
      }
    }).sort((a, b) => a.drawdownPercent - b.drawdownPercent)
  }, [accounts, trades, payouts])

  const todayPnl = rows.reduce((sum, row) => sum + row.todayPnl, 0)
  const readyCount = rows.filter((row) => row.payoutReady).length
  const breachedCount = rows.filter((row) => row.breached).length
  const needsAttention = rows.filter((row) => row.breached || row.drawdownPercent <= .25).length
  const briefing = breachedCount > 0
    ? `${breachedCount} account${breachedCount === 1 ? " is" : "s are"} off limits. Keep risk on the healthy accounts.`
    : readyCount > 0
      ? `${readyCount} account${readyCount === 1 ? " is" : "s are"} ready for a payout request.`
      : "No account is in immediate danger. Trade the plan, not the buffer."

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
        <Button variant="outline" size="icon" onClick={load} disabled={loading} className="rounded-[9px]" aria-label="Refresh"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
        {accounts.length > 0 && <AddTradeModal accounts={accounts} selectedAccountId={accounts[0].id} onAddTrade={addTrade} />}
      </>}
    >
      {error ? (
        <Card className="rounded-[14px] border-[#262629] bg-[#111113] p-6"><p className="text-sm">Today’s account data is unavailable.</p><p className="mt-1 text-xs text-[var(--muted)]">{error}</p></Card>
      ) : loading ? (
        <p className="text-sm text-[var(--muted)]">Loading today’s accounts…</p>
      ) : <>
        <section className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.65fr)]">
          <Card className="rounded-[14px] border-[#262629] bg-[#111113] p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[#303034] bg-[#1A1A1D]">
                {breachedCount > 0 ? <ShieldAlert className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.17em] text-[var(--muted)]">Daily briefing</p>
                <h2 className="mt-2 max-w-3xl text-xl font-medium leading-snug tracking-[-0.025em] sm:text-2xl">{briefing}</h2>
                <p className="mt-3 text-sm text-[var(--muted)]">Loss room is ranked from tightest to widest. Payout requirements use the current cycle.</p>
              </div>
            </div>
          </Card>
          <Card className="rounded-[14px] border-[#262629] bg-[#111113] p-6 sm:p-7">
            <p className="text-[10px] font-medium uppercase tracking-[0.17em] text-[var(--muted)]">Session posture</p>
            <p className="mt-3 text-lg font-medium">{needsAttention > 0 ? "Selective" : "Clear"}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{needsAttention > 0 ? `${needsAttention} account${needsAttention === 1 ? " needs" : "s need"} protection today.` : "No urgent risk flags detected."}</p>
          </Card>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-[var(--hairline)] bg-[var(--hairline)] lg:grid-cols-4">
          <Summary label="Tracked accounts" value={String(rows.length)} />
          <Summary label="Today’s net P&L" value={formatPnL(todayPnl)} signed />
          <Summary label="Payout ready" value={String(readyCount)} />
          <Summary label="Needs attention" value={String(needsAttention)} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.8fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Risk queue</p><h2 className="mt-1 text-xl font-medium">Closest to the floor</h2></div><span className="text-xs text-[var(--muted)]">Lowest room first</span></div>
            <div className="overflow-hidden rounded-[12px] border border-[#262629] bg-[#101012]">
              {rows.length === 0 && <div className="p-6 text-sm text-[var(--muted)]">Add an account to build today’s risk queue.</div>}
              {rows.map((row) => <Link href={`/?account=${row.account.id}`} key={row.account.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-5 border-b border-[#242427] p-4 transition-colors last:border-0 hover:bg-[#151517] sm:grid-cols-[minmax(0,1fr)_120px_170px] sm:items-center sm:px-5", row.breached && "border-l-2 border-l-white")}>
                <div><p className="font-medium">{row.account.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{row.breached ? "Do not trade · breached" : `${row.account.firm} · ${row.account.type}`}</p></div>
                <div className="text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Today</p><p className={cn("mt-1 font-mono text-sm", pnlColorClass(row.todayPnl))}>{formatPnL(row.todayPnl)}</p></div>
                <div className="col-span-2 sm:col-span-1"><div className="flex justify-between text-[10px] text-[var(--muted)]"><span>Loss room</span><span className="font-mono text-white">{formatCurrency(row.drawdownRemaining)}</span></div><div className="mt-2 h-1 rounded-full bg-[#242427]"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, row.drawdownPercent * 100)}%` }} /></div>{row.dailyRemaining != null && <p className="mt-2 text-[10px] text-[var(--muted)]">Daily room {formatCurrency(row.dailyRemaining)}</p>}</div>
              </Link>)}
            </div>
          </section>
          <aside>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Next payout</p><h2 className="mb-3 mt-1 text-xl font-medium">Readiness</h2>
            <div className="space-y-2">
              {rows.filter((row) => row.account.type === "PA").length === 0 && <Card className="rounded-[12px] border-[#262629] bg-[#101012] p-4"><p className="text-sm text-[var(--muted)]">No funded accounts to review.</p></Card>}
              {rows.filter((row) => row.account.type === "PA").map((row) => <Link href={`/?account=${row.account.id}`} key={row.account.id} className="block"><Card className="rounded-[12px] border-[#262629] bg-[#101012] p-4 transition-colors hover:border-[#3A3A3E] hover:bg-[#151517]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{row.account.name}</p><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{row.payoutReady ? "Ready to request" : row.payoutMissing[0] ?? "No payout requirement available"}</p></div><ArrowUpRight className="h-4 w-4 text-[var(--muted)]" /></div></Card></Link>)}
            </div>
          </aside>
        </div>
      </>}
    </AppShell>
  )
}

function Summary({ label, value, signed = false }: { label: string; value: string; signed?: boolean }) {
  return <div className="bg-[#101012] p-4 sm:p-5"><p className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p><p className={cn("mt-2 font-mono text-2xl font-medium tracking-[-0.04em]", signed && value.startsWith("+") && "text-[var(--gain)]", signed && value.startsWith("-") && "text-[var(--loss)]")}>{value}</p></div>
}
