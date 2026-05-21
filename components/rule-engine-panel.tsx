"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, DailyPnL } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { isApexPaConsistency, isLucidEvalConsistency, isTradeifyEvalConsistency } from "@/lib/storage"
import { getTradeifyScalingTier } from "@/lib/tradeify-scaling"
import { resolveTradeifyProgram } from "@/lib/rules"
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
  tradeifyProgram: ReturnType<typeof resolveTradeifyProgram>,
  hasApexPaScaling: boolean,
  hasTradeifyScaling: boolean,
): number {
  const effectiveProfitTarget =
    account.profitTarget ?? (rules.hasProfitTarget ? rules.profitTarget : null)

  let n = 1 // drawdown / floor
  if (rules.hasDLL) n++
  if (account.type === "Eval" && rules.hasProfitTarget && effectiveProfitTarget) n++
  if (account.firm === "Apex" && account.type === "PA" && hasApexPaScaling) n++
  else if (account.firm === "Tradeify" && account.type === "PA" && hasTradeifyScaling) n++
  else if (rules.maxContracts) n++
  if (rules.hasConsistency && consistencyInfo && account.type === "Eval") n++
  if (account.firm === "Tradeify" && account.type === "Eval" && rules.minTradingDays > 0) n++
  if (account.firm === "Apex" && account.type === "PA" && consistencyInfo && rules.minProfitDays > 0) n++
  if (account.firm === "Tradeify" && tradeifyProgram === "select_flex" && account.type === "PA" && rules.minProfitDays > 0) n++
  if (account.firm === "Lucid" && account.type === "PA" && rules.minProfitDays > 0) n++
  if (account.firm === "Apex" && account.type === "PA" && rules.minBalanceToRequest > 0) n++
  return n
}

function ruleStatusSubtitle(account: Account, rules: ReturnType<typeof getAccountRules>): string {
  if (account.type === "Eval") {
    return "Pass requirements — profit target, drawdown, and position limits"
  }
  if (account.type === "PA" && rules.hasPayouts) {
    if (account.firm === "Apex") return "Risk limits and payout-day progress (payout rules in Payout Status)"
    if (account.firm === "Lucid") return "Drawdown and payout-cycle day progress"
    if (account.firm === "Tradeify") return "Drawdown, scaling, and cycle progress"
  }
  return "Drawdown and position limits"
}

