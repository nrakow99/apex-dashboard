"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, Trade, Payout } from "@/lib/types"
import { calculateAccountStats, getConsistencyInfo, getPayoutEligibility } from "@/lib/storage"
import { applyIntradayManualDrawdownToStats } from "@/lib/intraday-manual-drawdown"
import { getAccountRules, resolveTradeifyProgram } from "@/lib/rules"
import { tradeifyProgramLabel } from "@/lib/tradeify-rules"
import {
  getRuleStartingBalance,
  getAccountQuantity,
  formatAccountBundleHelper,
} from "@/lib/account-quantity"
import { AccountQuantityBadge } from "@/components/account-quantity-badge"
import { ChevronRight, AlertTriangle, CheckCircle2, Circle } from "lucide-react"
import { AccountCardInsightBanner } from "@/components/account-card-insight-banner"
import {
  getAccountCardInsight,
  getAccountTenure,
} from "@/lib/account-card-insight"

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

/**
 * ── Structural severity system ──────────────────────────────────────────
 * Replaces the old red/amber/green/blue hue-coded health pill. CLAUDE.md
 * reserves color for signed P&L only, so risk here is expressed purely via
 * position/size/weight:
 *   - critical: thick left-edge accent + bold uppercase label + filled icon
 *   - elevated: thin left-edge accent + semibold label + outline icon
 *   - positive: no accent, medium-weight label + filled check
 *   - neutral:  no accent, regular-weight muted label, no icon
 * Every tier renders in the same two neutral grays (--text / --muted-fg).
 * This is the pattern to reuse for Rule Status, the calendar, etc.
 * ─────────────────────────────────────────────────────────────────────────
 */
type HealthSeverity = "critical" | "elevated" | "positive" | "neutral"
interface HealthStatus { label: string; severity: HealthSeverity }

function getAccountHealth({
  account,
  isSafe,
  drawdownRemaining,
  maxDrawdown,
  evalPassed,
  evalProfitProgress,
  consistencyValid,
  hasConsistency,
  remainingToMinPayout,
  lucidEligible,
  hasPayouts,
  isPayoutEligible,
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
  isPayoutEligible: boolean
}): HealthStatus {
  if (account.status === "Breached" || !isSafe) {
    return { label: "Breached", severity: "critical" }
  }
  if (drawdownRemaining < maxDrawdown * 0.18) {
    return { label: "At Risk", severity: "critical" }
  }
  if (hasConsistency && consistencyValid === false) {
    return { label: "Consistency Risk", severity: "elevated" }
  }
  // Locked In: fully eligible for payout and sitting comfortably above floor
  if (hasPayouts && isPayoutEligible && drawdownRemaining >= maxDrawdown * 0.55) {
    return { label: "Locked In", severity: "positive" }
  }
  if (hasPayouts && (lucidEligible || (remainingToMinPayout !== null && remainingToMinPayout <= 350))) {
    return { label: "Near Payout", severity: "positive" }
  }
  if (evalPassed) {
    return { label: "Target Met", severity: "positive" }
  }
  if (account.type === "Eval" && evalProfitProgress >= 65) {
    return { label: "Passing Pace", severity: "positive" }
  }
  if (drawdownRemaining < maxDrawdown * 0.45) {
    return { label: "Watchful", severity: "elevated" }
  }
  return { label: "Stable", severity: "neutral" }
}

// Progress itself is flat (see components/ui/progress.tsx) — no per-call
// color/gradient override needed here anymore, just the height.
const structuralBarClass = "h-1.5"

