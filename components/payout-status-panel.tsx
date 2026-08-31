"use client"

import { useMemo, useState } from "react"
import { Check, Circle, DollarSign, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAccountRules } from "@/lib/rules"
import { localTodayKey, parseLocalDate } from "@/lib/date-utils"
import type { Account, Payout } from "@/lib/types"

interface PayoutEligibility {
  isEligible: boolean
  firm: "Apex" | "Lucid" | "Tradeify" | "Topstep" | "Alpha"
  tradeifyProgram?: "select_flex" | "select_daily"
  topstepPayoutPath?: "standard" | "consistency"
  missingConditions: string[]
  availableToWithdraw: number
  maxWithdrawable: number
  payoutCount: number
  maxPayouts: number
  minPayoutAmount: number
  conditions?: Record<string, boolean>
  maxPayoutAllowed?: number
  currentPayoutTier?: number
  safetyNet?: number
  consistencyInfo?: {
    daysWithMinProfit: number
    isValid: boolean
    largestWinningDay: number
    totalProfit: number
    maxAllowedDay: number
    additionalProfitNeeded: number
  }
  stats?: {
    currentBalance: number
    tradingDays: number
  }
  lucidPayoutCapKnown?: boolean
  cycleProfit?: number
  cycleProfitDays?: number
  minProfitDays?: number
  minDailyProfit?: number
  payoutMaxPercent?: number
  payoutAbsoluteCap?: number
  payoutSplit?: number
  traderReceives?: number
  lucidSplit?: number
  winningDays?: number
  totalProfitForPayout?: number
  bufferAmount?: number
  bufferLine?: number
  aboveBuffer?: number
  continuityMax?: number
  payoutsThisMonth?: number
  maxPayoutsPerMonth?: number
}

interface PayoutStatusPanelProps {
  account: Account
  eligibility: PayoutEligibility
  payouts: Payout[]
  onAddPayout: (payout: { date: string; amount: number; notes?: string }) => void
}

interface Requirement {
  label: string
  value: string
  met?: boolean
  detail?: string
}

