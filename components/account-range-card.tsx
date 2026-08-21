"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { cn, formatCurrency } from "@/lib/utils"
import type { Account, InstrumentSpec, RiskProfile } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { getRuleStartingBalance } from "@/lib/account-quantity"
import { getAccountRangeFloorTitle } from "@/lib/floor-display-labels"
import { resolveRiskProfile, getHeadroom, tradesSuffix } from "@/lib/headroom"

/** Fields from calculateAccountStats — no new calculations. */
export interface AccountRangeStats {
  currentBalance: number
  totalPnL: number
  minBalance: number
  activeEodFloor: number
  drawdownRemaining: number
  /** Peak balance driving the floor (from stats engine) */
  floorPeakBalance?: number
}

export function shouldShowAccountRangeCard(account: Account): boolean {
  const rules = getAccountRules(account)
  const effectiveProfitTarget =
    account.profitTarget ?? (rules.hasProfitTarget ? rules.profitTarget : null)

  if (account.type === "Eval") return true
  if (effectiveProfitTarget != null && effectiveProfitTarget > 0) return true
  if (account.type === "PA" && rules.minBalanceToRequest > 0) return true
  if ((account.firm === "Lucid" || account.firm === "Tradeify") && account.type === "PA") return true
  return false
}

interface AccountRangeCardProps {
  account: Account
  stats: AccountRangeStats
  /** Headroom-in-trades inputs — optional, degrades to dollars-only. See lib/headroom.ts. */
  instrumentSpecs?: InstrumentSpec[]
  userDefaultRiskProfile?: RiskProfile | null
}

