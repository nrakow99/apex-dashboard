"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DailyPnL, Trade } from "@/lib/types"
import { PA_CONSTANTS } from "@/lib/types"

interface TradingCalendarProps {
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

export function TradingCalendar({ dailyData, trades }: TradingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  // Calculate win stats for a date
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

  return (
    <Card className="p-4 sm:p-6 bg-card/50 backdrop-blur border-border/50">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">Trading Calendar</h2>
        <div className="flex items-center gap-1 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 sm:h-9 sm:w-9">
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <span className="text-sm sm:text-base font-medium min-w-[120px] sm:min-w-[160px] text-center">{monthName}</span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 sm:h-9 sm:w-9">
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-[10px] sm:text-sm text-muted-foreground font-medium py-1 sm:py-2">
            <span className="sm:hidden">{day.slice(0, 1)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day)
          const dayStats = getDayStats(dateKey)
          const isSelected = selectedDate === dateKey
          const isWeekend = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay() === 0 ||
                           new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay() === 6
          const hasTrades = dayStats && dayStats.tradeCount > 0
          const qualifiesForPayout = dayStats && dayStats.pnl >= PA_CONSTANTS.MIN_PROFIT_DAY

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              disabled={!hasTrades}
              className={cn(
                "aspect-square rounded-lg sm:rounded-xl flex flex-col items-center justify-center transition-all relative min-h-[44px] sm:min-h-[90px] p-1 sm:p-2",
                hasTrades && dayStats.pnl > 0 && "bg-emerald-500/15 hover:bg-emerald-500/25",
                hasTrades && dayStats.pnl > 0 && qualifiesForPayout && "border sm:border-2 border-amber-400/60 ring-1 ring-amber-400/30",
                hasTrades && dayStats.pnl > 0 && !qualifiesForPayout && "border sm:border-2 border-emerald-500/30",
                hasTrades && dayStats.pnl < 0 && "bg-red-500/15 hover:bg-red-500/25 border sm:border-2 border-red-500/30",
                hasTrades && dayStats.pnl === 0 && "bg-muted/50 hover:bg-muted border border-border/50",
                !hasTrades && !isWeekend && "bg-muted/20 border border-transparent",
                !hasTrades && isWeekend && "bg-muted/10 border border-transparent",
                isSelected && "ring-2 ring-primary ring-offset-1 sm:ring-offset-2 ring-offset-background",
                hasTrades && "cursor-pointer",
                !hasTrades && "cursor-default"
              )}
            >
              {/* $250+ indicator */}
              {qualifiesForPayout && (
                <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1">
                  <Star className="h-2 w-2 sm:h-3 sm:w-3 text-amber-400 fill-amber-400" />
                </div>
              )}
              <span className={cn(
                "text-sm sm:text-lg font-semibold",
                hasTrades && dayStats.pnl > 0 && "text-emerald-400",
                hasTrades && dayStats.pnl < 0 && "text-red-400",
                hasTrades && dayStats.pnl === 0 && "text-muted-foreground",
                !hasTrades && "text-muted-foreground/40"
              )}>
                {day}
              </span>
              {hasTrades && (
                <>
                  <span className={cn(
                    "text-[9px] sm:text-sm font-mono font-bold mt-0 sm:mt-0.5 truncate max-w-full",
                    dayStats.pnl > 0 ? "text-emerald-400" : dayStats.pnl < 0 ? "text-red-400" : "text-muted-foreground"
                  )}>
                    <span className="hidden sm:inline">{dayStats.pnl > 0 ? "+" : dayStats.pnl < 0 ? "" : ""}$</span>
                    <span className="sm:hidden">{dayStats.pnl > 0 ? "+" : ""}</span>
                    {Math.abs(dayStats.pnl).toLocaleString()}
                  </span>
                  <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {dayStats.tradeCount} trade{dayStats.tradeCount > 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className={cn(
                      "text-[10px] font-medium",
                      dayStats.winPercent >= 60 ? "text-emerald-400" :
                      dayStats.winPercent >= 40 ? "text-amber-400" :
                      "text-red-400"
                    )}>
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
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/50">
          <div className="flex items-start justify-between mb-4 sm:mb-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold">
                {new Date(selectedDate).toLocaleDateString("en-US", { 
                  weekday: "short",
                  month: "short", 
                  day: "numeric",
                  year: "numeric"
                })}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm text-muted-foreground">PnL:</span>
                  <span className={cn(
                    "text-xs sm:text-sm font-mono font-bold",
                    selectedDayStats.pnl > 0 ? "text-emerald-500" : selectedDayStats.pnl < 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {selectedDayStats.pnl > 0 ? "+" : ""}${selectedDayStats.pnl.toLocaleString()}
                  </span>
                </div>
                <span className="hidden sm:inline text-muted-foreground/30">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm text-muted-foreground">Trades:</span>
                  <span className="text-xs sm:text-sm font-semibold">{selectedDayStats.tradeCount}</span>
                </div>
                <span className="hidden sm:inline text-muted-foreground/30">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm text-muted-foreground">Win:</span>
                  <span className={cn(
                    "text-xs sm:text-sm font-semibold",
                    selectedDayStats.winPercent >= 60 ? "text-emerald-500" :
                    selectedDayStats.winPercent >= 40 ? "text-amber-500" :
                    "text-red-500"
                  )}>
                    {selectedDayStats.winPercent}%
                  </span>
                </div>
                {selectedDayStats.pnl >= PA_CONSTANTS.MIN_PROFIT_DAY && (
                  <>
                    <span className="hidden sm:inline text-muted-foreground/30">|</span>
                    <span className="text-xs sm:text-sm font-semibold text-amber-400 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400" /> $250+ Day
                    </span>
                  </>
                )}
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 -mt-1 shrink-0" 
              onClick={() => setSelectedDate(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Trades List */}
          <div className="space-y-2">
            {selectedTrades.map((trade) => (
              <div
                key={trade.id}
                className={cn(
                  "flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border",
                  trade.pnl > 0 ? "bg-emerald-500/5 border-emerald-500/20" : 
                  trade.pnl < 0 ? "bg-red-500/5 border-red-500/20" : 
                  "bg-muted/30 border-border/50"
                )}
              >
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className="font-mono text-sm sm:text-base font-semibold">{trade.symbol}</span>
                  <span className={cn(
                    "hidden sm:flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    trade.pnl > 0 ? "bg-emerald-500/20 text-emerald-500" :
                    trade.pnl < 0 ? "bg-red-500/20 text-red-500" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {trade.pnl > 0 ? (
                      <><TrendingUp className="h-3 w-3" /> Win</>
                    ) : trade.pnl < 0 ? (
                      <><TrendingDown className="h-3 w-3" /> Loss</>
                    ) : (
                      <><Minus className="h-3 w-3" /> Flat</>
                    )}
                  </span>
                </div>
                <span className={cn(
                  "font-mono text-base sm:text-lg font-bold",
                  trade.pnl > 0 ? "text-emerald-500" : trade.pnl < 0 ? "text-red-500" : "text-muted-foreground"
                )}>
                  {trade.pnl > 0 ? "+" : ""}${trade.pnl.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border/50">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-emerald-500/20 border sm:border-2 border-emerald-500/40" />
          <span>Profit</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-red-500/20 border sm:border-2 border-red-500/40" />
          <span>Loss</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-emerald-500/20 border sm:border-2 border-amber-400/60 flex items-center justify-center">
            <Star className="h-1.5 w-1.5 sm:h-2 sm:w-2 text-amber-400 fill-amber-400" />
          </div>
          <span>$250+</span>
        </div>
      </div>
    </Card>
  )
}
