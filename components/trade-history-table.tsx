"use client"

import { useMemo, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatPnL, pnlColorClass } from "@/lib/utils"
import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { Trade } from "@/lib/types"
import { buildMetaMapFromTrades, DISCIPLINE_POSITIVE, DIRECTION_LABELS, type TradeMeta } from "@/lib/trade-meta"
import { resolveSession, SESSION_LABELS } from "@/lib/sessions"

interface TradeHistoryTableProps {
  trades: Trade[]
  onEditTrade?: (trade: Trade) => void
  onDeleteTrade?: (trade: Trade) => void
}

interface DayGroup {
  date: string
  trades: Trade[]
  dailyPnl: number
  winCount: number
  lossCount: number
  winRate: number
  symbols: string[]
}

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatGroupDate(dateStr: string): string {
  return parseDateLocal(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

// ── Session badge ────────────────────────────────────────────────────────────

function SessionBadge({ meta }: { meta: TradeMeta }) {
  const session = resolveSession(meta)
  if (!session) return null
  return (
    <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
      {SESSION_LABELS[session]}
    </span>
  )
}

// ── Grade pill ───────────────────────────────────────────────────────────────

function GradePill({ grade }: { grade?: string }) {
  if (!grade) return null
  return (
    <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">
      {grade}
    </span>
  )
}

// ── Direction badge ──────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction?: string }) {
  if (!direction) return null
  const label = DIRECTION_LABELS[direction as keyof typeof DIRECTION_LABELS]
  if (!label) return null
  return (
    <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
      {label}
    </span>
  )
}

// ── Expanded detail panel ────────────────────────────────────────────────────

function TradeDetailPanel({ trade, meta, colSpan }: { trade: Trade; meta: TradeMeta; colSpan: number }) {
  const session = resolveSession(meta)
  const hasMeta =
    session || meta.grade || meta.direction ||
    (meta.disciplineTags && meta.disciplineTags.length > 0) ||
    (meta.setupTags && meta.setupTags.length > 0) ||
    meta.entryPrice || meta.exitPrice || meta.contracts || trade.notes

  return (
    <TableRow className="border-none hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="overflow-hidden animate-in slide-in-from-top-1 fade-in duration-200">
          <div className="mx-2.5 mb-2 mt-0.5 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] p-2 sm:p-3">
            {!hasMeta ? (
              <p className="text-[11px] italic text-[var(--muted)]">No details recorded.</p>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {/* Badges row */}
                {(session || meta.direction || meta.grade) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {session && <SessionBadge meta={meta} />}
                    {meta.direction && <DirectionBadge direction={meta.direction} />}
                    {meta.grade && <GradePill grade={meta.grade} />}
                  </div>
                )}

                {/* Price details */}
                {(meta.entryPrice || meta.exitPrice || meta.contracts) && (
                  <div className="flex items-center gap-3 text-[11px]">
                    {meta.entryPrice != null && (
                      <span className="text-[var(--muted)]">
                        <span className="mr-1 text-[var(--faint)]">Entry</span>
                        <span className="font-mono text-[var(--text)]">{meta.entryPrice.toFixed(2)}</span>
                      </span>
                    )}
                    {meta.exitPrice != null && (
                      <span className="text-[var(--muted)]">
                        <span className="mr-1 text-[var(--faint)]">Exit</span>
                        <span className="font-mono text-[var(--text)]">{meta.exitPrice.toFixed(2)}</span>
                      </span>
                    )}
                    {meta.contracts != null && (
                      <span className="text-[var(--muted)]">
                        <span className="mr-1 text-[var(--faint)]">Qty</span>
                        <span className="font-mono text-[var(--text)]">{meta.contracts}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Setup tags */}
                {meta.setupTags && meta.setupTags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {meta.setupTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Discipline tags */}
                {meta.disciplineTags && meta.disciplineTags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {meta.disciplineTags.map((tag) => {
                      const isPositive = DISCIPLINE_POSITIVE.includes(tag as typeof DISCIPLINE_POSITIVE[number])
                      return (
                        <span
                          key={tag}
                          className={cn("rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]", isPositive && "font-semibold text-white")}
                        >
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Notes */}
                {trade.notes && (
                  <p className="text-[11px] leading-relaxed text-[var(--muted)]">{trade.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function TradeHistoryTable({ trades, onEditTrade, onDeleteTrade }: TradeHistoryTableProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [expandedTradeIds, setExpandedTradeIds] = useState<Set<string>>(new Set())
  const allMeta = useMemo<Record<string, TradeMeta>>(
    () => buildMetaMapFromTrades(trades),
    [trades],
  )

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const toggleTrade = (id: string) => {
    setExpandedTradeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const groups = useMemo<DayGroup[]>(() => {
    const map: Record<string, Trade[]> = {}
    for (const t of trades) { (map[t.date] ??= []).push(t) }
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dayTrades]) => {
        const wins = dayTrades.filter((t) => t.pnl > 0)
        const losses = dayTrades.filter((t) => t.pnl < 0)
        const nonFlat = wins.length + losses.length
        return {
          date,
          trades: dayTrades,
          dailyPnl: dayTrades.reduce((s, t) => s + t.pnl, 0),
          winCount: wins.length,
          lossCount: losses.length,
          winRate: nonFlat > 0 ? Math.round((wins.length / nonFlat) * 100) : 0,
          symbols: [...new Set(dayTrades.map((t) => t.symbol))],
        }
    })
  }, [trades])

  const hasActions = !!(onEditTrade || onDeleteTrade)
  // total column count for colSpan on detail rows
  const totalCols = 5 + (hasActions ? 1 : 0) + 1 // expand + date + symbols + pnl + trades + win + actions

  if (trades.length === 0) {
    return (
      <Card className="activity-panel overflow-hidden rounded-[2px] border-[var(--hairline)] bg-[var(--surface)]">
        <div className="border-b border-[var(--hairline)] px-3 py-2.5 sm:px-[18px] sm:py-3.5">
          <h2 className="text-sm sm:text-lg font-semibold">Trade History</h2>
        </div>
        <div className="py-8 sm:py-12 px-6 text-center space-y-1">
          <p className="text-sm font-medium text-[var(--text)]">No trades logged yet.</p>
          <p className="text-xs text-[var(--muted)]">Add a trade manually or import a screenshot when you are ready.</p>
          <p className="pt-1 text-[11px] text-[var(--faint)]">Optional setup and discipline details can be added later.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="activity-panel overflow-hidden rounded-[2px] border-[var(--hairline)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-3 py-2.5 sm:px-[18px] sm:py-3.5">
        <h2 className="text-sm sm:text-lg font-semibold">Trade History</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {trades.length} trade{trades.length !== 1 ? "s" : ""} · {groups.length} day{groups.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--hairline)] hover:bg-transparent">
              <TableHead className="w-9 px-3 sm:px-4" />
              <TableHead className="px-2 sm:px-3">Date</TableHead>
              <TableHead className="px-2 sm:px-3 hidden sm:table-cell">Symbol(s)</TableHead>
              <TableHead className="text-right px-2 sm:px-3">Net PnL</TableHead>
              <TableHead className="text-right px-2 sm:px-3 hidden sm:table-cell">Trades</TableHead>
              <TableHead className="text-right px-2 sm:px-3 hidden md:table-cell">Win</TableHead>
              {hasActions && <TableHead className="w-10 px-2 sm:px-3" />}
            </TableRow>
          </TableHeader>

          <TableBody>
            {groups.flatMap((group) => {
              const isGroupExpanded = expandedDates.has(group.date)
              const isMulti = group.trades.length > 1
              const singleTrade = group.trades.length === 1 ? group.trades[0] : null
              const singleTradeExpanded = singleTrade ? expandedTradeIds.has(singleTrade.id) : false

              const rows: React.ReactNode[] = []

              // ── Day summary row ──────────────────────────────────────────────
              rows.push(
              <TableRow
                  key={group.date}
                  className={cn(
                    "group cursor-pointer border-[var(--hairline)] transition-colors hover:bg-[var(--raised)]",
                    (isGroupExpanded || singleTradeExpanded) && "bg-[var(--raised)]",
                  )}
                  onClick={() => isMulti ? toggleDate(group.date) : singleTrade ? toggleTrade(singleTrade.id) : undefined}
                >
                  {/* Expand chevron + left status bar */}
                  <TableCell className="py-1.5 sm:py-3 px-2 sm:px-4 w-9">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "h-4 w-px shrink-0 bg-[var(--faint)] sm:h-5",
                      )} />
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200",
                          (isGroupExpanded || singleTradeExpanded) && "rotate-90 text-muted-foreground/70",
                        )}
                      />
                    </div>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="py-1.5 sm:py-3.5 px-2 sm:px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-[var(--text)] sm:text-sm">
                        {formatGroupDate(group.date)}
                      </span>
                      {/* Session + Direction badges for single-trade rows */}
                      {singleTrade && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {resolveSession(allMeta[singleTrade.id] ?? {}) && (
                            <SessionBadge meta={allMeta[singleTrade.id] ?? {}} />
                          )}
                          {allMeta[singleTrade.id]?.direction && (
                            <DirectionBadge direction={allMeta[singleTrade.id].direction} />
                          )}
                        </div>
                      )}
                      {/* Mobile: show symbol + trade count for multi-trade days */}
                      {isMulti && (
                        <span className="text-[10px] text-muted-foreground/50 sm:hidden">
                          {group.symbols.slice(0, 2).join(" · ")}{group.symbols.length > 2 ? ` +${group.symbols.length - 2}` : ""} · {group.trades.length} trades
                        </span>
                      )}
                    </div>
                </TableCell>

                  {/* Symbol chips */}
                  <TableCell className="px-2 sm:px-3 hidden sm:table-cell">
                    <div className="flex gap-1 flex-wrap items-center">
                      {group.symbols.slice(0, 3).map((sym) => (
                        <span key={sym} className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--muted)]">
                          {sym}
                        </span>
                      ))}
                      {group.symbols.length > 3 && <span className="text-[11px] text-muted-foreground/60">+{group.symbols.length - 3}</span>}
                      {/* Grade for single-trade rows */}
                      {singleTrade && allMeta[singleTrade.id]?.grade && (
                        <GradePill grade={allMeta[singleTrade.id].grade} />
                      )}
                    </div>
                </TableCell>

                  {/* Daily PnL — formatPnL always emits a leading − on a loss.
                      Color is only legal on that signed figure. */}
                  <TableCell className="text-right py-1.5 sm:py-3.5 px-2 sm:px-3">
                  <span className={cn(
                      "font-mono font-bold text-sm sm:text-[15px] tabular-nums",
                      pnlColorClass(group.dailyPnl),
                    )}>
                      {formatPnL(group.dailyPnl)}
                    </span>
                  </TableCell>

                  {/* Trade count */}
                  <TableCell className="text-right px-2 sm:px-3 hidden sm:table-cell">
                    <span className="text-xs tabular-nums text-muted-foreground">{group.trades.length}</span>
                  </TableCell>

                  {/* Win rate */}
                  <TableCell className="text-right px-2 sm:px-3 hidden md:table-cell">
                    <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                      {group.winRate}%
                    </span>
                  </TableCell>

                  {/* Actions — single-trade days only */}
                  {hasActions && (
                    <TableCell className="px-2 sm:px-3" onClick={(e) => e.stopPropagation()}>
                      {singleTrade && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                              <span className="sr-only">Trade options</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {onEditTrade && <DropdownMenuItem onClick={() => onEditTrade(singleTrade)}><Pencil className="h-4 w-4 mr-2" />Edit Trade</DropdownMenuItem>}
                            {onDeleteTrade && <DropdownMenuItem onClick={() => onDeleteTrade(singleTrade)} className="font-semibold"><Trash2 className="h-4 w-4 mr-2" />Delete Trade</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )

              // ── Single-trade detail panel ────────────────────────────────────
              if (singleTrade && singleTradeExpanded) {
                rows.push(
                  <TradeDetailPanel
                    key={`detail-${singleTrade.id}`}
                    trade={singleTrade}
                    meta={allMeta[singleTrade.id] ?? {}}
                    colSpan={totalCols}
                  />
                )
              }

              // ── Multi-trade expanded sub-rows ────────────────────────────────
              if (isMulti && isGroupExpanded) {
                group.trades.forEach((trade) => {
                  const isTradeExpanded = expandedTradeIds.has(trade.id)
                  const tradeMeta = allMeta[trade.id] ?? {}

                  rows.push(
                    <TableRow
                      key={`trade-${trade.id}`}
                      className="group cursor-pointer border-[var(--hairline)] bg-[var(--surface)] transition-colors hover:bg-[var(--raised)]"
                      onClick={() => toggleTrade(trade.id)}
                    >
                      {/* Indent + chevron */}
                      <TableCell className="py-1.5 sm:py-2.5 px-3 sm:px-4 w-9">
                        <div className="flex items-center gap-0.5 pl-1">
                          <div className="h-3 w-px shrink-0 bg-[var(--faint)]" />
                          <ChevronRight className={cn("h-3 w-3 text-muted-foreground/30 transition-transform duration-200 ml-0.5", isTradeExpanded && "rotate-90 text-muted-foreground/55")} />
                        </div>
                      </TableCell>

                      {/* Symbol + session info */}
                      <TableCell className="py-1.5 sm:py-2.5 px-2 sm:px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          {resolveSession(tradeMeta) && <SessionBadge meta={tradeMeta} />}
                        </div>
                      </TableCell>

                      {/* Symbol chip + grade */}
                      <TableCell className="px-2 sm:px-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-[var(--text)]">{trade.symbol}</span>
                          {tradeMeta.grade && <GradePill grade={tradeMeta.grade} />}
                          {trade.notes && !isTradeExpanded && (
                            <span className="text-[11px] text-muted-foreground/40 truncate max-w-[100px]">{trade.notes}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Individual PnL */}
                      <TableCell className="text-right py-1.5 sm:py-2.5 px-2 sm:px-3">
                        <span className={cn("font-mono text-xs font-semibold tabular-nums", pnlColorClass(trade.pnl))}>
                    {formatPnL(trade.pnl)}
                  </span>
                </TableCell>

                      <TableCell className="hidden sm:table-cell" />
                      <TableCell className="hidden md:table-cell" />

                      {/* Actions */}
                      {hasActions && (
                        <TableCell className="px-2 sm:px-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                                <span className="sr-only">Trade options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                              {onEditTrade && <DropdownMenuItem onClick={() => onEditTrade(trade)}><Pencil className="h-4 w-4 mr-2" />Edit Trade</DropdownMenuItem>}
                              {onDeleteTrade && <DropdownMenuItem onClick={() => onDeleteTrade(trade)} className="font-semibold"><Trash2 className="h-4 w-4 mr-2" />Delete Trade</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
                  )

                  // Individual trade detail panel
                  if (isTradeExpanded) {
                    rows.push(
                      <TradeDetailPanel
                        key={`detail-${trade.id}`}
                        trade={trade}
                        meta={tradeMeta}
                        colSpan={totalCols}
                      />
                    )
                  }
                })
              }

              return rows
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