export function AccountRangeCard({
  account,
  stats,
  instrumentSpecs = [],
  userDefaultRiskProfile = null,
}: AccountRangeCardProps) {
  const rules = getAccountRules(account)
  const headroom = getHeadroom(
    stats.drawdownRemaining,
    resolveRiskProfile(account, userDefaultRiskProfile, instrumentSpecs),
  )
  const startingBalance = getRuleStartingBalance(account)
  const lucidFlex = rules.lucidFlexFloor
  const isLucidFlexPa =
    (account.firm === "Lucid" || account.firm === "Tradeify") &&
    account.type === "PA" &&
    lucidFlex != null
  const isLucidPaOther = account.firm === "Lucid" && account.type === "PA" && lucidFlex == null

  const effectiveProfitTarget = useMemo(() => {
    return account.profitTarget ?? (rules.hasProfitTarget ? rules.profitTarget : null)
  }, [account.profitTarget, rules.hasProfitTarget, rules.profitTarget])

  const hasProfitGoal = effectiveProfitTarget != null && effectiveProfitTarget > 0
  const isEval = account.type === "Eval"
  const payoutOnlyBar =
    !isLucidFlexPa && !hasProfitGoal && !isEval && rules.minBalanceToRequest > 0

  const peakForFloor = stats.floorPeakBalance ?? stats.currentBalance

  const floorVal = stats.activeEodFloor ?? stats.minBalance
  const passBalance =
    effectiveProfitTarget != null ? startingBalance + effectiveProfitTarget : startingBalance
  const payoutThreshold = rules.minBalanceToRequest

  const {
    rightEnd,
    span,
    rightTitle,
    rightValue,
    bottomRightLabel,
    bottomRightValue,
  } = useMemo(() => {
    if (isLucidFlexPa && lucidFlex) {
      const end = lucidFlex.lockPeakThreshold
      const sp = Math.max(end - floorVal, 1)
      const locked = peakForFloor >= lucidFlex.lockPeakThreshold
      return {
        rightEnd: end,
        span: sp,
        rightTitle: "Peak lock milestone",
        rightValue: (
          <span className="font-mono text-base font-semibold tracking-tight text-emerald-300/95 sm:text-lg lg:text-base">
            {formatCurrency(lucidFlex.lockPeakThreshold)}{" "}
            <span className="text-[10px] font-medium text-slate-400 sm:text-xs">peak</span>
          </span>
        ),
        bottomRightLabel: locked ? "Floor status" : "Peak to milestone",
        bottomRightValue: locked ? (
          <span className="font-mono font-semibold text-emerald-400/95">
            Locked at {formatCurrency(lucidFlex.lockedFloor)}
          </span>
        ) : (
          <span className="font-mono font-semibold text-emerald-400/95">
            {formatCurrency(Math.max(0, lucidFlex.lockPeakThreshold - peakForFloor))}
          </span>
        ),
      }
    }

    if (isLucidPaOther) {
      const end = Math.max(peakForFloor, stats.currentBalance, startingBalance)
      const sp = Math.max(end - floorVal, 1)
      return {
        rightEnd: end,
        span: sp,
        rightTitle: "Peak (high water)",
        rightValue: (
          <span className="font-mono text-base font-semibold tracking-tight text-emerald-300/95 sm:text-lg lg:text-base">
            {formatCurrency(peakForFloor)}{" "}
            <span className="text-[10px] font-medium text-slate-400 sm:text-xs">best</span>
          </span>
        ),
        bottomRightLabel: "Below peak",
        bottomRightValue: (
          <span className="font-mono font-semibold text-emerald-400/95">
            {formatCurrency(Math.max(0, peakForFloor - stats.currentBalance))}
          </span>
        ),
      }
    }

    const end = hasProfitGoal || isEval ? passBalance : payoutThreshold
    const sp = Math.max(end - floorVal, 1)
    const remainingToProfitGoal =
      effectiveProfitTarget != null ? Math.max(0, effectiveProfitTarget - stats.totalPnL) : 0
    const remainingToPayout =
      rules.minBalanceToRequest > 0
        ? Math.max(0, rules.minBalanceToRequest - stats.currentBalance)
        : 0

    return {
      rightEnd: end,
      span: sp,
      rightTitle:
        hasProfitGoal || isEval
          ? "Profit target"
          : rules.minBalanceToRequest > 0
            ? "Min payout balance"
            : "Target",
      rightValue:
        hasProfitGoal || isEval ? (
          <span className="font-mono text-base font-semibold tracking-tight text-emerald-300/95 sm:text-lg lg:text-base">
            {formatCurrency(passBalance)}{" "}
            <span className="text-[10px] font-medium text-slate-400 sm:text-xs">target</span>
          </span>
        ) : (
          <span className="font-mono text-base font-semibold tracking-tight text-emerald-300/95 sm:text-lg lg:text-base">
            {formatCurrency(payoutThreshold)}{" "}
            <span className="text-[10px] font-medium text-slate-400 sm:text-xs">threshold</span>
          </span>
        ),
      bottomRightLabel:
        hasProfitGoal || isEval ? "Remaining to target" : "Remaining to threshold",
      bottomRightValue:
        hasProfitGoal || isEval ? (
          <span className="font-mono font-semibold text-emerald-400/95">
            {formatCurrency(remainingToProfitGoal)}
          </span>
        ) : (
          <span className="font-mono font-semibold text-emerald-400/95">
            {formatCurrency(remainingToPayout)}
          </span>
        ),
    }
  }, [
    isLucidFlexPa,
    isLucidPaOther,
    lucidFlex,
    floorVal,
    peakForFloor,
    stats.currentBalance,
    stats.totalPnL,
    startingBalance,
    hasProfitGoal,
    isEval,
    passBalance,
    payoutThreshold,
    effectiveProfitTarget,
    rules.minBalanceToRequest,
  ])

  const pctInSpan = (value: number) =>
    Math.min(100, Math.max(0, ((value - floorVal) / span) * 100))

  const startPct = pctInSpan(startingBalance)
  const balancePct = pctInSpan(stats.currentBalance)

  const leftFloorTitle = getAccountRangeFloorTitle(account)

  const leftFloorDisplay = (
    <span className="font-mono text-base font-semibold tracking-tight text-slate-100 sm:text-lg lg:text-base">
      {formatCurrency(floorVal)}
      {account.firm === "Lucid" && isEval && (
        <span className="text-[10px] font-medium text-slate-400 sm:text-xs"> MLL</span>
      )}
    </span>
  )

  const bottomLeftEvalStyle = isEval
  const bottomLeftLabel = bottomLeftEvalStyle ? "Drawdown amount" : "Drawdown remaining"
  const bottomLeftValue = bottomLeftEvalStyle ? (
    <span className="font-mono font-semibold text-slate-200">{formatCurrency(account.maxDrawdown)}</span>
  ) : (
    <span className="font-mono font-semibold text-slate-200">
      {formatCurrency(Math.max(0, stats.drawdownRemaining))}
      <span className="text-slate-400">{tradesSuffix(headroom)}</span>
    </span>
  )

  return (
    <Card className="glass-card overflow-hidden rounded-[20px] border-white/10 bg-slate-950/35 px-2.5 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:rounded-[24px] sm:px-4 sm:py-4 lg:px-3.5 lg:py-2.5 max-sm:py-2">
      <div className="mb-1 lg:mb-0.5 flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Account range
        </h2>
      </div>

      {/* Range bar: floor (left) → target (right). Flat track, no traffic-light
          gradient — the fill's WIDTH (floor → current balance) is the risk
          signal, same "position/size, not hue" pattern as the Progress
          primitive. Start/Balance markers keep their own colors for now,
          flagged separately (not part of this fill fix). */}
      <div className="relative mb-2 lg:mb-1.5">
        <div
          className={cn(
            "relative h-2.5 overflow-visible rounded-full ring-1 ring-[var(--hairline)] sm:h-3",
            "bg-[var(--raised)]",
            "shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]",
          )}
          aria-hidden
        >
          {/* Ground covered: floor → current balance */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-l-full bg-[var(--text)]/15"
            style={{ width: `${Math.min(100, balancePct)}%` }}
          />

          {/* Floor (left edge) */}
          <div className="absolute left-0 top-1/2 z-10 h-3 w-px -translate-y-1/2 rounded-full bg-[var(--text)] sm:h-3.5" />

          {/* Target (right edge) */}
          <div className="absolute right-0 top-1/2 z-10 h-3 w-px -translate-y-1/2 rounded-full bg-[var(--text)] sm:h-3.5" />

          {/* START */}
          <div
            className="absolute top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${startPct}%` }}
          >
            <span className="whitespace-nowrap rounded-full border border-cyan-400/40 bg-slate-950/95 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-cyan-100/95">
              Start
            </span>
            <span className="h-1.5 w-1.5 rounded-full border border-cyan-300/70 bg-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.5)] sm:h-2 sm:w-2" />
          </div>

          {/* Balance */}
          <div
            className="absolute top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${balancePct}%` }}
          >
            <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)] ring-4 ring-emerald-400/15 sm:h-4 sm:w-4" />
          </div>
        </div>

        <div className="mt-1 flex justify-between px-0.5 text-[9px] tabular-nums text-slate-500 sm:text-[10px]">
          <span className="max-w-[48%] truncate">{formatCurrency(floorVal)}</span>
          <span className="max-w-[48%] truncate text-right">{formatCurrency(rightEnd)}</span>
        </div>
      </div>

      {/* Three columns — always 3-col even on mobile (compact) */}
      <div className="grid grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-1 sm:grid-cols-3 gap-1.5 border-t border-white/10 pt-1.5 sm:gap-3 sm:pt-3 lg:gap-4 lg:pt-2">
        <div className="space-y-0.5 text-left sm:pr-1">
          <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-[0.10em] sm:tracking-[0.14em] text-slate-500">{leftFloorTitle}</p>
          <div className="[&_.font-mono]:text-sm sm:[&_.font-mono]:text-base lg:[&_.font-mono]:text-base [&_span]:text-[9px] sm:[&_span]:text-xs">
            {leftFloorDisplay}
          </div>
        </div>
        <div className="space-y-0.5 text-center max-sm:col-span-2 max-sm:text-left sm:text-center">
          <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-[0.10em] sm:tracking-[0.14em] text-slate-500">Balance</p>
          <p className="font-mono text-sm sm:text-xl lg:text-lg font-semibold tracking-tight text-slate-50">
            {formatCurrency(stats.currentBalance)}
          </p>
        </div>
        <div className="space-y-0.5 text-right sm:pl-1">
          <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-[0.10em] sm:tracking-[0.14em] text-slate-500">{rightTitle}</p>
          <div className="[&_.font-mono]:text-sm sm:[&_.font-mono]:text-base lg:[&_.font-mono]:text-base [&_span]:text-[9px] sm:[&_span]:text-xs">
            {rightValue}
          </div>
        </div>
      </div>

      {/* Bottom metrics */}
      <div className="mt-1.5 flex flex-col gap-1 border-t border-white/10 pt-1.5 sm:mt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pt-3 lg:mt-2 lg:pt-2 lg:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-[0.10em] sm:tracking-[0.14em] text-slate-500">{bottomLeftLabel}</p>
          <div className="mt-0.5 sm:mt-1 lg:mt-0 text-xs sm:text-base lg:text-sm">{bottomLeftValue}</div>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[8px] sm:text-[10px] font-medium uppercase tracking-[0.10em] sm:tracking-[0.14em] text-slate-500">{bottomRightLabel}</p>
          <div className="mt-0.5 sm:mt-1 lg:mt-0 text-xs sm:text-base lg:text-sm">{bottomRightValue}</div>
        </div>
      </div>

      {payoutOnlyBar && (
        <p className="mt-2 lg:mt-1.5 text-[10px] leading-snug text-slate-500">
          Visual span is active floor through minimum balance to request a payout.
        </p>
      )}

      {isLucidFlexPa && (
        <p className="mt-2 lg:mt-1.5 text-[10px] leading-snug text-slate-500">
          LucidFlex: payouts use cycle profit rules only — no minimum balance gate. Floor locks at{" "}
          {formatCurrency(lucidFlex!.lockedFloor)} after peak reaches {formatCurrency(lucidFlex!.lockPeakThreshold)}.
        </p>
      )}
    </Card>
  )
}
