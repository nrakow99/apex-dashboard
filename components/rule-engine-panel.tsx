"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, DailyPnL, InstrumentSpec, RiskProfile } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { resolveRiskProfile, getHeadroom, tradesSuffix } from "@/lib/headroom"
import { getTodayDateStr, isApexPaConsistency, isLucidEvalConsistency, isTradeifyEvalConsistency } from "@/lib/storage"
import { getTradeifyScalingTier } from "@/lib/tradeify-scaling"
import { resolveTradeifyProgram } from "@/lib/rules"
import {
  getRuleEngineFloorCardTitle,
  getRuleEngineFloorRowHint,
  getRuleEngineFloorRowLabel,
} from "@/lib/floor-display-labels"
import { getApexPaScalingTier } from "@/lib/apex-pa-scaling"
import { DISPLAY_THRESHOLDS } from "@/lib/display-thresholds"
import { CheckCircle2, AlertTriangle } from "lucide-react"

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
  /** Headroom-in-trades inputs — optional, degrades to dollars-only. See lib/headroom.ts. */
  instrumentSpecs?: InstrumentSpec[]
  userDefaultRiskProfile?: RiskProfile | null
}

/**
 * ── Structural severity system (same tiers as account-card.tsx) ─────────
 * "danger"/"warning" never tint the card background or border by hue.
 * Severity reads through the left-edge accent width, icon fill, and label
 * weight only — every RuleCard sits on the same flat --raised surface.
 * ─────────────────────────────────────────────────────────────────────────
 */
