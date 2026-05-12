"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, Trade, Payout } from "@/lib/types"
import { calculateAccountStats, getConsistencyInfo, getPayoutEligibility } from "@/lib/storage"
import { applyIntradayManualDrawdownToStats } from "@/lib/intraday-manual-drawdown"
import { getAccountRules } from "@/lib/rules"
import { ChevronRight } from "lucide-react"

interface AccountCardProps {
  account: Account
  trades: Trade[]
  payouts: Payout[]
  onClick?: () => void
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AccountCard({ account, trades, payouts, onClick }: AccountCardProps) {
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

  const barClass = "h-1.5"
  const rowLabelClass = "text-[10px] text-muted-foreground uppercase tracking-wider"
  const rowValueClass = "font-mono text-[10px] font-medium tabular-nums"

  return (
    <Card
      className={cn(
        "p-4 sm:p-6 bg-card/50 backdrop-blur border-border/50 cursor-pointer transition-all hover:bg-card/80 hover:border-border group",
        "glass-card glass-card-hover rounded-[24px] cursor-pointer group",
        !stats.isSafe && "border-red-500/50"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base sm:text-lg truncate text-slate-100">{account.name}</h3>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 premium-pill",
                account.firm === "Apex" && "border-orange-500/50 text-orange-400",
                account.firm === "Lucid" && "border-cyan-500/50 text-cyan-300",
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
                account.type === "Live" && "border-blue-500/50 text-blue-400"
              )}
            >
              {account.type}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 premium-pill",
                account.drawdownType === "Intraday"
                  ? "border-cyan-500/50 text-cyan-300"
                  : "border-sky-500/50 text-sky-400"
              )}
            >
              {account.drawdownType ?? "EOD"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 premium-pill",
                account.status === "Active" && "border-emerald-500/50 text-emerald-400",
                account.status === "Passed" && "border-blue-500/50 text-blue-400",
                account.status === "Breached" && "border-red-500/50 text-red-400"
              )}
            >
              {account.status}
            </Badge>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-cyan-300 transition-colors shrink-0" />
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
            <Progress value={evalPassed ? 100 : evalProfitProgress} className={cn(barClass)} />
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
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-xs text-muted-foreground">Scaling Plan Active</span>
          </div>
        )}
      </div>
    </Card>
  )
}
