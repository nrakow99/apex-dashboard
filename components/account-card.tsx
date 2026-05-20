"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, Trade, Payout } from "@/lib/types"
import { calculateAccountStats, getConsistencyInfo, getPayoutEligibility } from "@/lib/storage"
import { applyIntradayManualDrawdownToStats } from "@/lib/intraday-manual-drawdown"
import { getAccountRules } from "@/lib/rules"
import { ChevronRight, TrendingUp } from "lucide-react"

interface AccountCardProps {
  account: Account
  trades: Trade[]
  payouts: Payout[]
  onClick?: () => void
  /** Shown for passed evals that have not been activated yet */
  onActivatePa?: () => void
  /** Dropdown menu rendered in top-right, fades in on hover */
  menuSlot?: React.ReactNode
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type HealthColor = "red" | "amber" | "green" | "blue" | "neutral"
interface HealthStatus { label: string; color: HealthColor }

function getAccountHealth({
  account,
  isSafe,
  drawdownRemaining,
  maxDrawdown,
  totalPnL,
  evalPassed,
  evalProfitProgress,
  consistencyValid,
  hasConsistency,
  remainingToMinPayout,
  lucidEligible,
  hasPayouts,
}: {
  account: { type: string; status: string }
  isSafe: boolean
  drawdownRemaining: number
  maxDrawdown: number
  totalPnL: number
  evalPassed: boolean
  evalProfitProgress: number
  consistencyValid: boolean | null
  hasConsistency: boolean
  remainingToMinPayout: number | null
  lucidEligible: boolean
  hasPayouts: boolean
}): HealthStatus {
  if (account.status === "Breached" || !isSafe) {
    return { label: "Breached", color: "red" }
  }
  if (drawdownRemaining < maxDrawdown * 0.18) {
    return { label: "At Risk", color: "red" }
  }
  if (hasConsistency && consistencyValid === false) {
    return { label: "Consistency Risk", color: "amber" }
  }
  if (hasPayouts && (lucidEligible || (remainingToMinPayout !== null && remainingToMinPayout <= 350))) {
    return { label: "Near Payout", color: "green" }
  }
  if (evalPassed) {
    return { label: "Target Met", color: "green" }
  }
  if (account.type === "Eval" && evalProfitProgress >= 65) {
    return { label: "Passing Pace", color: "blue" }
  }
  if (drawdownRemaining < maxDrawdown * 0.45) {
    return { label: "Watchful", color: "amber" }
  }
  return { label: "Stable", color: "neutral" }
}

export function AccountCard({
  account,
  trades,
  payouts,
  onClick,
  onActivatePa,
  menuSlot,
}: AccountCardProps) {
  const rawStats = calculateAccountStats(account, trades, payouts)
  const stats = applyIntradayManualDrawdownToStats(account, rawStats)
  const rules = getAccountRules(account)
  const consistencyInfo = account.type === "PA" && rules.hasConsistency
    ? getConsistencyInfo(account.id, trades, account, payouts)
    : null

  const effectiveProfitTarget =
    account.profitTarget ?? (rules.hasProfitTarget ? rules.profitTarget : undefined)

  const evalPassed =
    account.type === "Eval" &&
    effectiveProfitTarget != null &&
    (account.status === "Passed" || stats.totalPnL >= effectiveProfitTarget)

  const evalProfitProgress =
    effectiveProfitTarget != null && effectiveProfitTarget > 0
      ? Math.min(100, (Math.max(0, stats.totalPnL) / effectiveProfitTarget) * 100)
      : 0

  const minPayoutBalanceTarget =
    account.type === "PA" && account.firm === "Apex" && rules.minBalanceToRequest > 0
      ? rules.minBalanceToRequest
      : null

  const payoutSpan =
    minPayoutBalanceTarget != null ? minPayoutBalanceTarget - account.startingBalance : null

  const paMinBalanceProgress =
    minPayoutBalanceTarget != null
      ? payoutSpan != null && payoutSpan > 0
        ? Math.min(
            100,
            Math.max(0, ((stats.currentBalance - account.startingBalance) / payoutSpan) * 100)
          )
        : stats.currentBalance >= minPayoutBalanceTarget
          ? 100
          : 0
      : 0

  const remainingToMinPayoutBalance =
    minPayoutBalanceTarget != null ? Math.max(0, minPayoutBalanceTarget - stats.currentBalance) : null

  const lucidEligibility =
    account.firm === "Lucid" && account.type === "PA" && rules.hasPayouts
      ? getPayoutEligibility(account.id, trades, account, payouts)
      : null

  const lucidCycleThreshold =
    lucidEligibility && rules.payoutMaxPercent > 0
      ? rules.minPayoutAmount / rules.payoutMaxPercent
      : null

  const lucidCycleProgress =
    lucidCycleThreshold != null && lucidCycleThreshold > 0 && lucidEligibility
      ? lucidEligibility.isEligible
        ? 100
        : Math.min(100, Math.max(0, (Math.max(0, lucidEligibility.cycleProfit) / lucidCycleThreshold) * 100))
      : 0

  const showLiveMainGoal =
    account.type === "Live" &&
    (effectiveProfitTarget != null ||
      (rules.minBalanceToRequest > 0 && rules.minBalanceToRequest > account.startingBalance))

  const drawdownLabel = account.drawdownType === "EOD" ? "EOD Drawdown" : "Intraday Drawdown"

  const health = getAccountHealth({
    account,
    isSafe: stats.isSafe,
    drawdownRemaining: stats.drawdownRemaining,
    maxDrawdown: account.maxDrawdown,
    totalPnL: stats.totalPnL,
    evalPassed,
    evalProfitProgress,
    consistencyValid: consistencyInfo ? consistencyInfo.isValid : null,
    hasConsistency: rules.hasConsistency,
    remainingToMinPayout: remainingToMinPayoutBalance,
    lucidEligible: lucidEligibility?.isEligible ?? false,
    hasPayouts: rules.hasPayouts,
  })

  // Eval pace insight — average daily PnL vs remaining target
  const evalPace =
    account.type === "Eval" &&
    effectiveProfitTarget != null &&
    effectiveProfitTarget > 0 &&
    !evalPassed &&
    stats.tradingDays > 0
      ? {
          dailyAvg: stats.totalPnL / stats.tradingDays,
          remaining: Math.max(0, effectiveProfitTarget - stats.totalPnL),
        }
      : null

  const barClass = "h-1.5"
  const rowLabelClass = "text-[10px] text-muted-foreground uppercase tracking-wider"
  const rowValueClass = "font-mono text-[10px] font-medium tabular-nums"

  return (
    <Card
      className={cn(
        "relative p-4 sm:p-6 glass-card glass-card-hover account-card-hover rounded-[24px] cursor-pointer group",
        "transition-all active:scale-[0.992] active:shadow-none",
        !stats.isSafe && "border-red-500/40",
        stats.isSafe && account.type === "Eval" && "border-amber-500/[0.13]",
        stats.isSafe && account.type === "PA" && "border-emerald-500/[0.11]",
      )}
      onClick={onClick}
    >
      {/* ── Absolutely-positioned top-right controls ─────────────────────
          Chevron, health badge, and the 3-dot action menu are all placed
          here so they never participate in the flex layout and cannot
          cause shifts or overlaps.
      ────────────────────────────────────────────────────────────────── */}

      {/* Chevron — always visible, top-right */}
      <ChevronRight
        className="absolute top-5 right-5 h-5 w-5 text-slate-600 group-hover:text-[#E5E4E2]/60 transition-colors pointer-events-none"
        aria-hidden
      />

      {/* Health badge — fixed below chevron */}
      <span
        className={cn(
          "absolute top-12 right-5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border tabular-nums tracking-wide pointer-events-none",
          health.color === "red"     && "bg-red-500/10 border-red-500/30 text-red-400",
          health.color === "amber"   && "bg-amber-500/10 border-amber-500/25 text-amber-400",
          health.color === "green"   && "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
          health.color === "blue"    && "bg-[#536878]/[0.14] border-[#536878]/30 text-[#94AAB8]",
          health.color === "neutral" && "bg-white/[0.04] border-white/[0.08] text-[#E5E4E2]/45",
        )}
      >
        {health.label}
      </span>

      {/* 3-dot action menu — to the left of the chevron, fades in on hover */}
      {menuSlot && (
        <div
          className="absolute top-4 right-12 z-10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {menuSlot}
        </div>
      )}

      {/* Header — left side only; right side is handled by absolute controls above */}
      <div className="mb-4 pr-[76px]">
        <h3 className="font-semibold text-base sm:text-lg truncate text-[#E5E4E2]">{account.name}</h3>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 premium-pill",
              account.firm === "Apex" && "border-orange-500/50 text-orange-400",
              account.firm === "Lucid" && "border-[#536878]/50 text-[#A0B4BF]",
              !account.firm && "border-orange-500/50 text-orange-400"
            )}
          >
            {account.firm ?? "Apex"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 premium-pill",
              account.type === "Eval" && "border-amber-500/50 text-amber-400",
              account.type === "PA" && "border-emerald-500/50 text-emerald-400",
              account.type === "Live" && "border-[#536878]/50 text-[#94AAB8]"
            )}
          >
            {account.type}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 premium-pill",
              account.drawdownType === "Intraday"
                ? "border-[#536878]/50 text-[#94AAB8]"
                : "border-[#536878]/40 text-[#8AA0AC]"
            )}
          >
            {account.drawdownType ?? "EOD"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 premium-pill",
              account.status === "Active" && "border-emerald-500/50 text-emerald-400",
              account.status === "Passed" && "border-[#536878]/50 text-[#94AAB8]",
              account.status === "Breached" && "border-red-500/50 text-red-400"
            )}
          >
            {account.status}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-3.5">
        {/* Balance & PnL */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Balance</div>
            <div className="text-lg sm:text-2xl font-semibold font-mono tracking-tight">
              ${fmtMoney(stats.currentBalance)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Net PnL</div>
            <div
              className={cn(
                "text-lg sm:text-2xl font-semibold font-mono tracking-tight",
                stats.totalPnL >= 0 ? "text-emerald-500" : "text-red-500"
              )}
            >
              {stats.totalPnL >= 0 ? "+" : ""}${Math.abs(stats.totalPnL).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Main goal — Eval */}
        {account.type === "Eval" && effectiveProfitTarget != null && effectiveProfitTarget > 0 && (
          <div>
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className={rowLabelClass}>Profit Target</span>
              <span className={cn(rowValueClass, evalPassed && "text-emerald-400")}>
                {evalPassed
                  ? "Passed"
                  : `${fmtMoney(Math.max(0, stats.totalPnL))} / ${fmtMoney(effectiveProfitTarget)}`}
              </span>
            </div>
            <Progress
              value={evalPassed ? 100 : evalProfitProgress}
              className={cn(barClass, !evalPassed && "[&>div]:bg-amber-500")}
            />
          </div>
        )}

        {/* Main goal — Apex PA */}
        {account.type === "PA" && account.firm === "Apex" && minPayoutBalanceTarget != null && (
          <div>
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className={rowLabelClass}>Min Payout Balance</span>
              <span className={cn(rowValueClass, remainingToMinPayoutBalance === 0 && "text-emerald-400")}>
                {remainingToMinPayoutBalance !== null ? `$${fmtMoney(remainingToMinPayoutBalance)} remaining` : "—"}
              </span>
            </div>
            <Progress value={paMinBalanceProgress} className={barClass} />
          </div>
        )}

        {/* Main goal — Lucid PA (cycle profit vs payout-eligibility threshold from rules) */}
        {account.type === "PA" &&
          account.firm === "Lucid" &&
          lucidEligibility &&
          lucidCycleThreshold != null && (
            <div>
              <div className="flex justify-between items-baseline gap-2 mb-1">
                <span className={rowLabelClass}>Payout cycle</span>
                <span className={cn(rowValueClass, lucidEligibility.isEligible && "text-emerald-400")}>
                  {lucidEligibility.isEligible
                    ? "Eligible"
                    : `${fmtMoney(Math.max(0, lucidEligibility.cycleProfit))} / ${fmtMoney(lucidCycleThreshold)}`}
                </span>
              </div>
              <Progress value={lucidCycleProgress} className={barClass} />
            </div>
          )}

        {/* Main goal — Live (only when a rule-based target exists) */}
        {showLiveMainGoal && (
          <div>
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className={rowLabelClass}>
                {effectiveProfitTarget != null ? "Profit Target" : "Min Payout Balance"}
              </span>
              <span className={rowValueClass}>
                {effectiveProfitTarget != null ? (
                  `${fmtMoney(Math.max(0, stats.totalPnL))} / ${fmtMoney(effectiveProfitTarget)}`
                ) : rules.minBalanceToRequest > 0 ? (
                  `$${fmtMoney(Math.max(0, rules.minBalanceToRequest - stats.currentBalance))} remaining`
                ) : (
                  "—"
                )}
              </span>
            </div>
            <Progress
              value={
                effectiveProfitTarget != null && effectiveProfitTarget > 0
                  ? Math.min(100, (Math.max(0, stats.totalPnL) / effectiveProfitTarget) * 100)
                  : rules.minBalanceToRequest > account.startingBalance
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          ((stats.currentBalance - account.startingBalance) /
                            (rules.minBalanceToRequest - account.startingBalance)) *
                            100
                        )
                      )
                    : 0
              }
              className={barClass}
            />
          </div>
        )}

        {/* Eval pace insight */}
        {evalPace && evalPace.dailyAvg > 0 && (
          <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-[rgba(83,104,120,0.07)] border border-[rgba(83,104,120,0.14)]">
            <TrendingUp className="h-3 w-3 text-[#94AAB8] shrink-0" />
            <span className="text-[10px] text-[#E5E4E2]/50">
              Avg{" "}
              <span className="font-mono text-[#94AAB8] font-medium">
                ${evalPace.dailyAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day
              </span>
              {" — "}est.{" "}
              <span className="font-mono text-[#94AAB8] font-medium">
                {Math.ceil(evalPace.remaining / evalPace.dailyAvg)}d
              </span>{" "}
              remaining
            </span>
          </div>
        )}

        {/* Drawdown */}
        <div>
          <div className="flex justify-between items-baseline gap-2 mb-1">
            <span className={rowLabelClass}>{drawdownLabel}</span>
            <span
              className={cn(
                rowValueClass,
                stats.drawdownRemaining > account.maxDrawdown * 0.5
                  ? "text-emerald-500"
                  : stats.drawdownRemaining > account.maxDrawdown * 0.2
                    ? "text-amber-500"
                    : "text-red-500"
              )}
            >
              ${fmtMoney(Math.max(0, stats.drawdownRemaining))} / ${fmtMoney(account.maxDrawdown)}
            </span>
          </div>
          <Progress
            value={Math.max(0, (stats.drawdownRemaining / account.maxDrawdown) * 100)}
            className={cn(
              barClass,
              stats.drawdownRemaining > account.maxDrawdown * 0.5 && "[&>div]:bg-emerald-500",
              stats.drawdownRemaining <= account.maxDrawdown * 0.5 &&
                stats.drawdownRemaining > account.maxDrawdown * 0.2 &&
                "[&>div]:bg-amber-500",
              stats.drawdownRemaining <= account.maxDrawdown * 0.2 && "[&>div]:bg-red-500"
            )}
          />
        </div>

        {/* PA: Apex consistency summary */}
        {account.type === "PA" && consistencyInfo && (
          <div className="flex items-center gap-4 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", stats.tradingDays >= 5 ? "bg-emerald-500" : "bg-amber-500")} />
              <span className="text-xs text-muted-foreground">{stats.tradingDays}/5 Days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", consistencyInfo.isValid ? "bg-emerald-500" : "bg-red-500")} />
              <span className="text-xs text-muted-foreground">
                {consistencyInfo.isValid ? "Consistent" : "50% Violated"}
              </span>
            </div>
          </div>
        )}

        {/* Lucid PA: scaling (only when program includes scaling tiers) */}
        {account.firm === "Lucid" && account.type === "PA" && rules.hasScaling && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <div className="w-2 h-2 rounded-full bg-[#536878]" />
            <span className="text-xs text-muted-foreground">Scaling Plan Active</span>
          </div>
        )}

        {onActivatePa && (
          <div className="pt-3 border-t border-white/10 flex justify-end">
            <Button
              type="button"
              size="sm"
              className="text-xs bg-gradient-to-r from-emerald-600/90 to-[#536878]/90 hover:from-emerald-500 hover:to-[#536878] shadow-md shadow-emerald-900/20"
              onClick={(e) => {
                e.stopPropagation()
                onActivatePa()
              }}
            >
              Activate PA
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
