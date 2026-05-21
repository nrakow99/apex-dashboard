"use client"

import { useMemo, useState, useEffect } from "react"
import { parseLocalDate } from "@/lib/date-utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Account, DailyPnL, Trade } from "@/lib/types"
import { getAccountRules, resolveTradeifyProgram } from "@/lib/rules"
import { getRuleStartingBalance } from "@/lib/account-quantity"
import { buildMetaMapFromTrades, DIRECTION_BADGE_STYLES, DIRECTION_LABELS, GRADE_STYLES, type TradeMeta } from "@/lib/trade-meta"
import { resolveSession, SESSION_LABELS } from "@/lib/sessions"

interface TradingCalendarProps {
  account: Account
  dailyData: DailyPnL[]
  trades: Trade[]
}

interface DayStats {
  pnl: number
  tradeCount: number
  winCount: number
  lossCount: number
  winPercent: number
}

export function TradingCalendar({ account, dailyData, trades }: TradingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [allMeta, setAllMeta] = useState<Record<string, TradeMeta>>({})

  useEffect(() => {
    setAllMeta(buildMetaMapFromTrades(trades))
  }, [trades])

  const rules = getAccountRules(account)
  const tradeifyProgram = resolveTradeifyProgram(account)
  const isTradeifyFlex = account.firm === "Tradeify" && tradeifyProgram === "select_flex"
  const isTradeifyEval =
    account.firm === "Tradeify" &&
    (tradeifyProgram === "select_eval" || account.type === "Eval")

  const isEvalAccount = account.type === "Eval"
  const showQualifyingStars =
    !isEvalAccount &&
    ((account.firm === "Apex" &&
      rules.hasPayouts &&
      rules.minProfitDays > 0 &&
      rules.minDailyProfit > 0) ||
      (account.firm === "Lucid" &&
        account.type === "PA" &&
        rules.hasPayouts &&
        rules.minProfitDays > 0) ||
      isTradeifyFlex)
  const minQualifyingProfit = isTradeifyFlex
    ? rules.winningDayThreshold
    : rules.minDailyProfit

  const tradeifyConsistencyWarnDates = useMemo(() => {
    if (!isTradeifyEval) return new Set<string>()
    const sorted = [...dailyData].sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = 0
    const warn = new Set<string>()
    for (const d of sorted) {
      cumulative += d.pnl
      if (cumulative > 0 && d.pnl > 0 && d.pnl > cumulative * 0.4) {
        warn.add(d.date)
      }
    }
    return warn
  }, [dailyData, isTradeifyEval])

  const startingBalance = getRuleStartingBalance(account)
  const bufferLine =
    account.firm === "Tradeify" && tradeifyProgram === "select_daily"
      ? startingBalance + rules.bufferAmount
      : 0

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const getDayStats = useMemo(() => {
    const statsMap: Record<string, DayStats> = {}

    for (const day of dailyData) {
      const dayTrades = trades.filter((t) => t.date === day.date)
      const winCount = dayTrades.filter((t) => t.pnl > 0).length
      const lossCount = dayTrades.filter((t) => t.pnl < 0).length
      const totalCountForWin = winCount + lossCount

      statsMap[day.date] = {
        pnl: day.pnl,
        tradeCount: day.tradesCount,
        winCount,
        lossCount,
        winPercent: totalCountForWin > 0 ? Math.round((winCount / totalCountForWin) * 100) : 0,
      }
    }

    return (dateKey: string): DayStats | null => statsMap[dateKey] || null
  }, [dailyData, trades])

  const getTradesForDate = (date: string) => {
    return trades.filter((t) => t.date === date)
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDayOfMonth = getFirstDayOfMonth(currentDate)
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDate(null)
  }

  const handleDayClick = (day: number) => {
    const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day)
    const dayStats = getDayStats(dateKey)
    if (dayStats && dayStats.tradeCount > 0) {
      setSelectedDate(selectedDate === dateKey ? null : dateKey)
    }
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const selectedTrades = selectedDate ? getTradesForDate(selectedDate) : []
  const selectedDayStats = selectedDate ? getDayStats(selectedDate) : null

  const cellShell = cn(
    "relative flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl",
    "min-h-[32px] aspect-square sm:min-h-[58px] sm:rounded-2xl sm:aspect-square sm:min-w-0",
    "lg:aspect-auto lg:w-full lg:justify-center lg:rounded-xl lg:p-1.5",
    "lg:h-[clamp(78px,11.5dvh,104px)] lg:min-h-[78px] lg:max-h-[104px]",
  )

  return (
    <Card className="flex flex-col rounded-[20px] sm:rounded-[24px] glass-card p-2 sm:p-4 lg:p-4 max-sm:pb-2 lg:min-h-[min(840px,calc(100dvh-6.5rem))]">
      <div className="mb-1 flex flex-shrink-0 flex-col gap-0.5 sm:gap-2 lg:mb-2 lg:gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold sm:text-lg">Trading Calendar</h2>
        </div>
        <div className="flex items-center justify-center gap-1.5 sm:justify-end sm:gap-3">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7 sm:h-9 sm:w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[110px] text-center text-sm font-medium sm:min-w-[160px] sm:text-base">
            {monthName}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7 sm:h-9 sm:w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="mb-0.5 grid flex-shrink-0 grid-cols-7 gap-0.5 sm:mb-1.5 sm:gap-1.5 lg:gap-1.5">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-0.5 sm:py-1.5 text-center text-[9px] sm:text-xs font-medium text-muted-foreground lg:text-[11px]"
          >
            <span className="sm:hidden">{day.slice(0, 1)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-0.5 sm:gap-1.5 lg:gap-1.5 lg:content-start">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className={cn(cellShell, "pointer-events-none invisible border-0 bg-transparent shadow-none")} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day)
          const dayStats = getDayStats(dateKey)
          const isSelected = selectedDate === dateKey
          const dow = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay()
          const isWeekend = dow === 0 || dow === 6
          const hasTrades = dayStats && dayStats.tradeCount > 0
          const qualifiesForPayout =
            showQualifyingStars &&
            dayStats != null &&
            dayStats.pnl > 0 &&
            dayStats.pnl >= minQualifyingProfit

          const dailyPayoutReady =
            account.firm === "Tradeify" &&
            tradeifyProgram === "select_daily" &&
            dayStats != null &&
            dayStats.pnl > 0 &&
            (dailyData.find((d) => d.date === dateKey)?.balance ?? 0) > bufferLine

          const consistencyWarn =
            isTradeifyEval && hasTrades && tradeifyConsistencyWarnDates.has(dateKey)

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              disabled={!hasTrades}
              className={cn(
                cellShell,
                "p-1 sm:p-1.5",
                // profit day base
                hasTrades &&
                  dayStats.pnl > 0 &&
                  !qualifiesForPayout &&
                  "bg-emerald-500/[0.09] hover:bg-emerald-500/[0.14] border border-emerald-500/25 shadow-[0_0_14px_-12px_rgba(16,185,129,0.25)]",
                // qualifying (gold) day
                hasTrades &&
                  dayStats.pnl > 0 &&
                  qualifiesForPayout &&
                  "bg-amber-500/[0.08] hover:bg-amber-500/[0.13] border border-amber-400/50 shadow-[0_0_16px_-12px_rgba(251,191,36,0.30)]",
                // loss day
                hasTrades &&
                  dayStats.pnl < 0 &&
                  "border border-red-500/25 bg-red-500/[0.09] hover:bg-red-500/[0.14]",
                // flat day
                hasTrades &&
                  dayStats.pnl === 0 &&
                  "border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04]",
                // empty weekday
                !hasTrades && !isWeekend && "cursor-default border border-white/[0.04] bg-[rgba(10,10,10,0.20)]",
                // empty weekend
                !hasTrades && isWeekend && "cursor-default border border-white/[0.025] bg-[rgba(10,10,10,0.12)] opacity-60",
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background sm:ring-offset-2",
                consistencyWarn &&
                  "ring-1 ring-amber-500/70 ring-offset-1 ring-offset-background",
                hasTrades && "cursor-pointer active:scale-[0.96] transition-transform",
              )}
            >
              {consistencyWarn && !qualifiesForPayout && !dailyPayoutReady && (
                <div
                  className="absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 sm:h-2 sm:w-2"
                  title="Day exceeds 40% consistency share"
                />
              )}
              {(qualifiesForPayout || dailyPayoutReady) && (
                <div className="absolute right-0.5 top-0.5 sm:right-1 sm:top-1 lg:right-0.5 lg:top-0.5">
                  <Star
                    className={cn(
                      "h-2 w-2 sm:h-3 sm:w-3",
                      dailyPayoutReady && !qualifiesForPayout
                        ? "fill-emerald-400 text-emerald-400"
                        : "fill-amber-400 text-amber-400",
                    )}
                  />
                </div>
              )}
              <span
                className={cn(
                  "text-[13px] font-semibold leading-none sm:text-base lg:text-[15px] xl:text-[16px]",
                  hasTrades && dayStats.pnl > 0 && "text-emerald-400",
                  hasTrades && dayStats.pnl < 0 && "text-red-400",
                  hasTrades && dayStats.pnl === 0 && "text-muted-foreground",
                  !hasTrades && "text-muted-foreground/40",
                )}
              >
                {day}
              </span>
              {hasTrades && (
                <>
                  <span
                    className={cn(
                      "mt-0 max-w-full truncate font-mono text-[9px] font-bold sm:mt-0.5 sm:text-[11px] lg:text-[12px]",
                      dayStats.pnl > 0
                        ? "text-emerald-400"
                        : dayStats.pnl < 0
                          ? "text-red-400"
                          : "text-muted-foreground",
                    )}
                  >
                    <span className="hidden sm:inline">{dayStats.pnl > 0 ? "+" : ""}$</span>
                    <span className="sm:hidden">{dayStats.pnl > 0 ? "+" : ""}</span>
                    {Math.abs(dayStats.pnl).toLocaleString()}
                  </span>
                  <div className="mt-0.5 hidden items-center gap-1 sm:flex lg:mt-0.5 lg:gap-0.5">
                    <span className="text-[10px] tabular-nums text-muted-foreground lg:text-[10px] xl:text-[11px]">
                      {dayStats.tradeCount} trade{dayStats.tradeCount > 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 lg:text-[10px]">·</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium tabular-nums lg:text-[10px] xl:text-[11px]",
                        dayStats.winPercent >= 60
                          ? "text-emerald-400"
                          : dayStats.winPercent >= 40
                            ? "text-amber-400"
                            : "text-red-400",
                      )}
                    >
                      {dayStats.winPercent}%
                    </span>
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* Empty month message */}
      {dailyData.length === 0 && (
        <div className="mt-2 py-5 text-center">
          <p className="text-sm text-[#E5E4E2]/35">No trades this month.</p>
          <p className="text-xs text-[#E5E4E2]/20 mt-0.5">Add a trade to see daily PnL and qualifying days.</p>
        </div>
      )}

      {/* Expanded Day Detail Panel */}
      {selectedDate && selectedTrades.length > 0 && selectedDayStats && (
        <div className="mt-3 border-t border-border/50 pt-3 sm:mt-6 sm:pt-6 lg:mt-3 lg:pt-3">
          <div className="mb-3 flex items-start justify-between sm:mb-5 lg:mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold sm:text-lg">
                {parseLocalDate(selectedDate).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground sm:text-sm">PnL:</span>
                  <span
                    className={cn(
                      "font-mono text-xs font-bold sm:text-sm",
                      selectedDayStats.pnl > 0
                        ? "text-emerald-500"
                        : selectedDayStats.pnl < 0
                          ? "text-red-500"
                          : "text-muted-foreground",
                    )}
                  >
                    {selectedDayStats.pnl > 0 ? "+" : ""}${selectedDayStats.pnl.toLocaleString()}
                  </span>
                </div>
                <span className="hidden text-muted-foreground/30 sm:inline">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground sm:text-sm">Trades:</span>
                  <span className="text-xs font-semibold sm:text-sm">{selectedDayStats.tradeCount}</span>
                </div>
                <span className="hidden text-muted-foreground/30 sm:inline">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground sm:text-sm">Win:</span>
                  <span
                    className={cn(
                      "text-xs font-semibold sm:text-sm",
                      selectedDayStats.winPercent >= 60
                        ? "text-emerald-500"
                        : selectedDayStats.winPercent >= 40
                          ? "text-amber-500"
                          : "text-red-500",
                    )}
                  >
                    {selectedDayStats.winPercent}%
                  </span>
                </div>
                {showQualifyingStars && selectedDayStats.pnl > 0 && selectedDayStats.pnl >= minQualifyingProfit && (
                  <>
                    <span className="hidden text-muted-foreground/30 sm:inline">|</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 sm:text-sm">
                      <Star className="h-3 w-3 fill-amber-400" /> Qualifying Day (${minQualifyingProfit}+)
                    </span>
                  </>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="-mt-1 h-8 w-8 shrink-0" onClick={() => setSelectedDate(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            {selectedTrades.map((trade) => {
              const meta = allMeta[trade.id] ?? {}
              const session = resolveSession(meta)
              const sessionLabel = session ? SESSION_LABELS[session] : null
              const grade = meta.grade
              const direction = meta.direction
              const setupTags = meta.setupTags ?? []
              return (
                <div
                  key={trade.id}
                  className={cn(
                    "rounded-xl border p-2.5 sm:p-3",
                    trade.pnl > 0
                      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                      : trade.pnl < 0
                        ? "border-red-500/20 bg-red-500/[0.04]"
                        : "border-border/50 bg-muted/20",
                  )}
                >
                  {/* Top row: symbol + badges + PnL */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold">{trade.symbol}</span>
                      {direction && (
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", DIRECTION_BADGE_STYLES[direction])}>
                          {DIRECTION_LABELS[direction]}
                        </span>
                      )}
                      {sessionLabel && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-[rgba(83,104,120,0.10)] text-[#94AAB8] border-[rgba(83,104,120,0.22)]">
                          {sessionLabel}
                        </span>
                      )}
                      {grade && (
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", GRADE_STYLES[grade].activeClassName)}>
                          {grade}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "font-mono text-sm font-bold tabular-nums shrink-0",
                        trade.pnl > 0 ? "text-emerald-500" : trade.pnl < 0 ? "text-red-500" : "text-muted-foreground",
                      )}
                    >
                      {trade.pnl > 0 ? "+" : ""}${trade.pnl.toLocaleString()}
                    </span>
                  </div>
                  {/* Setup tags */}
                  {setupTags.length > 0 && (
                    <div className="mt-1.5 flex gap-1 flex-wrap">
                      {setupTags.map((tag) => (
                        <span key={tag} className="text-[9px] font-medium px-1 py-0.5 rounded border bg-[rgba(83,104,120,0.07)] text-[#94AAB8]/70 border-[rgba(83,104,120,0.18)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Notes */}
                  {trade.notes && (
                    <p className="mt-1 text-[10px] text-[#E5E4E2]/40 leading-snug">{trade.notes}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

    </Card>
  )
}
