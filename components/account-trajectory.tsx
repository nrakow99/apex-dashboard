"use client"

import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import { getRuleStartingBalance } from "@/lib/account-quantity"
import { parseLocalDate, toLocalDateKey } from "@/lib/date-utils"
import { getChartFloorLineLabel, getPerformanceChartBalanceSubtitle } from "@/lib/floor-display-labels"
import { hasIntradayManualDrawdown } from "@/lib/intraday-manual-drawdown"
import { getAccountRules } from "@/lib/rules"
import { getTodayDateStr, isTradingDayComplete } from "@/lib/storage"
import { lucidFlexActiveFloor } from "@/lib/lucid-flex-floor"
import { formatCurrency, formatPnL, pnlColorClass } from "@/lib/utils"
import type { Account, DailyPnL } from "@/lib/types"

interface AccountTrajectoryProps {
  account: Account
  data: DailyPnL[]
  stats: {
    currentBalance: number
    totalPnL: number
    minBalance: number
    activeEodFloor?: number
  }
}

interface Point {
  date: string
  fullDate: string
  balance: number
  floor: number
  dailyPnl: number
  payoutAmount: number
}

function money(value: number) {
  return formatCurrency(value)
}

export function AccountTrajectory({ account, data, stats }: AccountTrajectoryProps) {
  const rules = getAccountRules(account)
  const startingBalance = getRuleStartingBalance(account)
  const today = getTodayDateStr()

  const chartData = useMemo<Point[]>(() => {
    const completeToday = isTradingDayComplete()
    const firstDate = data[0]?.date ?? today
    const start = parseLocalDate(firstDate)
    start.setDate(start.getDate() - 1)

    const points: Point[] = [{
      date: "Start",
      fullDate: toLocalDateKey(start),
      balance: startingBalance,
      floor: startingBalance - rules.maxDrawdown,
      dailyPnl: 0,
      payoutAmount: 0,
    }]
    let peak = startingBalance
    let payoutRecorded = false

    for (const day of data) {
      const completed = account.drawdownType === "Intraday" || day.date !== today || completeToday
      if (completed) peak = Math.max(peak, day.balance)
      payoutRecorded ||= (day.payoutAmount ?? 0) > 0

      let floor = peak - rules.maxDrawdown
      if (rules.lucidFlexFloor && account.type === "PA") {
        floor = lucidFlexActiveFloor(peak, rules.maxDrawdown, rules.lucidFlexFloor)
      }
      if (rules.floorLocksOnPayout && rules.lucidFlexFloor && payoutRecorded) {
        floor = rules.lucidFlexFloor.lockedFloor
      }

      points.push({
        date: parseLocalDate(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: day.date,
        balance: day.balance,
        floor,
        dailyPnl: day.pnl,
        payoutAmount: day.payoutAmount ?? 0,
      })
    }

    if (account.drawdownType === "Intraday" && hasIntradayManualDrawdown(account) && points.length > 1) {
      points[points.length - 1] = {
        ...points[points.length - 1],
        floor: stats.activeEodFloor ?? stats.minBalance,
      }
    }

    return points
  }, [account, data, rules, startingBalance, stats.activeEodFloor, stats.minBalance, today])

  const domain = useMemo<[number, number]>(() => {
    const values = chartData.flatMap((point) => [point.balance, point.floor])
    const low = Math.min(...values)
    const high = Math.max(...values)
    const padding = Math.max((high - low) * 0.16, 250)
    return [Math.floor(low - padding), Math.ceil(high + padding)]
  }, [chartData])

  return (
    <Card className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.17em] text-[var(--muted)]">Account trajectory</p>
          <h2 className="mt-1 text-xl font-medium tracking-[-0.025em]">Balance and active floor</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{getPerformanceChartBalanceSubtitle(account)}</p>
        </div>
        <div className="flex gap-6">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Balance</p>
            <p className="mt-1 font-mono text-sm font-medium">{money(stats.currentBalance)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Net P&L</p>
            <p className={`mt-1 font-mono text-sm font-medium ${pnlColorClass(stats.totalPnL)}`}>{formatPnL(stats.totalPnL)}</p>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center border-y border-[var(--hairline)] px-6 text-center sm:h-[300px]">
          <div className="max-w-sm">
            <p className="text-sm font-medium text-[var(--text)]">No account activity yet</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              The balance and active floor trajectory will begin with the first logged trade or payout.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="h-[250px] w-full sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 8, bottom: 2, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--hairline)" strokeDasharray="2 5" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={34} tick={{ fill: "var(--muted)", fontSize: 10 }} dy={8} />
                <YAxis domain={domain} axisLine={false} tickLine={false} width={58} tick={{ fill: "var(--muted)", fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
                <Tooltip content={<TrajectoryTooltip floorLabel={getChartFloorLineLabel(account)} />} cursor={{ stroke: "var(--faint)", strokeDasharray: "3 4" }} />
                <Line type="monotone" dataKey="balance" stroke="var(--text)" strokeWidth={2.25} dot={false} activeDot={{ r: 3, fill: "var(--text)", stroke: "var(--ground)", strokeWidth: 1 }} />
                <Line type="stepAfter" dataKey="floor" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-[var(--hairline)] pt-4 text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-2"><i className="h-px w-5 bg-white" />Balance</span>
            <span className="inline-flex items-center gap-2"><i className="w-5 border-t border-dashed border-[var(--muted)]" />{getChartFloorLineLabel(account)}</span>
          </div>
        </>
      )}
    </Card>
  )
}

function TrajectoryTooltip({ active, payload, floorLabel }: {
  active?: boolean
  payload?: Array<{ payload: Point }>
  floorLabel: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="min-w-[190px] rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] p-3">
      <p className="text-xs font-medium">{parseLocalDate(point.fullDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
      <dl className="mt-3 space-y-2 text-[11px]">
        <div className="flex justify-between gap-5"><dt className="text-[var(--muted)]">Balance</dt><dd className="font-mono">{money(point.balance)}</dd></div>
        <div className="flex justify-between gap-5"><dt className="text-[var(--muted)]">{floorLabel}</dt><dd className="font-mono">{money(point.floor)}</dd></div>
        <div className="flex justify-between gap-5 border-t border-[var(--hairline)] pt-2"><dt className="text-[var(--muted)]">Daily P&L</dt><dd className={`font-mono ${pnlColorClass(point.dailyPnl)}`}>{formatPnL(point.dailyPnl)}</dd></div>
        {point.payoutAmount > 0 && (
          <div className="flex justify-between gap-5"><dt className="text-[var(--muted)]">Payout</dt><dd className="font-mono">−{money(point.payoutAmount)}</dd></div>
        )}
      </dl>
    </div>
  )
}