function StatusIcon({ status }: { status: "good" | "warning" | "danger" }) {
  if (status === "good") return <CheckCircle2 className="h-4 w-4 text-[var(--text)]" aria-hidden />
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-[var(--text)] opacity-60" aria-hidden />
  return <AlertTriangle className="h-4 w-4 text-[var(--text)]" aria-hidden />
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
      "self-start rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] p-4",
      status === "danger" && "border-l-4 border-l-[var(--text)]",
      status === "warning" && "border-l-2 border-l-[var(--text)]",
      className
    )}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className={cn(
          "text-sm",
          status === "danger" ? "font-bold" : "font-semibold",
        )}>
          {title}
        </span>
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
  const effectiveProfitTarget = rules.hasProfitTarget ? rules.profitTarget : null

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
  instrumentSpecs = [],
  userDefaultRiskProfile = null,
}: RuleEnginePanelProps) {
  const rules = getAccountRules(account)
  const headroom = getHeadroom(
    stats.drawdownRemaining,
    resolveRiskProfile(account, userDefaultRiskProfile, instrumentSpecs),
  )
  const effectiveProfitTarget = rules.hasProfitTarget ? rules.profitTarget : null
  const lucidQualifyingDaysInCycle =
    (account.firm === "Lucid" || account.firm === "Tradeify") &&
    account.type === "PA"
      ? (lucidCycleQualifyingDays ?? null)
      : (consistencyInfo?.daysWithMinProfit ?? null)

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
    return "grid-cols-1 md:grid-cols-2"
  }, [account, consistencyInfo, tradeifyProgram, apexPaScaling, tradeifyScaling])

  // Daily loss (today only); EOD PA uses tier DLL from scaling when available
  const todayPnL = dailyData.find((day) => day.date === getTodayDateStr())?.pnl ?? 0
  const effectiveDll =
    account.firm === "Apex" && account.type === "PA" && apexPaScaling
      ? apexPaScaling.dailyLossLimit
      : rules.dailyLossLimit
  const dailyLossRemaining = effectiveDll + Math.min(0, todayPnL)
  const dailyLossStatus: "good" | "warning" | "danger" =
    !rules.hasDLL
      ? "good"
      : todayPnL >= -effectiveDll * (1 - DISPLAY_THRESHOLDS.dailyLossGoodRemainingFraction)
        ? "good"
        : todayPnL >= -effectiveDll
          ? "warning"
          : "danger"

  // Drawdown / floor
  const drawdownPercent = rules.maxDrawdown > 0
    ? (stats.drawdownRemaining / rules.maxDrawdown) * 100
    : 0
  const drawdownStatus: "good" | "warning" | "danger" =
    drawdownPercent > DISPLAY_THRESHOLDS.drawdownGoodRemainingFraction * 100
      ? "good"
      : drawdownPercent > DISPLAY_THRESHOLDS.drawdownWarningRemainingFraction * 100
        ? "warning"
        : "danger"

  const firmLabel = account.firm
  const hasConsistencyActivity = stats.tradingDays > 0

  return (
    <Card className="self-start rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Compliance</p>
          <h2 className="mt-1 text-lg font-medium tracking-[-0.02em]">Rule status</h2>
          <p className="mt-1 max-w-md text-xs text-[var(--muted)]">{ruleStatusSubtitle(account, rules)}</p>
        </div>
        {/* Firm / type — neutral surface, no per-firm or per-type hue */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
            {firmLabel}
          </span>
          <span className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
            {account.type}
          </span>
        </div>
      </div>

      <div className={cn("grid items-start gap-2 sm:gap-4", ruleGridClass)}>

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
              <span className="font-mono">
                ${stats.minBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="pt-1.5 border-t border-border/50">
              <div className="flex justify-between">
                <span className="font-medium">Remaining</span>
                <span className="font-mono font-bold">
                  ${Math.max(0, stats.drawdownRemaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {tradesSuffix(headroom)}
                </span>
              </div>
              <Progress value={Math.max(0, drawdownPercent)} className="h-1.5 mt-1.5" />
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
                <span className="font-mono font-bold">
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
                <span className="font-mono font-semibold">Level {apexPaScaling.level}</span>
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
                <span className="font-mono font-medium">
                  ${apexPaScaling.currentProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {apexPaScaling.isMaxTier ? (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tier status</span>
                    <span className="font-semibold">Max Tier Reached</span>
                  </div>
                  <Progress value={100} className="h-1" />
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Next tier</span>
                    <span className="text-right font-mono">
                      Level {apexPaScaling.nextLevel}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {apexPaScaling.amountToNextTier == null
                          ? "Unavailable"
                          : `$${apexPaScaling.amountToNextTier.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} to go`}
                      </span>
                    </span>
                  </div>
                  <Progress value={apexPaScaling.progressToNextTierPercent} className="h-1" />
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
                <span className="font-mono">
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
                <div className="text-xs font-semibold pt-1">Max tier reached</div>
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
            status={!hasConsistencyActivity ? undefined : consistencyInfo.isValid ? "good" : (isApexPaConsistency(account) || isLucidEvalConsistency(account) || isTradeifyEvalConsistency(account)) ? "danger" : "warning"}
          >
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Largest Day</span>
                <span className={cn("font-mono", !consistencyInfo.isValid && "font-semibold")}>
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
                <span className={cn("font-medium", !consistencyInfo.isValid && "font-bold uppercase tracking-wide text-[10px]")}>
                  {!hasConsistencyActivity ? "Not evaluated" : consistencyInfo.isValid ? "Passed" : "Failed"}
                </span>
              </div>
              {hasConsistencyActivity && !consistencyInfo.isValid && consistencyInfo.additionalProfitNeeded > 0 && (
                <div className="text-xs pt-1 text-[var(--muted-foreground)]">
                  Need ${consistencyInfo.additionalProfitNeeded.toLocaleString(undefined, { minimumFractionDigits: 2 })} more profit to restore compliance
                </div>
              )}
              {hasConsistencyActivity && !consistencyInfo.isValid && consistencyInfo.totalProfit <= 0 && isApexPaConsistency(account) && (
                <div className="text-xs text-[var(--muted-foreground)] pt-1">
                  No net profits since last payout
                </div>
              )}
              {hasConsistencyActivity && !consistencyInfo.isValid && consistencyInfo.totalProfit <= 0 && isLucidEvalConsistency(account) && (
                <div className="text-xs text-[var(--muted-foreground)] pt-1">
                  Account profit must be positive for consistency
                </div>
              )}
              {hasConsistencyActivity && !consistencyInfo.isValid && consistencyInfo.totalProfit <= 0 && isTradeifyEvalConsistency(account) && (
                <div className="text-xs text-[var(--muted-foreground)] pt-1">
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
                <span className="font-mono font-bold">
                  {stats.tradingDays} / {rules.minTradingDays}
                </span>
              </div>
              <Progress value={(stats.tradingDays / rules.minTradingDays) * 100} className="h-1.5" />
            </div>
          </RuleCard>
        )}

        {/* ── Apex PA: Trading Days ─────────────────────────────────────────── */}
        {account.firm !== "Lucid" && account.firm !== "Tradeify" && account.type === "PA" && rules.minTradingDays > 0 && (
          <RuleCard title="Trading Days">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days Traded</span>
                <span className="font-mono font-bold">
                  {stats.tradingDays} / {rules.minTradingDays}
                </span>
              </div>
              <Progress value={(stats.tradingDays / rules.minTradingDays) * 100} className="h-1.5" />
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
                <span className="font-mono font-bold">
                  {consistencyInfo.daysWithMinProfit} / {rules.minProfitDays}
                </span>
              </div>
              <Progress value={(consistencyInfo.daysWithMinProfit / rules.minProfitDays) * 100} className="h-1.5" />
            </div>
          </RuleCard>
        )}

        {/* ── LucidFlex PA: qualifying payout days (cycle) — no Apex consistency gate ─ */}
        {account.firm === "Tradeify" && tradeifyProgram === "select_flex" && account.type === "PA" && rules.minProfitDays > 0 && (
          <RuleCard title={`Winning Days ($${rules.winningDayThreshold}+)`}>
            <p className="text-[11px] text-muted-foreground leading-snug mb-2">
              {rules.minProfitDays} winning days this cycle · payout amount in Payout Status.
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Winning Days</span>
                <span className="font-mono font-bold">
                  {lucidQualifyingDaysInCycle == null
                    ? "Unavailable"
                    : `${lucidQualifyingDaysInCycle} / ${rules.minProfitDays}`}
                </span>
              </div>
              {lucidQualifyingDaysInCycle != null && (
                <Progress value={(lucidQualifyingDaysInCycle / rules.minProfitDays) * 100} className="h-1.5" />
              )}
            </div>
          </RuleCard>
        )}

        {account.firm === "Lucid" && account.type === "PA" && rules.minProfitDays > 0 && (
          <RuleCard title={`Payout Days ($${rules.minDailyProfit}+)`}>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground leading-snug">
                {rules.minProfitDays} separate ${rules.minDailyProfit}+ profit days this cycle · no minimum balance to request.
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payout Days</span>
                <span className="font-mono font-bold">
                  {lucidQualifyingDaysInCycle == null
                    ? "Unavailable"
                    : `${lucidQualifyingDaysInCycle} / ${rules.minProfitDays}`}
                </span>
              </div>
              {lucidQualifyingDaysInCycle != null && (
                <Progress value={(lucidQualifyingDaysInCycle / rules.minProfitDays) * 100} className="h-1.5" />
              )}
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
                <span className="font-mono font-bold">
                  ${rules.minBalanceToRequest.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-mono">
                  ${Math.max(0, rules.minBalanceToRequest - stats.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress value={Math.min(100, (stats.currentBalance / rules.minBalanceToRequest) * 100)} className="h-1.5" />
            </div>
          </RuleCard>
        )}
      </div>
    </Card>
  )
}
