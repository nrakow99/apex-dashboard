"use client"

import { useState, useMemo } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DailyPnL, Account } from "@/lib/types"
import { PA_CONSTANTS } from "@/lib/types"
import {
  getPerformanceChartBalanceSubtitle,
  getChartFloorLineLabel,
} from "@/lib/floor-display-labels"
import { hasIntradayManualDrawdown } from "@/lib/intraday-manual-drawdown"
import { isTradingDayComplete, getTodayDateStr } from "@/lib/storage"
import { parseLocalDate, toLocalDateKey } from "@/lib/date-utils"

interface AccountStats {
  currentBalance: number
  totalPnL: number
  totalPayouts: number
  maxBalance: number
  minBalance: number
  drawdownRemaining: number
  tradingDays: number
  isSafe: boolean
  // EOD-specific fields
  highestCompletedEodBalance?: number
  lastCompletedEodBalance?: number
  activeEodFloor?: number
  projectedEodFloor?: number
  isTradingDayComplete?: boolean
  timeUntilClose?: string
}

interface PerformanceChartProps {
  data: DailyPnL[]
  account: Account
  stats: AccountStats
}

type ChartView = "balance" | "dailyPnl"

interface ChartDataPoint {
  date: string
  fullDate: string
  balance: number
  dailyPnl: number
  minBalance: number // Active EOD floor (only steps up after completed days)
  maxBalanceAtPoint: number
  isStartingPoint?: boolean
  isIncompleteDay?: boolean // Today before 2PM
}

