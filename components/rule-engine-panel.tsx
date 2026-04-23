"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, DailyPnL } from "@/lib/types"
import { AlertTriangle, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

interface AccountStats {
  currentBalance: number
  totalPnL: number
  totalPayouts: number
  maxBalance: number
  minBalance: number
  drawdownRemaining: number
  tradingDays: number
  isSafe: boolean
}

interface ConsistencyInfo {
  largestWinningDay: number
  totalProfit: number
  maxAllowedDay: number
  isValid: boolean
  maxAllowedProfitToday: number
  additionalProfitNeeded: number
  daysWithMinProfit: number
}

interface RuleEnginePanelProps {
  account: Account
  dailyData: DailyPnL[]
  stats: AccountStats
  consistencyInfo: ConsistencyInfo | null
}

function StatusBadge({ status }: { status: "good" | "warning" | "danger" }) {
  if (status === "good") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  }
  if (status === "warning") {
    return <AlertTriangle className="h-4 w-4 text-amber-500" />
  }
  return <XCircle className="h-4 w-4 text-red-500" />
}

function RuleCard({
  title,
  status,
  children,
  className,
}: {
  title: string
  status?: "good" | "warning" | "danger"
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border",
        status === "danger"
          ? "bg-red-500/10 border-red-500/30"
          : status === "warning"
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-muted/30 border-border/50",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{title}</span>
        {status && <StatusBadge status={status} />}
      </div>
      {children}
    </div>
  )
}

export function RuleEnginePanel({ account, dailyData, stats, consistencyInfo }: RuleEnginePanelProps) {
  // Calculate daily loss for today
  const today = dailyData[dailyData.length - 1]
  const todayPnL = today?.pnl ?? 0
  const dailyLossRemaining = account.dailyLossLimit + Math.min(0, todayPnL)
  const dailyLossStatus =
    todayPnL >= -account.dailyLossLimit * 0.8
      ? "good"
      : todayPnL >= -account.dailyLossLimit
        ? "warning"
        : "danger"

  // Drawdown status
  const drawdownPercent = (stats.drawdownRemaining / account.maxDrawdown) * 100
  const drawdownStatus = drawdownPercent > 50 ? "good" : drawdownPercent > 20 ? "warning" : "danger"

  return (
    <Card className="p-5 bg-card/50 backdrop-blur border-border/50">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Rule Status</h2>
        <span
          className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            account.type === "Eval" && "bg-amber-500/10 text-amber-500 border border-amber-500/30",
            account.type === "PA" && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
            account.type === "Live" && "bg-blue-500/10 text-blue-500 border border-blue-500/30"
          )}
        >
          {account.type}
        </span>
      </div>

      {/* Responsive grid: 2 columns on desktop, 1 on mobile */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* EOD Drawdown - Critical Rule */}
        <RuleCard title="EOD Drawdown" status={drawdownStatus}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-mono font-medium">${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum Balance</span>
              <span className="font-mono text-red-500">${stats.minBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pt-2 border-t border-border/50">
              <div className="flex justify-between">
                <span className="font-medium">Remaining</span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    drawdownStatus === "danger"
                      ? "text-red-500"
                      : drawdownStatus === "warning"
                        ? "text-amber-500"
                        : "text-emerald-500"
                  )}
                >
                  ${Math.max(0, stats.drawdownRemaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress
                value={Math.max(0, drawdownPercent)}
                className={cn(
                  "h-2 mt-2",
                  drawdownStatus === "danger" && "[&>div]:bg-red-500",
                  drawdownStatus === "warning" && "[&>div]:bg-amber-500",
                  drawdownStatus === "good" && "[&>div]:bg-emerald-500"
                )}
              />
            </div>
          </div>
        </RuleCard>

        {/* Daily Loss Limit */}
        <RuleCard title="Daily Loss Limit" status={dailyLossStatus}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Today</span>
              <span
                className={cn(
                  "font-mono font-bold",
                  dailyLossStatus === "danger"
                    ? "text-red-500"
                    : dailyLossStatus === "warning"
                      ? "text-amber-500"
                      : "text-emerald-500"
                )}
              >
                ${Math.max(0, dailyLossRemaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Loss</span>
              <span className="font-mono text-muted-foreground">
                ${account.dailyLossLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </RuleCard>

        {/* Eval-specific: Profit Target */}
        {account.type === "Eval" && account.profitTarget && (
          <RuleCard title="Profit Goal">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono font-bold">
                  ${Math.max(0, stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })} / ${account.profitTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress
                value={Math.min(100, (stats.totalPnL / account.profitTarget) * 100)}
                className="h-2"
              />
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-mono">
                  ${Math.max(0, account.profitTarget - stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </RuleCard>
        )}

        {/* PA-specific rules */}
        {account.type === "PA" && consistencyInfo && (
          <>
            {/* Trading Days */}
            <RuleCard title="Trading Days">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Traded</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      stats.tradingDays >= 5 ? "text-emerald-500" : "text-amber-500"
                    )}
                  >
                    {stats.tradingDays} / 5
                  </span>
                </div>
                <Progress
                  value={(stats.tradingDays / 5) * 100}
                  className={cn("h-2", stats.tradingDays >= 5 && "[&>div]:bg-emerald-500")}
                />
              </div>
            </RuleCard>

            {/* Days with $250+ Profit */}
            <RuleCard title="$250+ Profit Days">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Qualifying Days</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      consistencyInfo.daysWithMinProfit >= 5 ? "text-emerald-500" : "text-amber-500"
                    )}
                  >
                    {consistencyInfo.daysWithMinProfit} / 5
                  </span>
                </div>
                <Progress
                  value={(consistencyInfo.daysWithMinProfit / 5) * 100}
                  className={cn("h-2", consistencyInfo.daysWithMinProfit >= 5 && "[&>div]:bg-emerald-500")}
                />
              </div>
            </RuleCard>

            {/* Minimum Payout Balance */}
            <RuleCard title="Min Payout Balance">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      stats.currentBalance >= 52600 ? "text-emerald-500" : "text-amber-500"
                    )}
                  >
                    $52,600.00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-mono">
                    ${Math.max(0, 52600 - stats.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (stats.currentBalance / 52600) * 100)}
                  className={cn("h-2", stats.currentBalance >= 52600 && "[&>div]:bg-emerald-500")}
                />
              </div>
            </RuleCard>

            {/* Consistency Rule (50%) */}
            <RuleCard
              title="Consistency Rule (50%)"
              status={consistencyInfo.isValid ? "good" : "warning"}
              className="md:col-span-2 lg:col-span-1"
            >
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Largest Day</span>
                  <span
                    className={cn("font-mono", !consistencyInfo.isValid ? "text-amber-500" : "text-foreground")}
                  >
                    ${consistencyInfo.largestWinningDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Profit</span>
                  <span className="font-mono">${consistencyInfo.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Allowed (50%)</span>
                  <span className="font-mono">${consistencyInfo.maxAllowedDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border/50 mt-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn("font-medium", consistencyInfo.isValid ? "text-emerald-500" : "text-amber-500")}>
                    {consistencyInfo.isValid ? "Compliant" : "Not compliant"}
                  </span>
                </div>
                {!consistencyInfo.isValid && consistencyInfo.additionalProfitNeeded > 0 && (
                  <div className="text-xs text-amber-500 pt-2">
                    Need ${consistencyInfo.additionalProfitNeeded.toLocaleString(undefined, { minimumFractionDigits: 2 })} more profit
                  </div>
                )}
              </div>
            </RuleCard>
          </>
        )}
      </div>
    </Card>
  )
}
