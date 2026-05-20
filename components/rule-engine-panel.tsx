"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, DailyPnL } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import {
  getRuleEngineFloorCardTitle,
  getRuleEngineFloorRowHint,
  getRuleEngineFloorRowLabel,
} from "@/lib/floor-display-labels"
import { getApexPaScalingTier } from "@/lib/apex-pa-scaling"
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
  /** LucidFlex PA: qualifying days in current payout cycle (matches payout eligibility) */
  lucidCycleQualifyingDays?: number
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
      "p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all",
      status === "danger"  ? "bg-red-500/10 border-red-500/30" :
      status === "warning" ? "bg-amber-500/10 border-amber-500/30" :
      "bg-slate-900/45 border-white/10",
      className
    )}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-sm font-semibold">{title}</span>
        {status && <StatusIcon status={status} />}
      </div>
      {children}
    </div>
  )
}

function countVisibleRuleCards(
  account: Account,
  rules: ReturnType<typeof getAccountRules>,
  consistencyInfo: ConsistencyInfo | null,
): number {
  let n = 1
  if (rules.hasDLL) n++
  if (account.type === "Eval" && account.profitTarget) n++
  if (rules.maxContracts) n++
  if (rules.hasScaling) n++
  if (rules.hasConsistency && consistencyInfo) n++
  if (account.firm !== "Lucid" && account.type === "PA" && rules.minTradingDays > 0) n++
  if (account.firm !== "Lucid" && account.type === "PA" && consistencyInfo && rules.minProfitDays > 0) n++
  if (account.firm !== "Lucid" && account.type === "PA" && rules.minBalanceToRequest > 0) n++
  if (account.firm === "Lucid" && account.type === "PA" && consistencyInfo && rules.minProfitDays > 0) n++
  return n
}

