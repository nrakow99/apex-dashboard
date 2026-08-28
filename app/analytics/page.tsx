"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { buildTradeAnalytics, filterAnalyticsPeriod, type AnalyticsBreakdownRow, type DailyAnalyticsPoint } from "@/lib/trade-analytics"
import { accountNamesForConcentration, buildBehavioralEdge, buildSameDayConcentration, type EvidencePattern } from "@/lib/edge-intelligence"
import { SESSION_LABELS, type SessionId } from "@/lib/sessions"
import { cn, formatPnL, pnlColorClass } from "@/lib/utils"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { scopeDecisionWorkspace } from "@/lib/workspace-scope"
import { DISPLAY_THRESHOLDS } from "@/lib/display-thresholds"

type Period = "30" | "90" | "all"

function Metric({ label, value, supporting, valueClass }: { label: string; value: string; supporting: string; valueClass?: string }) {
  return <div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p><p className={cn("mt-2 font-mono text-xl font-medium", valueClass)}>{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{supporting}</p></div>
}

function shortDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function EquityCurve({ data }: { data: DailyAnalyticsPoint[] }) {
  if (!data.length) return <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted)]">No performance data in this range.</div>
  const width = 1000
  const height = 250
  const padX = 28
  const padY = 26
  const values = [0, ...data.map((point) => point.cumulativePnl)]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const y = (value: number) => padY + ((max - value) / range) * (height - padY * 2)
  const x = (index: number) => data.length === 1 ? width / 2 : padX + (index / (data.length - 1)) * (width - padX * 2)
  const points = data.map((point, index) => `${x(index)},${y(point.cumulativePnl)}`).join(" ")
  const baseline = y(0)
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] w-full" role="img" aria-label="Cumulative net P&L curve">
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={padX} x2={width - padX} y1={padY + ratio * (height - padY * 2)} y2={padY + ratio * (height - padY * 2)} stroke="var(--hairline)" strokeWidth="1" />)}
        <line x1={padX} x2={width - padX} y1={baseline} y2={baseline} stroke="var(--faint)" strokeWidth="1" strokeDasharray="5 5" />
        <polyline points={points} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((point, index) => <circle key={point.date} cx={x(index)} cy={y(point.cumulativePnl)} r={data.length < 20 ? 2.5 : 0} fill="var(--text)" />)}
      </svg>
      <div className="flex justify-between border-t border-[var(--hairline)] pt-2 font-mono text-[10px] text-[var(--muted)]"><span>{shortDate(data[0].date)}</span><span>{shortDate(data.at(-1)!.date)}</span></div>
    </div>
  )
}