function money(value: number, decimals = 2) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`
  if (value < 0) return `−${money(Math.abs(value))}`
  return money(0)
}

function finiteOrUnavailable(value: number | undefined, formatter: (n: number) => string = money) {
  return value != null && Number.isFinite(value) ? formatter(value) : "Unavailable"
}

function RequirementRow({ requirement }: { requirement: Requirement }) {
  const Icon = requirement.met == null ? Minus : requirement.met ? Check : Circle
  const stateLabel = requirement.met == null ? "Unavailable" : requirement.met ? "Met" : "Remaining"

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[var(--hairline)] py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-[var(--text)]">{requirement.label}</p>
        {requirement.detail && <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{requirement.detail}</p>}
      </div>
      <div className="text-right">
        <p className="font-mono text-xs text-[var(--text)]">{requirement.value}</p>
        <span className="mt-1 inline-flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
          <Icon className="h-3 w-3" aria-hidden />
          {stateLabel}
        </span>
      </div>
    </div>
  )
}

function buildRequirements(
  account: Account,
  eligibility: PayoutEligibility,
  rules: ReturnType<typeof getAccountRules>,
): Requirement[] {
  const conditions = eligibility.conditions ?? {}
  const requirements: Requirement[] = []
  const countValue = (current: number | undefined, required: number | undefined) =>
    current == null || required == null ? "Unavailable" : `${current} / ${required}`

  if (eligibility.firm === "Apex") {
    requirements.push({
      label: "Qualifying days",
      value: countValue(eligibility.consistencyInfo?.daysWithMinProfit, rules.minProfitDays),
      met: conditions.hasEnoughProfitDays,
      detail: rules.minDailyProfit > 0 ? `${money(rules.minDailyProfit, 0)}+ net profit per qualifying day` : undefined,
    })
    if (rules.hasConsistency) {
      const hasActivity = (eligibility.stats?.tradingDays ?? 0) > 0
      requirements.push({
        label: "Consistency",
        value: hasActivity ? `${rules.consistencyPercent}% maximum day` : "Not evaluated",
        met: hasActivity ? conditions.isConsistent : undefined,
        detail: hasActivity && !conditions.isConsistent && eligibility.consistencyInfo?.additionalProfitNeeded
          ? `${money(eligibility.consistencyInfo.additionalProfitNeeded)} additional profit needed`
          : "Evaluated from net profit in the active payout period",
      })
    }
    if (rules.minBalanceToRequest > 0) {
      requirements.push({
        label: "Minimum request balance",
        value: `${finiteOrUnavailable(eligibility.stats?.currentBalance)} / ${money(rules.minBalanceToRequest)}`,
        met: conditions.hasMinBalance,
      })
    }
  }

  if (eligibility.firm === "Lucid") {
    requirements.push({
      label: "Profit days this cycle",
      value: countValue(eligibility.cycleProfitDays, eligibility.minProfitDays),
      met: conditions.hasEnoughProfitDays,
      detail: eligibility.minDailyProfit != null ? `${money(eligibility.minDailyProfit, 0)}+ net profit per day` : undefined,
    })
    requirements.push({
      label: "Cycle profit",
      value: finiteOrUnavailable(eligibility.cycleProfit, signedMoney),
      met: conditions.hasPositiveCycleProfit,
    })
    requirements.push({
      label: "Verified payout cap",
      value: eligibility.lucidPayoutCapKnown ? finiteOrUnavailable(eligibility.payoutAbsoluteCap) : "Unavailable",
      met: eligibility.lucidPayoutCapKnown ? true : undefined,
    })
  }

  if (eligibility.firm === "Tradeify" && eligibility.tradeifyProgram === "select_flex") {
    requirements.push({
      label: "Winning days this cycle",
      value: countValue(eligibility.winningDays, eligibility.minProfitDays),
      met: conditions.hasEnoughWinningDays,
      detail: eligibility.minDailyProfit != null ? `${money(eligibility.minDailyProfit, 0)}+ net profit per winning day` : undefined,
    })
    requirements.push({
      label: "Cycle profit",
      value: finiteOrUnavailable(eligibility.cycleProfit, signedMoney),
      met: conditions.hasPositiveCycleProfit,
    })
  }

  if (eligibility.firm === "Tradeify" && eligibility.tradeifyProgram === "select_daily") {
    requirements.push({
      label: "Balance above buffer",
      value: finiteOrUnavailable(eligibility.aboveBuffer),
      met: conditions.isAboveBuffer,
      detail: eligibility.bufferLine != null ? `Buffer line ${money(eligibility.bufferLine)}` : undefined,
    })
    requirements.push({
      label: "Cycle profit",
      value: finiteOrUnavailable(eligibility.cycleProfit, signedMoney),
      met: conditions.hasPositiveCycleProfit,
    })
  }

  if (eligibility.firm === "Topstep") {
    const consistencyPath = eligibility.topstepPayoutPath === "consistency"
    requirements.push({
      label: consistencyPath ? "Trading days since payout" : "Winning days since payout",
      value: countValue(
        consistencyPath ? eligibility.cycleProfitDays : eligibility.winningDays,
        eligibility.minProfitDays,
      ),
      met: consistencyPath ? conditions.hasEnoughTradingDays : conditions.hasEnoughWinningDays,
      detail: !consistencyPath && eligibility.minDailyProfit != null
        ? `${money(eligibility.minDailyProfit, 0)}+ net profit per winning day`
        : undefined,
    })
    if (consistencyPath) {
      const hasActivity = (eligibility.stats?.tradingDays ?? 0) > 0
      requirements.push({
        label: "Consistency",
        value: hasActivity ? `${rules.consistencyPercent}% maximum day` : "Not evaluated",
        met: hasActivity ? conditions.isConsistent : undefined,
      })
    } else {
      requirements.push({
        label: "Profit since prior payout",
        value: eligibility.payoutCount === 0 ? "First request" : finiteOrUnavailable(eligibility.cycleProfit, signedMoney),
        met: conditions.isProfitableSinceLastPayout,
      })
    }
  }

  if (eligibility.firm === "Alpha") {
    requirements.push({
      label: "Winning days this cycle",
      value: countValue(eligibility.winningDays, eligibility.minProfitDays),
      met: conditions.hasEnoughWinningDays,
      detail: eligibility.minDailyProfit != null ? `${money(eligibility.minDailyProfit, 0)}+ net profit per winning day` : undefined,
    })
    if (rules.hasConsistency) {
      const hasActivity = (eligibility.stats?.tradingDays ?? 0) > 0
      requirements.push({
        label: "Consistency",
        value: hasActivity ? `${rules.consistencyPercent}% maximum day` : "Not evaluated",
        met: hasActivity ? conditions.isConsistent : undefined,
      })
    }
    requirements.push({
      label: "Monthly requests",
      value: countValue(eligibility.payoutsThisMonth, eligibility.maxPayoutsPerMonth),
      met: conditions.hasPayoutsRemainingThisMonth,
      detail: "Resets at the start of each calendar month",
    })
  }

  requirements.push({
    label: "Minimum payout",
    value: `${finiteOrUnavailable(eligibility.maxWithdrawable)} / ${money(eligibility.minPayoutAmount)}`,
    met: conditions.hasMinWithdrawable,
  })

  if (eligibility.maxPayouts < 90) {
    requirements.push({
      label: "Payout requests used",
      value: `${eligibility.payoutCount} / ${eligibility.maxPayouts}`,
      met: conditions.hasPayoutsRemaining,
    })
  }

  return requirements
}

function payoutContext(eligibility: PayoutEligibility) {
  if (eligibility.firm === "Tradeify") {
    return eligibility.tradeifyProgram === "select_daily" ? "Select Daily" : "Select Flex"
  }
  if (eligibility.firm === "Topstep") {
    return eligibility.topstepPayoutPath === "consistency" ? "Consistency path" : "Standard path"
  }
  if (eligibility.firm === "Alpha") return "Qualified account"
  if (eligibility.firm === "Lucid") return "Cycle payout"
  return "Safety-net payout"
}

export function PayoutStatusPanel({ account, eligibility, payouts, onAddPayout }: PayoutStatusPanelProps) {
  const rules = getAccountRules(account)
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ date: localTodayKey(), amount: "", notes: "" })
  const [error, setError] = useState<string | null>(null)

  const requirements = useMemo(
    () => buildRequirements(account, eligibility, rules),
    [account, eligibility, rules],
  )
  const maxedOut = eligibility.maxPayouts < 90 && eligibility.payoutCount >= eligibility.maxPayouts
  const valueKnown = !(eligibility.firm === "Lucid" && eligibility.lucidPayoutCapKnown === false)
  const canRequest = eligibility.isEligible && !maxedOut && valueKnown
  const totalPayouts = payouts.reduce((sum, payout) => sum + payout.amount, 0)
  const split = eligibility.payoutSplit ?? rules.payoutSplit
  const netEstimate = eligibility.traderReceives

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const amount = Number(formData.amount)
    if (!canRequest) {
      setError(valueKnown ? "Current payout requirements are not complete." : "Payout amount is unavailable until the firm cap is verified.")
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payout amount.")
      return
    }
    if (amount < eligibility.minPayoutAmount) {
      setError(`Minimum payout is ${money(eligibility.minPayoutAmount)}.`)
      return
    }
    if (amount > eligibility.maxWithdrawable) {
      setError(`Maximum available is ${money(eligibility.maxWithdrawable)}.`)
      return
    }

    onAddPayout({
      date: formData.date,
      amount,
      notes: formData.notes.trim() || undefined,
    })
    setFormData({ date: localTodayKey(), amount: "", notes: "" })
    setOpen(false)
  }

  const statusTitle = maxedOut
    ? "Payout sequence complete"
    : canRequest
      ? "Ready to request"
      : valueKnown
        ? "Requirements remaining"
        : "Payout data unavailable"

  return (
    <Card className="self-start rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Withdrawal readiness</p>
          <h2 className="mt-1 text-lg font-medium tracking-[-0.02em]">Payout status</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{eligibility.firm} · {payoutContext(eligibility)}</p>
        </div>
        <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null) }}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!canRequest} className="rounded-[2px]">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Log payout
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Log payout</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payout-date">Payout date</Label>
                <Input id="payout-date" type="date" value={formData.date} onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-amount">Gross amount</Label>
                <Input id="payout-amount" type="number" inputMode="decimal" min={eligibility.minPayoutAmount} max={eligibility.maxWithdrawable} step="0.01" placeholder="0.00" value={formData.amount} onChange={(event) => { setFormData((current) => ({ ...current, amount: event.target.value })); setError(null) }} className="font-mono" />
                <p className="text-[11px] text-[var(--muted)]">Available range: {money(eligibility.minPayoutAmount)}–{money(eligibility.maxWithdrawable)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-notes">Notes <span className="text-[var(--muted)]">optional</span></Label>
                <Input id="payout-notes" value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} placeholder="Request reference or note" />
              </div>
              {error && <p role="alert" className="border-l-2 border-white pl-3 text-sm text-[var(--text)]">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Log payout</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className={`${canRequest ? "border-l-2" : "border-l-4"} mt-5 border-white bg-[var(--raised)] p-3`}>
        <p className="text-sm font-medium">{statusTitle}</p>
        {!canRequest && eligibility.missingConditions.length > 0 && valueKnown && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{eligibility.missingConditions.join(" · ")}</p>
        )}
        {!valueKnown && <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">A verified payout cap is not available for this account configuration.</p>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--hairline)]">
        <div className="bg-[var(--raised)] p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Available gross</p>
          <p className="mt-1 font-mono text-xl font-medium">{valueKnown ? money(eligibility.maxWithdrawable) : "Unavailable"}</p>
        </div>
        <div className="bg-[var(--raised)] p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Estimated net</p>
          <p className="mt-1 font-mono text-xl font-medium">{valueKnown ? finiteOrUnavailable(netEstimate) : "Unavailable"}</p>
          {split < 1 && <p className="mt-1 text-[10px] text-[var(--muted)]">{Math.round(split * 100)}% trader share</p>}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Requirements</h3>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Live rules</span>
        </div>
        <div className="mt-2 border-y border-[var(--hairline)]">
          {requirements.map((requirement) => <RequirementRow key={requirement.label} requirement={requirement} />)}
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--hairline)] pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Payout history</h3>
            <p className="mt-1 text-[11px] text-[var(--muted)]">{payouts.length} recorded · {money(totalPayouts)} gross</p>
          </div>
          <DollarSign className="h-4 w-4 text-[var(--muted)]" aria-hidden />
        </div>
        {payouts.length > 0 ? (
          <div className="mt-3 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {[...payouts]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((payout) => (
                <div key={payout.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs">Payout {payout.payoutNumber}</p>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">{parseLocalDate(payout.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{money(payout.amount)}</p>
                    {payout.traderReceived != null && <p className="mt-1 text-[10px] text-[var(--muted)]">Net {money(payout.traderReceived)}</p>}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="mt-3 border border-[var(--hairline)] bg-[var(--raised)] p-3 text-xs leading-relaxed text-[var(--muted)]">No payouts recorded. Once a request is approved, log it here so balance and future payout cycles stay accurate.</p>
        )}
      </div>
    </Card>
  )
}
