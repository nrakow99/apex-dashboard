"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, DailyPnL } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"

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

function StatusIcon({ status }: { status: "good" | "warning" | "danger" }) {
  if (status === "good")    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />
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
    <div className={cn(
      "p-4 rounded-xl border",
      status === "danger"  ? "bg-red-500/10 border-red-500/30" :
      status === "warning" ? "bg-amber-500/10 border-amber-500/30" :
      "bg-muted/30 border-border/50",
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{title}</span>
        {status && <StatusIcon status={status} />}
      </div>
      {children}
    </div>
  )
}

export function RuleEnginePanel({ account, dailyData, stats, consistencyInfo }: RuleEnginePanelProps) {
  const rules = getAccountRules(account)

  // Daily loss (today only)
  const today = dailyData[dailyData.length - 1]
  const todayPnL = today?.pnl ?? 0
  const dailyLossRemaining = rules.dailyLossLimit + Math.min(0, todayPnL)
  const dailyLossStatus: "good" | "warning" | "danger" =
    todayPnL >= -rules.dailyLossLimit * 0.8 ? "good" :
    todayPnL >= -rules.dailyLossLimit        ? "warning" : "danger"

  // Drawdown / floor
  const drawdownPercent = (stats.drawdownRemaining / account.maxDrawdown) * 100
  const drawdownStatus: "good" | "warning" | "danger" =
    drawdownPercent > 50 ? "good" : drawdownPercent > 20 ? "warning" : "danger"

  const firmLabel = account.firm === "Lucid" ? "Lucid" : account.firm ?? "Apex"

  return (
    <Card className="p-5 bg-card/50 backdrop-blur border-border/50">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Rule Status</h2>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border",
            account.firm === "Lucid"
              ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
              : "bg-orange-500/10 text-orange-400 border-orange-500/30"
          )}>
            {firmLabel}
          </span>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border",
            account.type === "Eval" && "bg-amber-500/10 text-amber-500 border-amber-500/30",
            account.type === "PA"   && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
            account.type === "Live" && "bg-blue-500/10 text-blue-500 border-blue-500/30",
          )}>
            {account.type}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* ── Active Floor ─────────────────────────────────────────────────── */}
        <RuleCard title={rules.floorLabel} status={drawdownStatus}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-mono font-medium">
                ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-muted-foreground">Active Floor</span>
                <div className="text-[10px] text-muted-foreground/60">
                  {account.drawdownType === "Intraday" ? "Updates in real time" : "Updates at 2pm PST"}
                </div>
              </div>
              <span className="font-mono text-red-500">
                ${stats.minBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="pt-2 border-t border-border/50">
              <div className="flex justify-between">
                <span className="font-medium">Remaining</span>
                <span className={cn(
                  "font-mono font-bold",
                  drawdownStatus === "danger"  ? "text-red-500" :
                  drawdownStatus === "warning" ? "text-amber-500" : "text-emerald-500"
                )}>
                  ${Math.max(0, stats.drawdownRemaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress
                value={Math.max(0, drawdownPercent)}
                className={cn(
                  "h-2 mt-2",
                  drawdownStatus === "danger"  && "[&>div]:bg-red-500",
                  drawdownStatus === "warning" && "[&>div]:bg-amber-500",
                  drawdownStatus === "good"    && "[&>div]:bg-emerald-500"
                )}
              />
            </div>
          </div>
        </RuleCard>

        {/* ── Daily Loss Limit (only when applicable) ──────────────────────── */}
        {rules.hasDLL && (
          <RuleCard title="Daily Loss Limit" status={dailyLossStatus}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining Today</span>
                <span className={cn(
                  "font-mono font-bold",
                  dailyLossStatus === "danger"  ? "text-red-500" :
                  dailyLossStatus === "warning" ? "text-amber-500" : "text-emerald-500"
                )}>
                  ${Math.max(0, dailyLossRemaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Loss</span>
                <span className="font-mono text-muted-foreground">
                  ${rules.dailyLossLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </RuleCard>
        )}

        {/* ── Profit Target (Eval only) ─────────────────────────────────────── */}
        {account.type === "Eval" && account.profitTarget && (
          <RuleCard title="Profit Goal">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono font-bold">
                  ${Math.max(0, stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })} / ${account.profitTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress value={Math.min(100, (stats.totalPnL / account.profitTarget) * 100)} className="h-2" />
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-mono">
                  ${Math.max(0, account.profitTarget - stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </RuleCard>
        )}

        {/* ── Max Contracts (when specified) ───────────────────────────────── */}
        {rules.maxContracts && (
          <RuleCard title="Position Limit">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Size</span>
                <span className="font-mono font-medium">{rules.maxContracts}</span>
              </div>
            </div>
          </RuleCard>
        )}

        {/* ── Scaling Plan (Lucid PA) ───────────────────────────────────────── */}
        {rules.hasScaling && (
          <RuleCard title="Scaling Plan">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-emerald-500">Active</span>
              </div>
              {rules.maxContracts && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Max</span>
                  <span className="font-mono">{rules.maxContracts}</span>
                </div>
              )}
            </div>
          </RuleCard>
        )}

        {/* ── Consistency Rule (only when applicable) ──────────────────────── */}
        {rules.hasConsistency && consistencyInfo && (
          <RuleCard
            title={`Consistency Rule (${rules.consistencyPercent}%)`}
            status={consistencyInfo.isValid ? "good" : "warning"}
            className="md:col-span-2 lg:col-span-1"
          >
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Largest Day</span>
                <span className={cn("font-mono", !consistencyInfo.isValid && "text-amber-500")}>
                  ${consistencyInfo.largestWinningDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Profit</span>
                <span className="font-mono">${consistencyInfo.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Allowed ({rules.consistencyPercent}%)</span>
                <span className="font-mono">${consistencyInfo.maxAllowedDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border/50 mt-2">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-medium", consistencyInfo.isValid ? "text-emerald-500" : "text-amber-500")}>
                  {consistencyInfo.isValid ? "Compliant" : "Not compliant"}
                </span>
              </div>
              {!consistencyInfo.isValid && consistencyInfo.additionalProfitNeeded > 0 && (
                <div className="text-xs text-amber-500 pt-1">
                  Need ${consistencyInfo.additionalProfitNeeded.toLocaleString(undefined, { minimumFractionDigits: 2 })} more profit
                </div>
              )}
            </div>
          </RuleCard>
        )}

        {/* ── Apex PA: Trading Days ─────────────────────────────────────────── */}
        {account.firm !== "Lucid" && account.type === "PA" && rules.minTradingDays > 0 && (
          <RuleCard title="Trading Days">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days Traded</span>
                <span className={cn(
                  "font-mono font-bold",
                  stats.tradingDays >= rules.minTradingDays ? "text-emerald-500" : "text-amber-500"
                )}>
                  {stats.tradingDays} / {rules.minTradingDays}
                </span>
              </div>
              <Progress
                value={(stats.tradingDays / rules.minTradingDays) * 100}
                className={cn("h-2", stats.tradingDays >= rules.minTradingDays && "[&>div]:bg-emerald-500")}
              />
            </div>
          </RuleCard>
        )}

        {/* ── Apex PA: Qualifying profit days ──────────────────────────────── */}
        {account.firm !== "Lucid" && account.type === "PA" && consistencyInfo && rules.minProfitDays > 0 && (
          <RuleCard title={`$${rules.minDailyProfit}+ Profit Days`}>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Qualifying Days</span>
                <span className={cn(
                  "font-mono font-bold",
                  consistencyInfo.daysWithMinProfit >= rules.minProfitDays ? "text-emerald-500" : "text-amber-500"
                )}>
                  {consistencyInfo.daysWithMinProfit} / {rules.minProfitDays}
                </span>
              </div>
              <Progress
                value={(consistencyInfo.daysWithMinProfit / rules.minProfitDays) * 100}
                className={cn("h-2", consistencyInfo.daysWithMinProfit >= rules.minProfitDays && "[&>div]:bg-emerald-500")}
              />
            </div>
          </RuleCard>
        )}

        {/* ── Apex PA: Min payout balance ───────────────────────────────────── */}
        {account.firm !== "Lucid" && account.type === "PA" && rules.minBalanceToRequest > 0 && (
          <RuleCard title="Min Payout Balance">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target</span>
                <span className={cn(
                  "font-mono font-bold",
                  stats.currentBalance >= rules.minBalanceToRequest ? "text-emerald-500" : "text-amber-500"
                )}>
                  ${rules.minBalanceToRequest.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-mono">
                  ${Math.max(0, rules.minBalanceToRequest - stats.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress
                value={Math.min(100, (stats.currentBalance / rules.minBalanceToRequest) * 100)}
                className={cn("h-2", stats.currentBalance >= rules.minBalanceToRequest && "[&>div]:bg-emerald-500")}
              />
            </div>
          </RuleCard>
        )}
      </div>
    </Card>
  )
}