export function RuleEnginePanel({
  account,
  dailyData,
  stats,
  consistencyInfo,
  lucidCycleQualifyingDays,
}: RuleEnginePanelProps) {
  const rules = getAccountRules(account)
  const effectiveProfitTarget =
    account.profitTarget ?? (rules.hasProfitTarget ? rules.profitTarget : null)
  const lucidQualifyingDaysInCycle =
    (account.firm === "Lucid" || account.firm === "Tradeify") &&
    account.type === "PA" &&
    lucidCycleQualifyingDays != null
      ? lucidCycleQualifyingDays
      : (consistencyInfo?.daysWithMinProfit ?? 0)

  const tradeifyScaling = useMemo(
    () => getTradeifyScalingTier(account, stats.currentBalance),
    [account, stats.currentBalance],
  )

  const apexPaScaling = useMemo(
    () => getApexPaScalingTier(account, stats),
    [account, stats],
  )

  const tradeifyProgram = resolveTradeifyProgram(account)

  const ruleGridClass = useMemo(() => {
    const r = getAccountRules(account)
    const count = countVisibleRuleCards(
      account,
      r,
      consistencyInfo,
      tradeifyProgram,
      !!(account.firm === "Apex" && account.type === "PA" && apexPaScaling),
      !!(account.firm === "Tradeify" && account.type === "PA" && tradeifyScaling),
    )
    if (count <= 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-1 sm:grid-cols-2"
    if (count === 3) return "grid-cols-1 md:grid-cols-3"
    if (count === 4) return "grid-cols-1 sm:grid-cols-2"
    return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
  }, [account, consistencyInfo, tradeifyProgram, apexPaScaling, tradeifyScaling])

  // Daily loss (today only); EOD PA uses tier DLL from scaling when available
  const today = dailyData[dailyData.length - 1]
  const todayPnL = today?.pnl ?? 0
  const effectiveDll =
    account.firm === "Apex" && account.type === "PA" && apexPaScaling
      ? apexPaScaling.dailyLossLimit
      : rules.dailyLossLimit
  const dailyLossRemaining = effectiveDll + Math.min(0, todayPnL)
  const dailyLossStatus: "good" | "warning" | "danger" =
    !rules.hasDLL
      ? "good"
      : todayPnL >= -effectiveDll * 0.8
        ? "good"
        : todayPnL >= -effectiveDll
          ? "warning"
          : "danger"

  // Drawdown / floor
  const drawdownPercent = (stats.drawdownRemaining / account.maxDrawdown) * 100
  const drawdownStatus: "good" | "warning" | "danger" =
    drawdownPercent > 50 ? "good" : drawdownPercent > 20 ? "warning" : "danger"

  const firmLabel = account.firm ?? "Apex"

  return (
    <Card className="p-2.5 sm:p-5 rounded-[22px] sm:rounded-[26px] glass-card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2 sm:mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Rule Status</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">{ruleStatusSubtitle(account, rules)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border",
            account.firm === "Lucid" && "bg-[#536878]/[0.12] text-[#A0B4BF] border-[#536878]/30",
            account.firm === "Tradeify" && "bg-violet-500/10 text-violet-300 border-violet-500/30",
            account.firm === "Apex" && "bg-orange-500/10 text-orange-400 border-orange-500/30",
            !account.firm && "bg-orange-500/10 text-orange-400 border-orange-500/30"
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
            {account.firm === "Apex" && account.type === "PA" && account.drawdownType === "EOD" && (
              <p className="text-[10px] text-muted-foreground/70 pt-1 border-t border-border/40">
                Inactivity rules may apply per Apex policy after extended non-trading periods.
              </p>
            )}
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
                  ${effectiveDll.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {apexPaScaling && account.drawdownType === "EOD" && (
                    <span className="text-[10px] text-muted-foreground/70 ml-1">· Tier {apexPaScaling.level}</span>
                  )}
                </span>
              </div>
            </div>
          </RuleCard>
        )}

        {/* ── Profit Target (Eval only) ─────────────────────────────────────── */}
        {account.type === "Eval" && rules.hasProfitTarget && effectiveProfitTarget && (
          <RuleCard title="Profit Goal">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono font-bold">
                  ${Math.max(0, stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })} / ${effectiveProfitTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress value={Math.min(100, (stats.totalPnL / effectiveProfitTarget) * 100)} className="h-1.5" />
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-mono">
                  ${Math.max(0, effectiveProfitTarget - stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </RuleCard>
        )}

        {/* ── Position Limit / Apex PA scaling ───────────────────────────── */}
        {account.firm === "Apex" && account.type === "PA" && apexPaScaling ? (
          <RuleCard title={account.drawdownType === "EOD" ? "Position Scaling" : "Position Limit"}>
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
              {account.drawdownType === "EOD" && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tier Daily Loss Limit</span>
                  <span className="font-mono font-medium">
                    ${apexPaScaling.dailyLossLimit.toLocaleString()}
                  </span>
                </div>
              )}
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
        ) : account.firm === "Tradeify" && account.type === "PA" && tradeifyScaling ? (
          <RuleCard title="Position Scaling">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Tier</span>
                <span className="font-mono font-medium">{tradeifyScaling.currentContracts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Profit</span>
                <span className="font-mono text-emerald-400/95">
                  ${tradeifyScaling.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {tradeifyScaling.nextTier ? (
                <div className="text-xs text-muted-foreground pt-1 border-t border-border/40">
                  Next: {tradeifyScaling.nextTier.contracts} at +$
                  {tradeifyScaling.nextTier.minProfit.toLocaleString()} (
                  ${tradeifyScaling.profitToNext.toLocaleString()} to go)
                </div>
              ) : (
                <div className="text-xs text-emerald-500/90 pt-1">Max tier reached</div>
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

        {/* ── Consistency Rule (only when applicable) ──────────────────────── */}
        {rules.hasConsistency && consistencyInfo && account.type === "Eval" && (
          <RuleCard
            title={`Consistency Rule (${rules.consistencyPercent}%)`}
            status={consistencyInfo.isValid ? "good" : (isApexPaConsistency(account) || isLucidEvalConsistency(account) || isTradeifyEvalConsistency(account)) ? "danger" : "warning"}
          >
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Largest Day</span>
                <span className={cn("font-mono", !consistencyInfo.isValid && "text-red-400")}>
                  ${consistencyInfo.largestWinningDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {isLucidEvalConsistency(account)
                    ? "Account Profit"
                    : isTradeifyEvalConsistency(account)
                      ? "Total Net Profit"
                      : "Total Profit"}
                </span>
                <span className="font-mono">${consistencyInfo.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Allowed ({rules.consistencyPercent}%)</span>
                <span className="font-mono">${consistencyInfo.maxAllowedDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border/50 mt-1.5">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-medium", consistencyInfo.isValid ? "text-emerald-500" : "text-red-400")}>
                  {consistencyInfo.isValid ? "Passed" : "Failed"}
                </span>
              </div>
              {!consistencyInfo.isValid && consistencyInfo.additionalProfitNeeded > 0 && (
                <div className={cn("text-xs pt-1", (isApexPaConsistency(account) || isLucidEvalConsistency(account)) ? "text-red-400/90" : "text-amber-500")}>
                  Need ${consistencyInfo.additionalProfitNeeded.toLocaleString(undefined, { minimumFractionDigits: 2 })} more profit to restore compliance
                </div>
              )}
              {!consistencyInfo.isValid && consistencyInfo.totalProfit <= 0 && isApexPaConsistency(account) && (
                <div className="text-xs text-red-400/90 pt-1">
                  No net profits since last payout
                </div>
              )}
              {!consistencyInfo.isValid && consistencyInfo.totalProfit <= 0 && isLucidEvalConsistency(account) && (
                <div className="text-xs text-red-400/90 pt-1">
                  Account profit must be positive for consistency
                </div>
              )}
              {!consistencyInfo.isValid && consistencyInfo.totalProfit <= 0 && isTradeifyEvalConsistency(account) && (
                <div className="text-xs text-red-400/90 pt-1">
                  Total net profit must be positive for consistency
                </div>
              )}
            </div>
          </RuleCard>
        )}

        {/* ── Tradeify Select Eval: Trading Days ───────────────────────────── */}
        {account.firm === "Tradeify" && account.type === "Eval" && rules.minTradingDays > 0 && (
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

        {/* ── Apex PA: Trading Days ─────────────────────────────────────────── */}
        {account.firm !== "Lucid" && account.firm !== "Tradeify" && account.type === "PA" && rules.minTradingDays > 0 && (
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
        {account.firm === "Apex" && account.type === "PA" && consistencyInfo && rules.minProfitDays > 0 && (
          <RuleCard title={`Qualifying Days ($${rules.minDailyProfit}+)`}>
            <p className="text-[11px] text-muted-foreground leading-snug mb-2">
              Payout eligibility details (consistency, balance, tiers) are in Payout Status.
            </p>
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
        {account.firm === "Tradeify" && tradeifyProgram === "select_flex" && account.type === "PA" && rules.minProfitDays > 0 && (
          <RuleCard title={`Winning Days ($${rules.winningDayThreshold}+)`}>
            <p className="text-[11px] text-muted-foreground leading-snug mb-2">
              Five winning days this cycle · payout amount in Payout Status.
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Winning Days</span>
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

        {account.firm === "Lucid" && account.type === "PA" && rules.minProfitDays > 0 && (
          <RuleCard title={`Payout Days ($${rules.minDailyProfit}+)`}>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground leading-snug">
                Five separate ${rules.minDailyProfit}+ profit days this cycle · no minimum balance to request.
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payout Days</span>
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
        {account.firm === "Apex" && account.type === "PA" && rules.minBalanceToRequest > 0 && (
          <RuleCard title="Minimum Balance">
            <p className="text-[11px] text-muted-foreground leading-snug mb-2">
              Apex PA balance required to request a payout (see Payout Status for safety net).
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minimum Balance</span>
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