const rowLabelClass = "text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider"
const rowValueClass = "font-mono text-[10px] font-medium tabular-nums text-[var(--text)]"

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
  const qty = getAccountQuantity(account)
  const startingBalance = getRuleStartingBalance(account)
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
    minPayoutBalanceTarget != null ? minPayoutBalanceTarget - startingBalance : null

  const paMinBalanceProgress =
    minPayoutBalanceTarget != null
      ? payoutSpan != null && payoutSpan > 0
        ? Math.min(
            100,
            Math.max(0, ((stats.currentBalance - startingBalance) / payoutSpan) * 100)
          )
        : stats.currentBalance >= minPayoutBalanceTarget
          ? 100
          : 0
      : 0

  const remainingToMinPayoutBalance =
    minPayoutBalanceTarget != null ? Math.max(0, minPayoutBalanceTarget - stats.currentBalance) : null

  const lucidEligibility =
    (account.firm === "Lucid" || account.firm === "Tradeify") &&
    account.type === "PA" &&
    rules.hasPayouts
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
      (rules.minBalanceToRequest > 0 && rules.minBalanceToRequest > startingBalance))

  const drawdownLabel = account.drawdownType === "EOD" ? "EOD Drawdown" : "Intraday Drawdown"
  const drawdownCritical = stats.drawdownRemaining <= account.maxDrawdown * 0.2
  const drawdownElevated = !drawdownCritical && stats.drawdownRemaining <= account.maxDrawdown * 0.5

  // Apex PA eligibility for "Locked In" badge
  const apexPayoutEligibility =
    account.firm === "Apex" && account.type === "PA" && rules.hasPayouts
      ? getPayoutEligibility(account.id, trades, account, payouts)
      : null

  const isPayoutEligible =
    (lucidEligibility?.isEligible ?? false) ||
    (apexPayoutEligibility?.isEligible ?? false) ||
    (lucidEligibility?.firm === "Tradeify" && lucidEligibility.isEligible)

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
    isPayoutEligible,
  })

  const tenure = getAccountTenure(account, trades, stats.tradingDays)
  const insight = getAccountCardInsight({
    account,
    trades,
    payouts,
    tradingDays: stats.tradingDays,
    totalPnL: stats.totalPnL,
    drawdownRemaining: stats.drawdownRemaining,
    currentBalance: stats.currentBalance,
  })

  return (
    <Card
      className={cn(
        "relative p-3.5 sm:p-6 glass-card glass-card-hover account-card-hover rounded-[24px] cursor-pointer group",
        "transition-all active:scale-[0.992] active:shadow-none",
        // Severity is expressed as a left-edge accent whose WIDTH scales with
        // severity — never its hue. Positive/neutral states add no accent at
        // all; the flat hairline border (from .glass-card) is enough.
        health.severity === "critical" && "border-l-4 border-l-[var(--text)]",
        health.severity === "elevated" && "border-l-2 border-l-[var(--text)]",
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
        className="absolute top-5 right-5 h-5 w-5 text-[var(--faint)] group-hover:text-[var(--muted-foreground)] transition-colors pointer-events-none"
        aria-hidden
      />

      {/* Health badge — structural severity: icon + weight/case, no hue */}
      <span
        className={cn(
          "absolute top-12 right-5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[2px] border tabular-nums pointer-events-none",
          "border-[var(--hairline)] bg-[var(--raised)]",
          health.severity === "critical" && "font-bold uppercase tracking-wider text-[var(--text)]",
          health.severity === "elevated" && "font-semibold tracking-wide text-[var(--text)]",
          health.severity === "positive" && "font-medium tracking-wide text-[var(--text)]",
          health.severity === "neutral" && "font-normal tracking-wide text-[var(--muted-foreground)]",
        )}
      >
        {health.severity === "critical" && <AlertTriangle className="h-2.5 w-2.5" aria-hidden />}
        {health.severity === "elevated" && <AlertTriangle className="h-2.5 w-2.5 opacity-60" aria-hidden />}
        {health.severity === "positive" && <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />}
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
      <div className="mb-3 sm:mb-4 pr-[76px]">
        <h3 className="font-semibold text-base sm:text-lg truncate text-[var(--text)]">{account.name}</h3>
        {qty > 1 && (
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            {formatAccountBundleHelper(account)}
          </p>
        )}
        {/* Badge row — every tag renders on the same neutral surface now.
            Firm / program / type / drawdown / status differ in label only,
            never in hue. Status keeps a weight bump on Breached, matching
            the severity system above (structural emphasis, not color). */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <AccountQuantityBadge account={account} />
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 premium-pill border-[var(--hairline)] text-[var(--muted-foreground)] bg-[var(--raised)]">
            {account.firm ?? "Apex"}
          </Badge>
          {account.firm === "Tradeify" && resolveTradeifyProgram(account) && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 premium-pill border-[var(--hairline)] text-[var(--muted-foreground)] bg-[var(--raised)]">
              {tradeifyProgramLabel(resolveTradeifyProgram(account)!)}
            </Badge>
          )}
          {account.firm !== "Tradeify" && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 premium-pill border-[var(--hairline)] text-[var(--muted-foreground)] bg-[var(--raised)]">
              {account.type}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 premium-pill border-[var(--hairline)] text-[var(--muted-foreground)] bg-[var(--raised)]">
            {account.drawdownType ?? "EOD"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 premium-pill border-[var(--hairline)] bg-[var(--raised)]",
              account.status === "Breached"
                ? "font-bold text-[var(--text)]"
                : "text-[var(--muted-foreground)]",
            )}
          >
            {account.status}
          </Badge>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {/* Balance & PnL — Net PnL is the one place color is allowed: it is
            a signed figure. Balance itself carries no color. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">Balance</div>
            <div className="text-lg sm:text-2xl font-semibold font-mono tracking-tight text-[var(--text)]">
              ${fmtMoney(stats.currentBalance)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">Net PnL</div>
            <div
              className="text-lg sm:text-2xl font-semibold font-mono tracking-tight"
              style={{ color: stats.totalPnL >= 0 ? "var(--gain)" : "var(--loss)" }}
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
              <span className={cn(rowValueClass, evalPassed && "font-bold")}>
                {evalPassed
                  ? "Passed"
                  : `${fmtMoney(Math.max(0, stats.totalPnL))} / ${fmtMoney(effectiveProfitTarget)}`}
              </span>
            </div>
            <Progress value={evalPassed ? 100 : evalProfitProgress} className={structuralBarClass} />
          </div>
        )}

        {/* Main goal — Apex PA */}
        {account.type === "PA" && account.firm === "Apex" && minPayoutBalanceTarget != null && (
          <div>
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className={rowLabelClass}>Min Payout Balance</span>
              <span className={cn(rowValueClass, remainingToMinPayoutBalance === 0 && "font-bold")}>
                {remainingToMinPayoutBalance !== null ? `$${fmtMoney(remainingToMinPayoutBalance)} remaining` : "—"}
              </span>
            </div>
            <Progress value={paMinBalanceProgress} className={structuralBarClass} />
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
                <span className={cn(rowValueClass, lucidEligibility.isEligible && "font-bold")}>
                  {lucidEligibility.isEligible
                    ? "Eligible"
                    : `${fmtMoney(Math.max(0, lucidEligibility.cycleProfit))} / ${fmtMoney(lucidCycleThreshold)}`}
                </span>
              </div>
              <Progress value={lucidCycleProgress} className={structuralBarClass} />
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
                  : rules.minBalanceToRequest > startingBalance
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          ((stats.currentBalance - startingBalance) /
                            (rules.minBalanceToRequest - startingBalance)) *
                            100
                        )
                      )
                    : 0
              }
              className={structuralBarClass}
            />
          </div>
        )}

        {/* Drawdown — the shrinking bar length IS the risk signal (position/
            size). Weight (bold + icon) reinforces it at the critical tier.
            No color anywhere in this row. */}
        <div>
          <div className="flex justify-between items-baseline gap-2 mb-1">
            <span className={rowLabelClass}>{drawdownLabel}</span>
            <span
              className={cn(
                rowValueClass,
                "inline-flex items-center gap-1",
                (drawdownCritical || drawdownElevated) && "font-bold",
              )}
            >
              {drawdownCritical && <AlertTriangle className="h-2.5 w-2.5" aria-hidden />}
              ${fmtMoney(Math.max(0, stats.drawdownRemaining))} / ${fmtMoney(account.maxDrawdown)}
            </span>
          </div>
          <Progress
            value={Math.max(0, (stats.drawdownRemaining / account.maxDrawdown) * 100)}
            className={structuralBarClass}
          />
        </div>

        {/* Tenure + insight */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-[var(--faint)] font-medium tabular-nums tracking-wide">
            {tenure.daysOwned != null ? `Owned ${tenure.daysOwned}d` : "Owned —"}
            {" · "}
            Traded {tenure.daysTraded}d
          </p>
          <AccountCardInsightBanner insight={insight} />
        </div>

        {/* PA consistency summary — filled vs outline icon replaces the
            colored dot; no red/amber/emerald. Every number below reads from
            getAccountRules()/getConsistencyInfo(); this used to hardcode "5"
            and "50%", which was only ever correct for Apex — Topstep's
            consistency path (3 trading days, 40%) and Alpha (40%, 5 winning
            days at $200+) rendered the wrong numbers on every PA card. */}
        {account.type === "PA" && consistencyInfo && (
          <div className="flex items-center gap-4 pt-2 border-t border-[var(--hairline)]">
            {rules.minProfitDays > 0 ? (
              <div className="flex items-center gap-1.5">
                {consistencyInfo.daysWithMinProfit >= rules.minProfitDays
                  ? <CheckCircle2 className="h-3 w-3 text-[var(--text)]" aria-hidden />
                  : <Circle className="h-3 w-3 text-[var(--faint)]" aria-hidden />}
                <span className="text-xs text-[var(--muted-foreground)]">
                  {consistencyInfo.daysWithMinProfit}/{rules.minProfitDays} Days (${rules.minDailyProfit}+)
                </span>
              </div>
            ) : rules.minTradingDays > 0 ? (
              <div className="flex items-center gap-1.5">
                {stats.tradingDays >= rules.minTradingDays
                  ? <CheckCircle2 className="h-3 w-3 text-[var(--text)]" aria-hidden />
                  : <Circle className="h-3 w-3 text-[var(--faint)]" aria-hidden />}
                <span className="text-xs text-[var(--muted-foreground)]">
                  {stats.tradingDays}/{rules.minTradingDays} Trading Days
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              {consistencyInfo.isValid
                ? <CheckCircle2 className="h-3 w-3 text-[var(--text)]" aria-hidden />
                : <AlertTriangle className="h-3 w-3 text-[var(--text)]" aria-hidden />}
              <span className={cn("text-xs text-[var(--muted-foreground)]", !consistencyInfo.isValid && "font-semibold text-[var(--text)]")}>
                {consistencyInfo.isValid ? "Consistent" : `${rules.consistencyPercent}% Violated`}
              </span>
            </div>
          </div>
        )}

        {/* Lucid PA: scaling (only when program includes scaling tiers) */}
        {account.firm === "Lucid" && account.type === "PA" && rules.hasScaling && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--hairline)]">
            <Circle className="h-3 w-3 text-[var(--faint)]" aria-hidden />
            <span className="text-xs text-[var(--muted-foreground)]">Scaling Plan Active</span>
          </div>
        )}

        {onActivatePa && (
          <div className="pt-3 border-t border-[var(--hairline)] flex justify-end">
            {/* Default Button variant is already flat white/black per CLAUDE.md. */}
            <Button
              type="button"
              size="sm"
              className="text-xs"
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
