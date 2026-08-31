import type { DailyPnL } from "@/lib/types"

export interface CalendarDayCell {
  day: number | null
  dateKey: string | null
}

export interface CalendarWeek {
  days: CalendarDayCell[]
  pnl: number | null
  tradeCount: number
  activeDays: number
  firstDateKey: string | null
  lastDateKey: string | null
}

function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Builds Sunday-to-Saturday rows for a calendar month. Weekly totals only use
 * saved trading days in the displayed month; a row with no recorded trades is
 * deliberately returned as unavailable instead of a confident $0 result.
 */
export function buildTradingCalendarWeeks(
  year: number,
  monthIndex: number,
  dailyData: DailyPnL[],
): CalendarWeek[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const dailyByDate = new Map(dailyData.map((day) => [day.date, day]))

  const cells = Array.from({ length: cellCount }, (_, index): CalendarDayCell => {
    const day = index - firstDay + 1
    if (day < 1 || day > daysInMonth) return { day: null, dateKey: null }
    return { day, dateKey: dateKey(year, monthIndex, day) }
  })

  return Array.from({ length: cellCount / 7 }, (_, weekIndex) => {
    const days = cells.slice(weekIndex * 7, weekIndex * 7 + 7)
    const recordedDays = days
      .map((day) => day.dateKey ? dailyByDate.get(day.dateKey) : undefined)
      .filter((day): day is DailyPnL => day != null && day.tradesCount > 0)
    const visibleDates = days.flatMap((day) => day.dateKey ? [day.dateKey] : [])

    return {
      days,
      pnl: recordedDays.length > 0
        ? recordedDays.reduce((total, day) => total + day.pnl, 0)
        : null,
      tradeCount: recordedDays.reduce((total, day) => total + day.tradesCount, 0),
      activeDays: recordedDays.length,
      firstDateKey: visibleDates[0] ?? null,
      lastDateKey: visibleDates.at(-1) ?? null,
    }
  })
}