function BreakdownTable({ title, description, rows, labelMap }: { title: string; description: string; rows: AnalyticsBreakdownRow[]; labelMap?: (label: string) => string }) {
  return (
    <section className="border border-[var(--hairline)] bg-[var(--surface)]">
      <div className="border-b border-[var(--hairline)] px-5 py-4"><h2 className="text-base font-medium">{title}</h2><p className="mt-1 text-[11px] text-[var(--muted)]">{description}</p></div>
      {rows.length ? <div className="divide-y divide-[var(--hairline)]">{rows.slice(0, 7).map((row, index) => <div key={row.label} className="grid grid-cols-[24px_1fr_70px_90px] items-center gap-3 px-4 py-3"><span className="font-mono text-[10px] text-[var(--faint)]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><p className="truncate text-xs">{labelMap ? labelMap(row.label) : row.label}</p><p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{row.records} record{row.records === 1 ? "" : "s"}</p></div><div className="text-right"><p className="font-mono text-xs">{row.winRate == null ? "—" : `${row.winRate.toFixed(0)}%`}</p><p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">Win rate</p></div><p className={cn("text-right font-mono text-xs", pnlColorClass(row.pnl))}>{formatPnL(row.pnl)}</p></div>)}</div> : <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">Unavailable for this range.</p>}
    </section>
  )
}

function Coverage({ label, value }: { label: string; value: number | null }) {
  return <div><div className="flex items-center justify-between text-[11px]"><span className="text-[var(--muted)]">{label}</span><span className="font-mono">{value == null ? "Unavailable" : `${value.toFixed(0)}%`}</span></div><div className="mt-2 h-1 bg-[var(--hairline)]"><div className="h-full bg-white" style={{ width: `${value ?? 0}%` }} /></div></div>
}

function patternLabel(pattern: EvidencePattern, sessionLabel: (label: string) => string): string {
  const label = pattern.dimension === "session" ? sessionLabel(pattern.label) : pattern.label
  return `${label} · ${pattern.dimension}`
}

export default function AnalyticsPage() {
  const { accounts, trades, loading, error } = useDashboardData()
  const [accountId, setAccountId] = useState("all")
  const [period, setPeriod] = useState<Period>("90")
  const workspace = useMemo(() => scopeDecisionWorkspace(accounts, trades, []), [accounts, trades])

  const selectedTrades = useMemo(() => {
    const accountTrades = accountId === "all" ? workspace.trades : workspace.trades.filter((trade) => trade.accountId === accountId)
    return filterAnalyticsPeriod(accountTrades, period === "all" ? null : Number(period))
  }, [workspace.trades, accountId, period])
  const analytics = useMemo(() => buildTradeAnalytics(selectedTrades), [selectedTrades])
  const edge = useMemo(() => buildBehavioralEdge(selectedTrades), [selectedTrades])
  const concentration = useMemo(() => buildSameDayConcentration(selectedTrades), [selectedTrades])
  const sessionLabel = (label: string) => SESSION_LABELS[label as SessionId] ?? label
  const observations = [
    analytics.bySymbol[0]?.records >= 3 ? `${analytics.bySymbol[0].label} has the highest net contribution in this view at ${formatPnL(analytics.bySymbol[0].pnl)} across ${analytics.bySymbol[0].records} records.` : null,
    analytics.bySession[0]?.records >= 3 ? `${sessionLabel(analytics.bySession[0].label)} has the highest session contribution at ${formatPnL(analytics.bySession[0].pnl)} across ${analytics.bySession[0].records} tagged records.` : null,
    analytics.reviewCoverage != null && analytics.reviewCoverage < DISPLAY_THRESHOLDS.reviewCoverageWarningPercent ? `Review context exists on ${analytics.reviewCoverage.toFixed(0)}% of records; session and process comparisons only use the tagged subset.` : null,
    analytics.maxLossStreak >= 3 ? `The longest observed losing-record streak in this view is ${analytics.maxLossStreak}.` : null,
  ].filter(Boolean) as string[]

  return (
    <AppShell eyebrow="Decision intelligence" title="Edge" description="See which behaviors deserve more capital—and which patterns are quietly taxing every account." actions={<div className="flex items-center gap-1">{(["30", "90", "all"] as Period[]).map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={cn("h-9 rounded-[2px] border px-3 text-xs transition-colors", period === value ? "border-white bg-white text-black" : "border-[var(--hairline)] bg-[var(--raised)] text-[var(--muted)] hover:text-white")}>{value === "all" ? "All time" : `${value} days`}</button>)}</div>}>
      <DemoDataBanner accounts={accounts} />
      {error && <div role="alert" className="mb-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">Some analytics data could not load: {error}</div>}
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs text-[var(--muted)]">Historical evidence, not a market signal. Mirrored account records remain separate so cross-firm concentration stays visible.</p><select value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Analyze account" className="h-9 min-w-[190px] rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 text-xs outline-none"><option value="all">All accounts</option>{workspace.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>

      {loading ? <div className="border border-[var(--hairline)] bg-[var(--surface)] px-5 py-16 text-center text-sm text-[var(--muted)]">Building your edge brief…</div> : analytics.records === 0 ? <div className="border border-[var(--hairline)] bg-[var(--surface)] px-6 py-16 text-center"><p className="text-base font-medium">No evidence in this view</p><p className="mt-2 text-sm text-[var(--muted)]">Import history or expand the time range. PropDash will not invent an edge without supporting records.</p><Button asChild className="mt-5"><Link href="/trades">Bring in history</Link></Button></div> : <>
        <section className="mb-6 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] xl:grid-cols-[1.25fr_1fr_1fr]">
          <div className="bg-[var(--surface)] p-5 sm:p-6">
            <p className="text-[9px] uppercase tracking-[0.17em] text-[var(--faint)]">Evidence-backed strength</p>
            {edge.provenPattern ? <><h2 className="mt-3 text-xl font-medium tracking-[-0.025em]">Repeat {patternLabel(edge.provenPattern, sessionLabel)}</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Supported by {edge.provenPattern.records} records with <span className={cn("font-mono", pnlColorClass(edge.provenPattern.averagePnl))}>{formatPnL(edge.provenPattern.averagePnl)}</span> average net P&amp;L.</p></> : <><h2 className="mt-3 text-xl font-medium">More reviewed trades needed</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">No market, session, or setup has the minimum three records needed for a responsible comparison.</p></>}
          </div>
          <div className="bg-[var(--surface)] p-5 sm:p-6">
            <p className="text-[9px] uppercase tracking-[0.17em] text-[var(--faint)]">Process tax</p>
            {edge.processLeak ? <><h2 className="mt-3 text-lg font-medium">Remove {edge.processLeak.label}</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{edge.processLeak.records} tagged records average <span className={cn("font-mono", pnlColorClass(edge.processLeak.averagePnl))}>{formatPnL(edge.processLeak.averagePnl)}</span>.</p></> : <><h2 className="mt-3 text-lg font-medium">No proven leak yet</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Tag process breaks during review to measure their real cost.</p></>}
          </div>
          <div className="bg-[var(--surface)] p-5 sm:p-6">
            <p className="text-[9px] uppercase tracking-[0.17em] text-[var(--faint)]">Cross-account concentration</p>
            {concentration[0] ? <><h2 className="mt-3 text-lg font-medium">{concentration[0].accountCount} accounts · {concentration[0].symbol}</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Same-day exposure on {shortDate(concentration[0].date)} across {accountNamesForConcentration(concentration[0], selectedTrades, workspace.accounts).join(", ")}. This does not prove simultaneous positions.</p></> : <><h2 className="mt-3 text-lg font-medium">No repeated concentration</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">No same-day market appears across multiple selected accounts.</p></>}
          </div>
        </section>
        <section className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Net P&L" value={formatPnL(analytics.totalPnl)} supporting={`${analytics.records} records`} valueClass={pnlColorClass(analytics.totalPnl)} />
          <Metric label="Win rate" value={analytics.winRate == null ? "Unavailable" : `${analytics.winRate.toFixed(1)}%`} supporting={`${analytics.wins}W · ${analytics.losses}L · ${analytics.flats}F`} />
          <Metric label="Average win" value={analytics.averageWin == null ? "Unavailable" : formatPnL(analytics.averageWin)} supporting={`${analytics.wins} winning records`} valueClass={analytics.averageWin == null ? undefined : pnlColorClass(analytics.averageWin)} />
          <Metric label="Average loss" value={analytics.averageLoss == null ? "Unavailable" : formatPnL(analytics.averageLoss)} supporting={`${analytics.losses} losing records`} valueClass={analytics.averageLoss == null ? undefined : pnlColorClass(analytics.averageLoss)} />
          <Metric label="Expectancy" value={analytics.expectancy == null ? "Unavailable" : formatPnL(analytics.expectancy)} supporting="Per account record" valueClass={analytics.expectancy == null ? undefined : pnlColorClass(analytics.expectancy)} />
          <Metric label="Profit factor" value={analytics.profitFactor == null ? "Unavailable" : analytics.profitFactor.toFixed(2)} supporting={analytics.profitFactor == null ? "Requires a recorded loss" : `${formatPnL(analytics.grossProfit)} / ${formatPnL(-analytics.grossLoss)}`} />
        </section>

        <section className="mt-6 border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-end justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Cumulative performance</p><h2 className="mt-1 text-base font-medium">Net P&amp;L curve</h2></div><p className="font-mono text-xs text-[var(--muted)]">{analytics.dailySeries.length} trading days</p></div><div className="mt-4"><EquityCurve data={analytics.dailySeries} /></div><div className="mt-4 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2"><div className="bg-[var(--raised)] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Highest day · {analytics.bestDay ? shortDate(analytics.bestDay.date) : "Unavailable"}</p><p className={cn("mt-1 font-mono text-sm", analytics.bestDay ? pnlColorClass(analytics.bestDay.pnl) : "")}>{analytics.bestDay ? formatPnL(analytics.bestDay.pnl) : "Unavailable"}</p></div><div className="bg-[var(--raised)] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Lowest day · {analytics.lowestDay ? shortDate(analytics.lowestDay.date) : "Unavailable"}</p><p className={cn("mt-1 font-mono text-sm", analytics.lowestDay ? pnlColorClass(analytics.lowestDay.pnl) : "")}>{analytics.lowestDay ? formatPnL(analytics.lowestDay.pnl) : "Unavailable"}</p></div></div></section>

        <div className="mt-6 grid gap-5 xl:grid-cols-3"><BreakdownTable title="Markets" description="Ranked by net P&L in the selected view." rows={analytics.bySymbol} /><BreakdownTable title="Sessions" description="Only records with session context are included." rows={analytics.bySession} labelMap={sessionLabel} /><BreakdownTable title="Setups" description="Multi-tagged records appear in each applicable setup." rows={analytics.bySetup} /></div>

        <div className="mt-6 grid gap-5 xl:grid-cols-2"><BreakdownTable title="Kept process" description="Outcomes attached to positive process tags; tags can overlap." rows={analytics.keptProcess} /><BreakdownTable title="Process leaks" description="Outcomes attached to leak tags; tags can overlap." rows={analytics.processLeaks} /></div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <section className="border border-[var(--hairline)] bg-[var(--surface)] p-5"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Data quality</p><h2 className="mt-1 text-base font-medium">Journal coverage</h2><p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">Comparisons exclude records missing the relevant field.</p><div className="mt-5 space-y-5"><Coverage label="Any review context" value={analytics.reviewCoverage} /><Coverage label="Session captured" value={analytics.metadataCoverage.session} /><Coverage label="Setup captured" value={analytics.metadataCoverage.setup} /><Coverage label="Process captured" value={analytics.metadataCoverage.process} /></div></section>
          <section className="border border-[var(--hairline)] bg-[var(--surface)] p-5"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Observed in this view</p><h2 className="mt-1 text-base font-medium">Review notes</h2>{observations.length ? <div className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">{observations.map((observation, index) => <div key={observation} className="grid grid-cols-[28px_1fr] gap-3 py-3"><span className="font-mono text-[10px] text-[var(--faint)]">{String(index + 1).padStart(2, "0")}</span><p className="text-sm leading-relaxed text-[var(--muted)]">{observation}</p></div>)}</div> : <p className="mt-4 border border-[var(--hairline)] bg-[var(--raised)] p-4 text-sm leading-relaxed text-[var(--muted)]">No comparison has enough context to surface responsibly. Add session, setup, and process tags during trade review.</p>}</section>
        </div>
      </>}
    </AppShell>
  )
}
