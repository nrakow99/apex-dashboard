"use client"

import { useMemo, useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { Trade } from "@/lib/types"
import { loadAllTradeMeta, GRADE_STYLES, DISCIPLINE_POSITIVE, DIRECTION_BADGE_STYLES, DIRECTION_LABELS, type TradeMeta } from "@/lib/trade-meta"
import { resolveSession, SESSION_LABELS, SESSION_BADGE_STYLES } from "@/lib/sessions"

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
    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border", SESSION_BADGE_STYLES[session])}>
      {SESSION_LABELS[session]}
    </span>
  )
}

// ── Grade pill ───────────────────────────────────────────────────────────────

function GradePill({ grade }: { grade?: string }) {
  if (!grade) return null
  const s = GRADE_STYLES[grade as keyof typeof GRADE_STYLES]
  if (!s) return null
  return (
    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md border", s.activeClassName)}>
      {grade}
    </span>
  )
}

// ── Direction badge ──────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction?: string }) {
  if (!direction) return null
  const style = DIRECTION_BADGE_STYLES[direction as keyof typeof DIRECTION_BADGE_STYLES]
  const label = DIRECTION_LABELS[direction as keyof typeof DIRECTION_LABELS]
  if (!style || !label) return null
  return (
    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border", style)}>
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
    meta.entryPrice || meta.exitPrice || meta.contracts || trade.notes

  return (
    <TableRow className="border-none hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="overflow-hidden">
          <div className="mx-2.5 mb-2 mt-0.5 rounded-xl bg-[rgba(83,104,120,0.05)] border border-[rgba(83,104,120,0.12)] p-2 sm:p-3">
            {!hasMeta ? (
              <p className="text-[11px] text-[#E5E4E2]/25 italic">No details recorded.</p>
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
                      <span className="text-[#E5E4E2]/40">
                        <span className="text-[#E5E4E2]/25 mr-1">Entry</span>
                        <span className="font-mono text-[#E5E4E2]/65">{meta.entryPrice.toFixed(2)}</span>
                      </span>
                    )}
                    {meta.exitPrice != null && (
                      <span className="text-[#E5E4E2]/40">
                        <span className="text-[#E5E4E2]/25 mr-1">Exit</span>
                        <span className="font-mono text-[#E5E4E2]/65">{meta.exitPrice.toFixed(2)}</span>
                      </span>
                    )}
                    {meta.contracts != null && (
                      <span className="text-[#E5E4E2]/40">
                        <span className="text-[#E5E4E2]/25 mr-1">Qty</span>
                        <span className="font-mono text-[#E5E4E2]/65">{meta.contracts}</span>
                      </span>
                    )}
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
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                            isPositive
                              ? "bg-teal-500/[0.08] border-teal-500/22 text-teal-300/70"
                              : "bg-amber-500/[0.07] border-amber-500/20 text-amber-400/65",
                          )}
                        >
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Notes */}
                {trade.notes && (
                  <p className="text-[11px] text-[#E5E4E2]/50 leading-relaxed">{trade.notes}</p>
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
  const [allMeta, setAllMeta] = useState<Record<string, TradeMeta>>({})

  useEffect(() => {
    setAllMeta(loadAllTradeMeta())
  }, [])

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n })
  }

  const toggleTrade = (id: string) => {
    setExpandedTradeIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
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
      <Card className="rounded-[20px] sm:rounded-[24px] glass-card overflow-hidden">
        <div className="px-3 sm:px-[18px] py-2.5 sm:py-3.5 border-b border-white/[0.07]">
          <h2 className="text-sm sm:text-lg font-semibold">Trade History</h2>
        </div>
        <div className="py-8 sm:py-12 px-6 text-center space-y-1.5 sm:space-y-2">
          <p className="text-sm text-[#E5E4E2]/45">No trades logged yet.</p>
          <p className="text-xs text-[#E5E4E2]/25">Protecting capital is also progress.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="rounded-[20px] sm:rounded-[24px] glass-card overflow-hidden">
      <div className="px-3 sm:px-[18px] py-2.5 sm:py-3.5 border-b border-white/[0.07] flex items-center justify-between">
        <h2 className="text-sm sm:text-lg font-semibold">Trade History</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {trades.length} trade{trades.length !== 1 ? "s" : ""} · {groups.length} day{groups.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.07] hover:bg-transparent">
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
              const isProfit = group.dailyPnl > 0
              const isLoss = group.dailyPnl < 0
              const singleTrade = group.trades.length === 1 ? group.trades[0] : null
              const singleTradeExpanded = singleTrade ? expandedTradeIds.has(singleTrade.id) : false

              const rows: React.ReactNode[] = []

              // ── Day summary row ──────────────────────────────────────────────
              rows.push(
                <TableRow
                  key={group.date}
                  className={cn(
                    "border-white/[0.07] transition-colors group cursor-pointer",
                    isProfit && "hover:bg-emerald-500/[0.04]",
                    isLoss && "hover:bg-red-500/[0.04]",
                    !isProfit && !isLoss && "hover:bg-white/[0.02]",
                    isGroupExpanded && isProfit && "bg-emerald-500/[0.03]",
                    isGroupExpanded && isLoss && "bg-red-500/[0.03]",
                    singleTradeExpanded && "bg-[rgba(83,104,120,0.04)]",
                  )}
                  onClick={() => isMulti ? toggleDate(group.date) : singleTrade ? toggleTrade(singleTrade.id) : undefined}
                >
                  {/* Expand chevron */}
                  <TableCell className="py-1.5 sm:py-3 px-2 sm:px-4 w-9">
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200",
                        (isGroupExpanded || singleTradeExpanded) && "rotate-90 text-muted-foreground/70",
                      )}
                    />
                  </TableCell>

                  {/* Date */}
                  <TableCell className="py-1.5 sm:py-3.5 px-2 sm:px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-medium text-[#E5E4E2]/80">
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
                    </div>
                  </TableCell>

                  {/* Symbol chips */}
                  <TableCell className="px-2 sm:px-3 hidden sm:table-cell">
                    <div className="flex gap-1 flex-wrap items-center">
                      {group.symbols.slice(0, 3).map((sym) => (
                        <span key={sym} className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(83,104,120,0.13)] text-[#94AAB8] border border-[rgba(83,104,120,0.18)]">
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

                  {/* Daily PnL */}
                  <TableCell className="text-right py-1.5 sm:py-3.5 px-2 sm:px-3">
                    <span className={cn(
                      "font-mono font-bold text-sm sm:text-[15px] tabular-nums",
                      isProfit ? "text-emerald-500" : isLoss ? "text-red-500" : "text-muted-foreground",
                    )}>
                      {isProfit ? "+" : ""}${Math.abs(group.dailyPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </TableCell>

                  {/* Trade count */}
                  <TableCell className="text-right px-2 sm:px-3 hidden sm:table-cell">
                    <span className="text-xs tabular-nums text-muted-foreground">{group.trades.length}</span>
                  </TableCell>

                  {/* Win rate */}
                  <TableCell className="text-right px-2 sm:px-3 hidden md:table-cell">
                    <span className={cn("text-xs font-medium tabular-nums",
                      group.winRate >= 60 ? "text-emerald-500" : group.winRate >= 40 ? "text-amber-400" : "text-red-500",
                    )}>
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
                            {onDeleteTrade && <DropdownMenuItem onClick={() => onDeleteTrade(singleTrade)} className="text-red-500 focus:text-red-500"><Trash2 className="h-4 w-4 mr-2" />Delete Trade</DropdownMenuItem>}
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
                      className="border-white/[0.04] bg-[rgba(83,104,120,0.025)] hover:bg-[rgba(83,104,120,0.05)] transition-colors group cursor-pointer"
                      onClick={() => toggleTrade(trade.id)}
                    >
                      {/* Indent + chevron */}
                      <TableCell className="py-1.5 sm:py-2.5 px-3 sm:px-4 w-9">
                        <div className="flex items-center gap-0.5 pl-1">
                          <div className={cn("w-0.5 h-3 rounded-full shrink-0", trade.pnl > 0 ? "bg-emerald-500/30" : trade.pnl < 0 ? "bg-red-500/30" : "bg-border/40")} />
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
                          <span className="font-mono text-xs font-semibold text-[#E5E4E2]/65">{trade.symbol}</span>
                          {tradeMeta.grade && <GradePill grade={tradeMeta.grade} />}
                          {trade.notes && !isTradeExpanded && (
                            <span className="text-[11px] text-muted-foreground/40 truncate max-w-[100px]">{trade.notes}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Individual PnL */}
                      <TableCell className="text-right py-1.5 sm:py-2.5 px-2 sm:px-3">
                        <span className={cn("font-mono text-xs font-semibold tabular-nums",
                          trade.pnl > 0 ? "text-emerald-500/80" : trade.pnl < 0 ? "text-red-500/80" : "text-muted-foreground",
                        )}>
                          {trade.pnl > 0 ? "+" : ""}${trade.pnl.toFixed(2)}
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
                              {onDeleteTrade && <DropdownMenuItem onClick={() => onDeleteTrade(trade)} className="text-red-500 focus:text-red-500"><Trash2 className="h-4 w-4 mr-2" />Delete Trade</DropdownMenuItem>}
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
