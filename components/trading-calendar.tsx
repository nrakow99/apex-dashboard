"use client"

import { useMemo, useState } from "react"
import { parseLocalDate } from "@/lib/date-utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, Star } from "lucide-react"
import { cn, formatPnL } from "@/lib/utils"
import type { Account, DailyPnL, Trade } from "@/lib/types"
import { getAccountRules, resolveTradeifyProgram } from "@/lib/rules"
import { getRuleStartingBalance } from "@/lib/account-quantity"
import { buildMetaMapFromTrades, DIRECTION_LABELS, type TradeMeta } from "@/lib/trade-meta"
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
  const allMeta = useMemo<Record<string, TradeMeta>>(
    () => buildMetaMapFromTrades(trades),
    [trades],
  )

  const rules = getAccountRules(account)
  const tradeifyProgram = resolveTradeifyProgram(account)
  const isTradeifyFlex = account.firm === "Tradeify" && tradeifyProgram === "select_flex"
  const isTradeifyEval =
    account.firm === "Tradeify" &&
    (tradeifyProgram === "select_eval" || account.type === "Eval")
  const consistencyPercent = rules.consistencyPercent

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
    const consistencyFraction = consistencyPercent / 100
    if (consistencyFraction <= 0) return new Set<string>()
    const sorted = [...dailyData].sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = 0
    const warn = new Set<string>()
    for (const d of sorted) {
      cumulative += d.pnl
      if (cumulative > 0 && d.pnl > 0 && d.pnl > cumulative * consistencyFraction) {
        warn.add(d.date)
      }
    }
    return warn
  }, [consistencyPercent, dailyData, isTradeifyEval])

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
    "relative flex flex-col items-center justify-center gap-0.5 rounded-[2px] transition-colors",
    "min-h-[32px] aspect-square sm:min-h-[58px] sm:aspect-square sm:min-w-0",
    "lg:aspect-auto lg:h-[72px] lg:w-full lg:justify-center lg:p-1.5 xl:h-[78px]",
  )

  return (
    <Card className="activity-panel flex flex-col rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-3 sm:p-6">
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
                hasTrades && "border border-[var(--hairline)] bg-[var(--raised)] hover:border-[var(--faint)] hover:bg-[var(--surface)]",
                (qualifiesForPayout || dailyPayoutReady) && "border-l-2 border-l-[var(--text)]",
                // empty weekday
                !hasTrades && !isWeekend && "cursor-default border border-[var(--hairline)] bg-[var(--surface)]",
                // empty weekend
                !hasTrades && isWeekend && "cursor-default border border-[var(--hairline)] bg-[var(--ground)]",
                isSelected && "ring-1 ring-[var(--text)] ring-offset-1 ring-offset-background",
                consistencyWarn &&
                  "border-l-4 border-l-[var(--text)]",
                hasTrades && "cursor-pointer",
              )}
            >
              {consistencyWarn && !qualifiesForPayout && !dailyPayoutReady && (
                <div
                  className="absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-white sm:h-2 sm:w-2"
                  title={`Day exceeds ${rules.consistencyPercent}% consistency share`}
                />
              )}
              {(qualifiesForPayout || dailyPayoutReady) && (
                <div className="absolute right-0.5 top-0.5 sm:right-1 sm:top-1 lg:right-0.5 lg:top-0.5">
                  <Star
                    className={cn(
                      "h-2 w-2 sm:h-3 sm:w-3",
                      "fill-white text-white",
                    )}
                  />
                </div>
              )}
              <span
                className={cn(
                  "text-[13px] font-semibold leading-none sm:text-base lg:text-[15px] xl:text-[16px]",
                  hasTrades && "text-white",
                  !hasTrades && "text-[var(--faint)]",
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
                        ? "text-[var(--gain)]"
                        : dayStats.pnl < 0
                          ? "text-[var(--loss)]"
                          : "text-muted-foreground",
                    )}
                  >
                    {formatPnL(dayStats.pnl)}
                  </span>
                  <div className="mt-0.5 hidden items-center gap-1 sm:flex lg:mt-0.5 lg:gap-0.5">
                    <span className="text-[10px] tabular-nums text-muted-foreground lg:text-[10px] xl:text-[11px]">
                      {dayStats.tradeCount} trade{dayStats.tradeCount > 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 lg:text-[10px]">·</span>
                    <span
                      className="text-[10px] font-medium tabular-nums text-muted-foreground lg:text-[10px] xl:text-[11px]"
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
      {!dailyData.some((day) => day.tradesCount > 0 && day.date.startsWith(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`)) && (
        <div className="mt-2 py-5 text-center">
          <p className="text-sm text-[var(--muted)]">No trades this month.</p>
          <p className="mt-0.5 text-xs text-[var(--faint)]">Add a trade to see daily P&amp;L and qualifying days.</p>
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
                        ? "text-[var(--gain)]"
                        : selectedDayStats.pnl < 0
                          ? "text-[var(--loss)]"
                          : "text-muted-foreground",
                    )}
                  >
                    {formatPnL(selectedDayStats.pnl)}
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
                  <span className="text-xs font-semibold text-[var(--muted)] sm:text-sm">
                    {selectedDayStats.winPercent}%
                  </span>
                </div>
                {showQualifyingStars && selectedDayStats.pnl > 0 && selectedDayStats.pnl >= minQualifyingProfit && (
                  <>
                    <span className="hidden text-muted-foreground/30 sm:inline">|</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-white sm:text-sm">
                      <Star className="h-3 w-3 fill-white" /> Qualifying Day (${minQualifyingProfit}+)
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
                    "rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] p-2.5 sm:p-3",
                  )}
                >
                  {/* Top row: symbol + badges + PnL */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold">{trade.symbol}</span>
                      {direction && (
                        <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                          {DIRECTION_LABELS[direction]}
                        </span>
                      )}
                      {sessionLabel && (
                        <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                          {sessionLabel}
                        </span>
                      )}
                      {grade && (
                        <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                          {grade}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "font-mono text-sm font-bold tabular-nums shrink-0",
                        trade.pnl > 0 ? "text-[var(--gain)]" : trade.pnl < 0 ? "text-[var(--loss)]" : "text-muted-foreground",
                      )}
                    >
                      {formatPnL(trade.pnl)}
                    </span>
                  </div>
                  {/* Setup tags */}
                  {setupTags.length > 0 && (
                    <div className="mt-1.5 flex gap-1 flex-wrap">
                      {setupTags.map((tag) => (
                        <span key={tag} className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-1 py-0.5 text-[9px] font-medium text-[var(--muted)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Notes */}
                  {trade.notes && (
                    <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">{trade.notes}</p>
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