export function PerformanceChart({ data, account, stats }: PerformanceChartProps) {
  const [view, setView] = useState<ChartView>("balance")

  // Build chart data with starting point and proper floor tracking per drawdown type
  const chartData = useMemo(() => {
    const result: ChartDataPoint[] = []
    const todayStr = getTodayDateStr()
    const dayComplete = isTradingDayComplete()
    const isIntraday = account.drawdownType === "Intraday"

    const firstTradeDate = data.length > 0 ? data[0].date : todayStr
    const startDate = parseLocalDate(firstTradeDate)
    startDate.setDate(startDate.getDate() - 1)
    const startDateStr = toLocalDateKey(startDate)

    result.push({
      date: parseLocalDate(startDateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullDate: startDateStr,
      balance: account.startingBalance,
      dailyPnl: 0,
      minBalance: account.startingBalance - account.maxDrawdown,
      maxBalanceAtPoint: account.startingBalance,
      isStartingPoint: true,
      isIncompleteDay: false,
    })

    let highestBalance = account.startingBalance

    for (const d of data) {
      const isComplete = d.date !== todayStr || dayComplete

      if (isIntraday) {
        // Intraday: always update peak (no EOD gate)
        highestBalance = Math.max(highestBalance, d.balance)
      } else {
        // EOD: only completed days raise the floor
        if (isComplete) {
          highestBalance = Math.max(highestBalance, d.balance)
        }
      }

      const activeFloorAtPoint = highestBalance - account.maxDrawdown

      result.push({
        date: parseLocalDate(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: d.date,
        balance: d.balance,
        dailyPnl: d.pnl,
        minBalance: activeFloorAtPoint,
        maxBalanceAtPoint: highestBalance,
        isStartingPoint: false,
        isIncompleteDay: !isComplete,
      })
    }

    if (isIntraday && hasIntradayManualDrawdown(account) && result.length > 1) {
      const manualFloor = stats.activeEodFloor ?? stats.minBalance
      const last = result.length - 1
      result[last] = { ...result[last], minBalance: manualFloor }
    }

    return result
  }, [data, account, stats])

  // Calculate Y-axis domain dynamically
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) {
      return [account.startingBalance - 3000, account.startingBalance + 3000]
    }

    const balances = chartData.map((d) => d.balance)
    const minBalances = chartData.map((d) => d.minBalance)
    
    const minValue = Math.min(...balances, ...minBalances)
    const maxValue = Math.max(...balances)
    
    // Include payout threshold if PA account
    const payoutThreshold = account.type === "PA" ? PA_CONSTANTS.MIN_BALANCE_FOR_PAYOUT : maxValue
    const maxWithThreshold = Math.max(maxValue, payoutThreshold)

    // Add padding
    const range = maxWithThreshold - minValue
    const padding = Math.max(range * 0.15, 500)
    
    return [Math.floor(minValue - padding), Math.ceil(maxWithThreshold + padding)]
  }, [chartData, account])

  // Format value based on view with 2 decimal places
  const formatValue = (value: number, showSign = false) => {
    const formatted = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (showSign && value >= 0) {
      return `+$${formatted}`
    }
    if (value < 0) {
      return `-$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return `$${formatted}`
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (!active || !payload || !payload.length) return null

    const point = payload[0].payload
    const formattedDate = parseLocalDate(point.fullDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })

    if (view === "dailyPnl") {
      const isPositive = point.dailyPnl >= 0
      return (
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-4 shadow-2xl min-w-[180px]">
          <p className="text-[13px] font-medium text-foreground mb-3">{formattedDate}</p>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isPositive ? "bg-emerald-500" : "bg-red-500")} />
            <span className="text-[12px] text-muted-foreground">Daily PnL:</span>
            <span className={cn("font-mono font-semibold text-[13px]", isPositive ? "text-emerald-500" : "text-red-500")}>
              {formatValue(point.dailyPnl, true)}
            </span>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-4 shadow-2xl min-w-[220px]">
        <p className="text-[13px] font-medium text-foreground mb-3">{formattedDate}</p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Balance</span>
            </div>
            <span className="font-mono font-semibold text-[13px] text-foreground">{formatValue(point.balance)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                {getChartFloorLineLabel(account)}
              </span>
            </div>
            <span className="font-mono font-semibold text-[13px] text-red-400">{formatValue(point.minBalance)}</span>
          </div>
          {point.isIncompleteDay && account.drawdownType !== "Intraday" && (
            <div className="text-xs text-amber-500 mt-1">
              * Day not complete — floor uses prior EOD
            </div>
          )}
          {!point.isStartingPoint && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30 mt-2">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", point.dailyPnl >= 0 ? "bg-emerald-400" : "bg-red-400")} />
<span className="text-[11px] text-muted-foreground uppercase tracking-wider">Daily PnL</span>
              </div>
              <span className={cn("font-mono font-semibold text-[13px]", point.dailyPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                {formatValue(point.dailyPnl, true)}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Empty state - uses same flex layout as main chart for consistency
  if (data.length === 0) {
    return (
      <Card className="h-[240px] sm:h-[308px] lg:h-[332px] flex flex-col p-2.5 sm:p-3 rounded-[24px] glass-card">
        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-semibold">Performance</h2>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              {`Balance over time · ${getPerformanceChartBalanceSubtitle(account)}`}
            </p>
          </div>
          <div className="flex gap-1 p-1 bg-[#0F1115]/80 border border-white/[0.07] rounded-xl">
            <Button
              size="sm"
              variant={view === "balance" ? "secondary" : "ghost"}
              onClick={() => setView("balance")}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-3 sm:px-4"
            >
              Balance
            </Button>
            <Button
              size="sm"
              variant={view === "dailyPnl" ? "secondary" : "ghost"}
              onClick={() => setView("dailyPnl")}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-3 sm:px-4"
            >
              Daily PnL
            </Button>
          </div>
        </div>
        
        {/* Chart area - flex-1 to fill remaining space */}
        <div className="flex-1 min-h-0 w-full relative mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={[
                { date: "Start", balance: account.startingBalance, minBalance: account.startingBalance - account.maxDrawdown },
                { date: "Now", balance: account.startingBalance, minBalance: account.startingBalance - account.maxDrawdown },
              ]}
              margin={{ top: 6, right: 12, left: 2, bottom: 0 }}
            >
              <defs>
                <linearGradient id="emptyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6b7280" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#6b7280" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252b34" strokeOpacity={0.55} vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                domain={[account.startingBalance - 3000, account.startingBalance + 3000]}
                width={60}
              />
              <ReferenceLine
                y={account.startingBalance - account.maxDrawdown}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeWidth={2}
                strokeOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#6b7280"
                strokeWidth={2}
                fill="url(#emptyGradient)"
                dot={{ r: 4, fill: "#6b7280", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {/* Centered message overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#111318]/92 backdrop-blur-xl border border-white/[0.07] rounded-2xl px-6 py-4 text-center max-w-sm">
              <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No trades yet. Add your first trade to track performance.
              </p>
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 bg-muted-foreground rounded" />
            <span>Account Balance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 border-t-2 border-dashed border-red-500/50" />
            <span>{getChartFloorLineLabel(account)}</span>
          </div>
        </div>
      </Card>
    )
  }

  return (
      <Card className="h-[240px] sm:h-[308px] lg:h-[332px] flex flex-col p-2.5 sm:p-3 rounded-[24px] glass-card">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-semibold">Performance</h2>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            {view === "balance"
              ? `Balance over time · ${getPerformanceChartBalanceSubtitle(account)}`
              : "Daily profit and loss"}
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-[#0F1115]/80 border border-white/[0.07] rounded-xl">
          <Button
            size="sm"
            variant={view === "balance" ? "secondary" : "ghost"}
            onClick={() => setView("balance")}
            className="text-[11px] sm:text-xs h-7 sm:h-8 px-3 sm:px-4"
          >
            Balance
          </Button>
          <Button
            size="sm"
            variant={view === "dailyPnl" ? "secondary" : "ghost"}
            onClick={() => setView("dailyPnl")}
            className="text-[11px] sm:text-xs h-7 sm:h-8 px-3 sm:px-4"
          >
            Daily PnL
          </Button>
        </div>
      </div>
      
      {/* Chart area - flex-1 fills remaining space */}
      <div className="flex-1 min-h-0 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {view === "balance" ? (
            <AreaChart data={chartData} margin={{ top: 6, right: 12, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.18} />
                  <stop offset="45%" stopColor="#10b981" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.07} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                {/* Glow filter for active point */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252b34" strokeOpacity={0.55} vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                dy={10}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                dx={-5}
                domain={yAxisDomain}
                width={60}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "#6b7280",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.45,
                }}
              />
              {/* Starting balance reference line */}
              <ReferenceLine
                y={account.startingBalance}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1}
                strokeOpacity={0.38}
              />
              {/* Payout threshold for PA accounts */}
              {account.type === "PA" && (
                <ReferenceLine
                  y={PA_CONSTANTS.MIN_BALANCE_FOR_PAYOUT}
                  stroke="#ca8a04"
                  strokeDasharray="6 4"
                  strokeWidth={1.25}
                  strokeOpacity={0.52}
                  label={{
                    value: "Payout Threshold",
                    position: "right",
                    fill: "#eab308",
                    fontSize: 10,
                    opacity: 0.72,
                  }}
                />
              )}
              {/* Active floor line — steps for EOD, trails smoothly for Intraday */}
              <Area
                type={account.drawdownType === "Intraday" ? "monotone" : "stepAfter"}
                dataKey="minBalance"
                stroke="#f87171"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.88}
                fill="none"
                dot={false}
                activeDot={false}
              />
              {/* Balance line with gradient fill */}
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#34d399"
                strokeWidth={2.5}
                fill="url(#balanceGradient)"
                dot={(props) => {
                  const { cx, cy, payload } = props
                  if (!cx || !cy) return null
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={payload.isStartingPoint ? 4 : 6}
                      fill={payload.isStartingPoint ? "#94a3b8" : "#34d399"}
                      stroke={payload.isStartingPoint ? "#475569" : "#047857"}
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{
                  r: 9,
                  fill: "#34d399",
                  stroke: "#065f46",
                  strokeWidth: 3,
                  filter: "url(#glow)",
                }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={chartData.filter((d) => !d.isStartingPoint)} margin={{ top: 6, right: 12, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252b34" strokeOpacity={0.55} vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                dy={10}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
                dx={-5}
                width={60}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "#6b7280",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.45,
                }}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.25} strokeOpacity={0.45} />
              <Area
                type="monotone"
                dataKey="dailyPnl"
                stroke="#34d399"
                strokeWidth={2.5}
                fill="url(#pnlGradientPos)"
                dot={(props) => {
                  const { cx, cy, payload } = props
                  if (!cx || !cy) return null
                  const isPositive = payload.dailyPnl >= 0
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill={isPositive ? "#34d399" : "#f87171"}
                      stroke={isPositive ? "#047857" : "#991b1b"}
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{
                  r: 9,
                  strokeWidth: 3,
                  filter: "url(#glow)",
                }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      {view === "balance" ? (
        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 pt-1.5 sm:pt-2 text-[10px] sm:text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 sm:w-5 h-0.5 bg-emerald-500 rounded" />
            <span>Balance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 sm:w-5 h-0.5 border-t-2 border-dashed border-red-500" />
            <span>{getChartFloorLineLabel(account)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-4 sm:w-5 h-0.5 border-t border-dashed border-muted-foreground/50" />
            <span>Start</span>
          </div>
          {account.type === "PA" && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 sm:w-5 h-0.5 border-t-2 border-dashed border-yellow-500" />
              <span>Payout Threshold</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 pt-1.5 sm:pt-2 text-[10px] sm:text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500" />
            <span>Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
            <span>Loss</span>
          </div>
        </div>
      )}
    </Card>
  )
}
