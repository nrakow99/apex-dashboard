"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Account, DailyPnL, Trade } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"

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

  const rules = getAccountRules(account)
  const isPA = account.type === "PA"
  const minQualifyingProfit = rules.minDailyProfit

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
    "min-h-[54px] aspect-square sm:min-h-[64px] sm:rounded-2xl sm:aspect-square sm:min-w-0",
    "lg:aspect-auto lg:w-full lg:justify-center lg:rounded-xl lg:p-2",
    "lg:h-[clamp(92px,14dvh,122px)] lg:min-h-[92px] lg:max-h-[122px]",
  )

  return (
    <Card className="flex flex-col rounded-[24px] glass-card p-3 sm:p-4 lg:p-5 lg:min-h-[min(920px,calc(100dvh-7.5rem))]">
      <div className="mb-2 flex flex-shrink-0 flex-col gap-2 sm:gap-2.5 lg:mb-3 lg:gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold sm:text-lg">Trading Calendar</h2>
        </div>
        <div className="flex items-center justify-center gap-2 sm:justify-end sm:gap-3">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 sm:h-9 sm:w-9">
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-medium sm:min-w-[160px] sm:text-base">
            {monthName}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 sm:h-9 sm:w-9">
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="mb-2 grid flex-shrink-0 grid-cols-7 gap-1 sm:mb-2.5 sm:gap-1.5 lg:gap-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center text-[10px] font-medium text-muted-foreground sm:py-2 sm:text-xs lg:text-[11px]"
          >
            <span className="sm:hidden">{day.slice(0, 1)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 sm:gap-2 lg:gap-2 lg:content-start">
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
          const qualifiesForPayout = isPA && dayStats && dayStats.pnl >= minQualifyingProfit

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              disabled={!hasTrades}
              className={cn(
                cellShell,
                "p-1 sm:p-1.5",
                hasTrades &&
                  dayStats.pnl > 0 &&
                  "bg-emerald-500/12 hover:bg-emerald-500/18 shadow-[0_0_20px_-14px_rgba(16,185,129,0.6)]",
                hasTrades &&
                  dayStats.pnl > 0 &&
                  qualifiesForPayout &&
                  "border sm:border-2 border-amber-400/60 ring-1 ring-amber-400/30 lg:border lg:ring-1",
                hasTrades &&
                  dayStats.pnl > 0 &&
                  !qualifiesForPayout &&
                  "border sm:border-2 border-emerald-500/30 lg:border lg:ring-1",
                hasTrades && dayStats.pnl < 0 && "border sm:border-2 border-red-500/30 bg-red-500/12 hover:bg-red-500/20 lg:border",
                hasTrades &&
                  dayStats.pnl === 0 &&
                  "border border-border/50 bg-muted/50 hover:bg-muted sm:border-2 lg:border",
                !hasTrades && !isWeekend && "cursor-default border border-white/5 bg-slate-900/30",
                !hasTrades && isWeekend && "cursor-default border border-white/5 bg-slate-900/20",
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background sm:ring-offset-2",
                hasTrades && "cursor-pointer",
              )}
            >
              {qualifiesForPayout && (
                <div className="absolute right-0.5 top-0.5 sm:right-1 sm:top-1 lg:right-0.5 lg:top-0.5">
                  <Star className="h-2 w-2 fill-amber-400 text-amber-400 sm:h-3 sm:w-3" />
                </div>
              )}
              <span
                className={cn(
                  "text-[15px] font-semibold leading-none sm:text-base lg:text-[15px] xl:text-[16px]",
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
                      "mt-0 max-w-full truncate font-mono text-[10px] font-bold sm:mt-0.5 sm:text-[11px] lg:text-[12px]",
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
                  <div className="mt-0.5 hidden items-center gap-1 sm:flex lg:mt-1 lg:gap-1">
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

      {/* Expanded Day Detail Panel */}
      {selectedDate && selectedTrades.length > 0 && selectedDayStats && (
        <div className="mt-4 border-t border-border/50 pt-4 sm:mt-6 sm:pt-6 lg:mt-3 lg:pt-3">
          <div className="mb-4 flex items-start justify-between sm:mb-5 lg:mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold sm:text-lg">
                {new Date(selectedDate).toLocaleDateString("en-US", {
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
                {isPA && selectedDayStats.pnl >= minQualifyingProfit && (
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

          <div className="space-y-2">
            {selectedTrades.map((trade) => (
              <div
                key={trade.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 sm:rounded-xl sm:p-4",
                  trade.pnl > 0
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : trade.pnl < 0
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-border/50 bg-muted/30",
                )}
              >
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className="font-mono text-sm font-semibold sm:text-base">{trade.symbol}</span>
                  <span
                    className={cn(
                      "hidden items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium sm:flex",
                      trade.pnl > 0
                        ? "bg-emerald-500/20 text-emerald-500"
                        : trade.pnl < 0
                          ? "bg-red-500/20 text-red-500"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {trade.pnl > 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3" /> Win
                      </>
                    ) : trade.pnl < 0 ? (
                      <>
                        <TrendingDown className="h-3 w-3" /> Loss
                      </>
                    ) : (
                      <>
                        <Minus className="h-3 w-3" /> Flat
                      </>
                    )}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono text-base font-bold sm:text-lg",
                    trade.pnl > 0 ? "text-emerald-500" : trade.pnl < 0 ? "text-red-500" : "text-muted-foreground",
                  )}
                >
                  {trade.pnl > 0 ? "+" : ""}${trade.pnl.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-shrink-0 flex-wrap items-center justify-center gap-3 border-t border-border/50 pt-2.5 sm:mt-4 sm:gap-5 sm:pt-3 lg:mt-auto lg:gap-6 lg:pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <div className="h-3 w-3 rounded border border-emerald-500/40 bg-emerald-500/20 sm:h-4 sm:w-4 sm:border-2" />
          <span>Profit</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <div className="h-3 w-3 rounded border border-red-500/40 bg-red-500/20 sm:h-4 sm:w-4 sm:border-2" />
          <span>Loss</span>
        </div>
        {isPA && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
            <div className="flex h-3 w-3 items-center justify-center rounded border border-amber-400/60 bg-emerald-500/20 sm:h-4 sm:w-4 sm:border-2">
              <Star className="h-1.5 w-1.5 fill-amber-400 text-amber-400 sm:h-2 sm:w-2" />
            </div>
            <span>Qualifying Day</span>
          </div>
        )}
      </div>
    </Card>
  )
}