export function RuleEnginePanel({
  account,
  dailyData,
  stats,
  consistencyInfo,
  lucidCycleQualifyingDays,
}: RuleEnginePanelProps) {
  const rules = getAccountRules(account)
  const lucidQualifyingDaysInCycle =
    account.firm === "Lucid" && account.type === "PA" && lucidCycleQualifyingDays != null
      ? lucidCycleQualifyingDays
      : (consistencyInfo?.daysWithMinProfit ?? 0)

  const apexPaScaling = useMemo(
    () => getApexPaScalingTier(account, stats),
    [account, stats],
  )

  const ruleGridClass = useMemo(() => {
    const r = getAccountRules(account)
    const count = countVisibleRuleCards(account, r, consistencyInfo)
    if (count <= 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-1 sm:grid-cols-2"
    if (count === 3) return "grid-cols-1 md:grid-cols-3"
    if (count === 4) return "grid-cols-1 sm:grid-cols-2"
    return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
  }, [account, consistencyInfo])

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
    <Card className="p-2.5 sm:p-5 rounded-[22px] sm:rounded-[26px] glass-card">
      <div className="flex items-center justify-between mb-2 sm:mb-5">
        <h2 className="text-base sm:text-lg font-semibold">Rule Status</h2>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border",
            account.firm === "Lucid"
              ? "bg-[#536878]/[0.12] text-[#A0B4BF] border-[#536878]/30"
              : "bg-orange-500/10 text-orange-400 border-orange-500/30"
          )}>
            {firmLabel}
          </span>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border",
            account.type === "Eval" && "bg-amber-500/10 text-amber-500 border-amber-500/30",
            account.type === "PA"   && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
            account.type === "Live" && "bg-[#536878]/10 text-[#94AAB8] border-[#536878]/25",
          )}>
            {account.type}
          </span>
        </div>
      </div>

      <div className={cn("grid gap-2 sm:gap-4", ruleGridClass)}>

        {/* ── Active Floor ─────────────────────────────────────────────────── */}
        <RuleCard title={getRuleEngineFloorCardTitle(account)} status={drawdownStatus}>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-mono font-medium">
                ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-muted-foreground">{getRuleEngineFloorRowLabel(account)}</span>
                <div className="text-[10px] text-muted-foreground/60">
                  {getRuleEngineFloorRowHint(account)}
                </div>
              </div>
              <span className="font-mono text-red-500">
                ${stats.minBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="pt-1.5 border-t border-border/50">
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
                  "h-1.5 mt-1.5",
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
            <div className="space-y-1.5 text-sm">
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
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono font-bold">
                  ${Math.max(0, stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })} / ${account.profitTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress value={Math.min(100, (stats.totalPnL / account.profitTarget) * 100)} className="h-1.5" />
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-mono">
                  ${Math.max(0, account.profitTarget - stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </RuleCard>
        )}

        {/* ── Position Limit / Apex PA scaling ───────────────────────────── */}
        {account.firm === "Apex" && account.type === "PA" && apexPaScaling ? (
          <RuleCard title="Position Limit">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Current Tier</span>
                <span className="font-mono font-semibold text-[#E5E4E2]">Level {apexPaScaling.level}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Max Contracts</span>
                <span className="font-mono font-medium">
                  {apexPaScaling.maxContracts} {apexPaScaling.maxContracts === 1 ? "contract" : "contracts"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Daily Loss Limit</span>
                <span className="font-mono font-medium">
                  ${apexPaScaling.dailyLossLimit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-t border-border/40 pt-2">
                <span className="text-muted-foreground">Current Profit</span>
                <span className="font-mono font-medium text-emerald-400/95">
                  ${apexPaScaling.currentProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {apexPaScaling.isMaxTier ? (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tier status</span>
                    <span className="font-medium text-emerald-500/95">Max Tier Reached</span>
                  </div>
                  <Progress value={100} className="h-1 [&>div]:bg-emerald-500/80" />
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Next tier</span>
                    <span className="text-right font-mono text-slate-200">
                      Level {apexPaScaling.nextLevel}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        $
                        {(apexPaScaling.amountToNextTier ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        to go
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={apexPaScaling.progressToNextTierPercent}
                    className="h-1 [&>div]:bg-gradient-to-r from-[#536878]/90 to-emerald-500/90"
                  />
                </div>
              )}
            </div>
          </RuleCard>
        ) : (
          rules.maxContracts && (
            <RuleCard title="Position Limit">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Size</span>
                  <span className="font-mono font-medium">{rules.maxContracts}</span>
                </div>
              </div>
            </RuleCard>
          )
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
          >
            <div className="space-y-1 text-sm">
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
              <div className="flex justify-between pt-1.5 border-t border-border/50 mt-1.5">
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
            <div className="space-y-1.5">
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
                className={cn("h-1.5", stats.tradingDays >= rules.minTradingDays && "[&>div]:bg-emerald-500")}
              />
            </div>
          </RuleCard>
        )}

        {/* ── Apex PA: Qualifying profit days ──────────────────────────────── */}
        {account.firm !== "Lucid" && account.type === "PA" && consistencyInfo && rules.minProfitDays > 0 && (
          <RuleCard title={`$${rules.minDailyProfit}+ Profit Days`}>
            <div className="space-y-1.5">
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
                className={cn("h-1.5", consistencyInfo.daysWithMinProfit >= rules.minProfitDays && "[&>div]:bg-emerald-500")}
              />
            </div>
          </RuleCard>
        )}

        {/* ── LucidFlex PA: qualifying payout days (cycle) — no Apex consistency gate ─ */}
        {account.firm === "Lucid" && account.type === "PA" && consistencyInfo && rules.minProfitDays > 0 && (
          <RuleCard title={`LucidFlex · $${rules.minDailyProfit}+ days`}>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground leading-snug">
                Five payout-qualifying days per cycle (positive cycle profit required for payout eligibility).
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Qualifying days (this cycle)</span>
                <span className={cn(
                  "font-mono font-bold",
                  lucidQualifyingDaysInCycle >= rules.minProfitDays ? "text-emerald-500" : "text-amber-500"
                )}>
                  {lucidQualifyingDaysInCycle} / {rules.minProfitDays}
                </span>
              </div>
              <Progress
                value={(lucidQualifyingDaysInCycle / rules.minProfitDays) * 100}
                className={cn("h-1.5", lucidQualifyingDaysInCycle >= rules.minProfitDays && "[&>div]:bg-emerald-500")}
              />
            </div>
          </RuleCard>
        )}

        {/* ── Apex PA: Min payout balance ───────────────────────────────────── */}
        {account.firm !== "Lucid" && account.type === "PA" && rules.minBalanceToRequest > 0 && (
          <RuleCard title="Min Payout Balance">
            <div className="space-y-1.5 text-sm">
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
                className={cn("h-1.5", stats.currentBalance >= rules.minBalanceToRequest && "[&>div]:bg-emerald-500")}
              />
            </div>
          </RuleCard>
        )}
      </div>
    </Card>
  )
}
