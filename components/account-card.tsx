"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency, formatPercent, formatPnL, pnlColor } from "@/lib/utils"
import type { Account, Trade, Payout, InstrumentSpec, RiskProfile } from "@/lib/types"
import {
  calculateAccountStats,
  getConsistencyInfo,
  getPayoutEligibility,
} from "@/lib/storage"
import { applyIntradayManualDrawdownToStats } from "@/lib/intraday-manual-drawdown"
import { getAccountRules, resolveTradeifyProgram } from "@/lib/rules"
import { resolveRiskProfile, getHeadroom } from "@/lib/headroom"
import { tradeifyProgramLabel } from "@/lib/tradeify-rules"
import { getAccountQuantity, getRuleStartingBalance } from "@/lib/account-quantity"
import { localTodayKey, parseLocalDate } from "@/lib/date-utils"
import {
  AT_RISK_DRAWDOWN_FRACTION,
  isAccountBreached,
  lastEffectiveTradeDate,
} from "@/lib/accounts-overview"
import { InfoHint } from "@/components/info-hint"
import { ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react"
import { AccountCardInsightBanner } from "@/components/account-card-insight-banner"
import {
  getAccountCardInsight,
  getAccountTenure,
} from "@/lib/account-card-insight"
import { format } from "date-fns"

interface AccountCardProps {
  account: Account
  trades: Trade[]
  payouts: Payout[]
  onClick?: () => void
  /** Shown for passed evals that have not been activated yet */
  onActivatePa?: () => void
  /** Dropdown menu rendered in top-right, fades in on hover */
  menuSlot?: React.ReactNode
  /** Headroom-in-trades inputs — optional so existing callers/tests degrade
   *  to dollars-only display rather than needing to thread these through
   *  everywhere immediately. See lib/headroom.ts. */
  instrumentSpecs?: InstrumentSpec[]
  userDefaultRiskProfile?: RiskProfile | null
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
  if (drawdownRemaining < maxDrawdown * AT_RISK_DRAWDOWN_FRACTION) {
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

function formatSizeK(accountSize: number): string {
  return accountSize >= 1000
    ? `${Math.round(accountSize / 1000)}K`
    : String(accountSize)
}

/** Compact identity line — firm, size, program/type. Not a pill row. */
function accountIdentity(account: Account): string {
  const qty = getAccountQuantity(account)
  const firm = account.firm ?? "Apex"
  const size = formatSizeK(account.accountSize)
  const tradeify = firm === "Tradeify" ? resolveTradeifyProgram(account) : null
  const program = tradeify
    ? tradeifyProgramLabel(tradeify)
    : account.type
  const tier =
    firm === "Alpha" && account.alphaTier
      ? account.alphaTier.charAt(0).toUpperCase() + account.alphaTier.slice(1)
      : null

  const bits = [
    qty > 1 ? `${qty}×` : null,
    firm,
    tier,
    size,
    program,
  ].filter(Boolean)
  return bits.join(" ")
}

/** Identity is hidden when it would just repeat the title. Quantity, a
 *  Tradeify program, an Alpha tier, or a renamed account make it useful. */
function identityAddsInfo(account: Account): boolean {
  return accountIdentity(account) !== account.name.trim()
}

export function AccountCard({
  account,
  trades,
  payouts,
  onClick,
  onActivatePa,
  menuSlot,
  instrumentSpecs = [],
  userDefaultRiskProfile = null,
}: AccountCardProps) {
  const rawStats = calculateAccountStats(account, trades, payouts)
  const stats = applyIntradayManualDrawdownToStats(account, rawStats)
  const headroom = getHeadroom(
    stats.drawdownRemaining,
    resolveRiskProfile(account, userDefaultRiskProfile, instrumentSpecs),
  )
  const rules = getAccountRules(account)
  const consistencyInfo = account.type === "PA" && rules.hasConsistency
    ? getConsistencyInfo(account.id, trades, account, payouts)
    : null

  const effectiveProfitTarget = rules.hasProfitTarget ? rules.profitTarget : undefined

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

  const remainingToMinPayoutBalance =
    minPayoutBalanceTarget != null ? Math.max(0, minPayoutBalanceTarget - stats.currentBalance) : null

  const payoutEligibility =
    account.type === "PA" && rules.hasPayouts
      ? getPayoutEligibility(account.id, trades, account, payouts)
      : null

  const isPayoutEligible = payoutEligibility?.isEligible ?? false

  const health = getAccountHealth({
    account,
    isSafe: stats.isSafe,
    drawdownRemaining: stats.drawdownRemaining,
    maxDrawdown: rules.maxDrawdown,
    totalPnL: stats.totalPnL,
    evalPassed,
    evalProfitProgress,
    consistencyValid: consistencyInfo ? consistencyInfo.isValid : null,
    hasConsistency: rules.hasConsistency,
    remainingToMinPayout: remainingToMinPayoutBalance,
    lucidEligible: payoutEligibility?.isEligible ?? false,
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

  const floorVal = stats.activeEodFloor ?? stats.minBalance
  const maxDrawdown = rules.maxDrawdown
  const isBreached = isAccountBreached(account, stats.isSafe)
  const startingBalance = getRuleStartingBalance(account)
  const evalTargetBalance =
    account.type === "Eval" && effectiveProfitTarget != null && effectiveProfitTarget > 0
      ? startingBalance + effectiveProfitTarget
      : null
  const evalTrackSpan =
    evalTargetBalance != null ? evalTargetBalance - floorVal : 0
  const evalBalancePct =
    evalTargetBalance != null && evalTrackSpan > 0
      ? Math.min(100, Math.max(0, ((stats.currentBalance - floorVal) / evalTrackSpan) * 100))
      : 0
  const fundedFillPct =
    maxDrawdown > 0
      ? Math.min(100, Math.max(0, (stats.drawdownRemaining / maxDrawdown) * 100))
      : 0
  const showIdentity = identityAddsInfo(account)

  const lastLogDate = lastEffectiveTradeDate(account, trades)
  const isStale =
    tenure.daysOwned != null &&
    tenure.daysOwned > 1 &&
    lastLogDate !== localTodayKey()

  return (
    <Card
      className={cn(
        "group relative h-full cursor-pointer rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--faint)] hover:bg-[var(--raised)] sm:p-6",
        "active:bg-[var(--raised)]",
        health.severity === "critical" && "border-l-4 border-l-[var(--text)]",
        health.severity === "elevated" && "border-l-2 border-l-[var(--text)]",
      )}
      onClick={onClick}
    >
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="min-w-0 truncate text-base font-semibold tracking-[-0.02em] text-[var(--text)] sm:text-lg">{account.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {menuSlot && <span onClick={(event) => event.stopPropagation()}>{menuSlot}</span>}
          <ChevronRight className="h-4 w-4 text-[var(--faint)] transition-colors group-hover:text-white" aria-hidden />
        </div>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-2 py-1 text-[9px] tracking-[0.08em]",
            health.severity === "critical" && "font-bold uppercase text-white",
            health.severity === "elevated" && "font-semibold text-white",
            health.severity === "positive" && "font-medium text-white",
            health.severity === "neutral" && "text-[var(--muted-foreground)]",
          )}>
            {health.severity === "critical" && <AlertTriangle className="h-2.5 w-2.5" aria-hidden />}
            {health.severity === "elevated" && <AlertTriangle className="h-2.5 w-2.5 opacity-60" aria-hidden />}
            {health.severity === "positive" && <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />}
            {health.label}
          </span>
          <p className="flex min-w-0 items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
            {showIdentity && <span className="truncate">{accountIdentity(account)} · </span>}
            <span className="shrink-0">{account.drawdownType ?? "EOD"}</span>
            <InfoHint topic="drawdownType" firm={account.firm} />
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {isBreached ? (
          <p className="text-sm leading-relaxed text-[var(--text)]">
            This account is breached — stop trading it and contact {account.firm ?? "Apex"}.
          </p>
        ) : (
          <>
        {/* Headroom hero — trade count when a profile resolves, dollars otherwise.
            Never invent a trade count. Net PnL is the only signed/colored figure. */}
        <div className="grid grid-cols-2 gap-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                Headroom
              </span>
              <InfoHint topic="headroom" firm={account.firm} />
            </div>
            {headroom.trades != null ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-medium tabular-nums tracking-[-0.05em] text-[var(--text)]">
                    {headroom.trades}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {headroom.trades === 1 ? "trade" : "trades"}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
                  {formatCurrency(headroom.dollars)} of room
                </p>
              </>
            ) : (
              <div className="font-mono text-3xl font-medium tabular-nums tracking-[-0.05em] text-[var(--text)]">
                {formatCurrency(headroom.dollars)}
              </div>
            )}
          </div>
          <div className="min-w-0 border-l border-[var(--hairline)] pl-5">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Net PnL
            </div>
            <div
              className="font-mono text-xl font-medium tabular-nums tracking-[-0.04em]"
              style={{ color: pnlColor(stats.totalPnL) }}
            >
              {formatPnL(stats.totalPnL)}
            </div>
          </div>
        </div>

        {/* Floor line. Eval: floor → target, square = balance. Funded: floor → balance. */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                Floor
              </span>
              <InfoHint topic="floor" firm={account.firm} />
            </span>
            {evalTargetBalance != null && (
              <span className="font-mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {formatPercent(evalProfitProgress)} to target
              </span>
            )}
          </div>
          {evalTargetBalance != null ? (
            <>
              <div
                className="relative h-1.5 rounded-full bg-[var(--hairline)]"
                role="img"
                aria-label={`Floor ${formatCurrency(floorVal)}, balance ${formatCurrency(stats.currentBalance)}, target ${formatCurrency(evalTargetBalance)}`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                  style={{ width: `${evalBalancePct}%` }}
                />
                <div className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--text)]" />
                <div className="absolute right-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--text)]" />
                <div
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text)]"
                  style={{ left: `${evalBalancePct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                <span>{formatCurrency(floorVal)}</span>
                <span>{formatCurrency(evalTargetBalance)}</span>
              </div>
            </>
          ) : (
            <>
              <div
                className="relative h-1.5 rounded-full bg-[var(--hairline)]"
                role="img"
                aria-label={`Floor ${formatCurrency(floorVal)}, balance ${formatCurrency(stats.currentBalance)}`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                  style={{ width: `${fundedFillPct}%` }}
                />
                <div className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--text)]" />
                <div
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text)]"
                  style={{ left: `${fundedFillPct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                <span>{formatCurrency(floorVal)}</span>
                <span>{formatCurrency(stats.currentBalance)}</span>
              </div>
            </>
          )}
        </div>
          </>
        )}

        <div className="space-y-2 border-t border-[var(--hairline)] pt-4">
          <AccountCardInsightBanner insight={insight} />
          <p className="text-[10px] font-medium tabular-nums tracking-wide text-[var(--faint)]">
            {tenure.daysOwned != null ? `Owned ${tenure.daysOwned}d` : "Owned —"}
            {" · "}
            Traded {tenure.daysTraded}d
          </p>
          {isStale && !isBreached && (
            <p className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
              Last log{" "}
              {lastLogDate
                ? format(parseLocalDate(lastLogDate), "MMM d")
                : "—"}
              <InfoHint topic="staleness" firm={account.firm} />
            </p>
          )}
        </div>

        {onActivatePa && (
          <div className="flex justify-end border-t border-[var(--hairline)] pt-3">
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
