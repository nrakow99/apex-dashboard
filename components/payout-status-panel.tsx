"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Plus,
  Shield,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Account, Payout } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { getAccountRules } from "@/lib/rules"
import { isApexPaConsistency } from "@/lib/storage"
import { localTodayKey, parseLocalDate } from "@/lib/date-utils"

// ─── Shared prop types ────────────────────────────────────────────────────────

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

  // Apex
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
    floorPeakBalance?: number
    activeEodFloor?: number
  }

  // Lucid
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

  // Tradeify
  winningDays?: number
  totalProfitForPayout?: number
  bufferAmount?: number
  bufferLine?: number
  aboveBuffer?: number
  continuityMax?: number
}

interface PayoutStatusPanelProps {
  account: Account
  eligibility: PayoutEligibility
  payouts: Payout[]
  onAddPayout: (payout: { date: string; amount: number; notes?: string }) => void
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ChecklistRow({
  label,
  value,
  isComplete,
  tooltip,
}: {
  label: string
  value: string
  isComplete: boolean
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-900/50 border border-white/5" title={tooltip}>
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-mono", isComplete ? "text-emerald-500" : "text-amber-500")}>
          {value}
        </span>
        {isComplete
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : <AlertTriangle className="h-4 w-4 text-amber-500" />}
      </div>
    </div>
  )
}

function fmtUsd(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ConsistencyChecklistRow({
  account,
  isConsistent,
  info,
  percent,
}: {
  account: Account
  isConsistent: boolean
  info: NonNullable<PayoutEligibility["consistencyInfo"]>
  percent: number
}) {
  const showDetail = isApexPaConsistency(account)
  const failed = !isConsistent

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        failed
          ? "bg-red-500/[0.08] border-red-500/25"
          : "bg-slate-900/50 border-white/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Consistency Rule ({percent}%)</span>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "text-xs font-semibold",
              failed ? "text-red-400" : "text-emerald-500",
            )}
          >
            {failed ? "Failed" : "Passed"}
          </span>
          {failed ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
        </div>
      </div>
      <p className={cn("text-[10px] mt-0.5", failed ? "text-red-400/80" : "text-muted-foreground")}>
        {failed
          ? info.totalProfit <= 0
            ? "No net profits since last payout"
            : "Largest day exceeds 50% of total profit"
          : "Largest day within 50% limit"}
      </p>
      {showDetail && (
        <div className="mt-1.5 space-y-1.5">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <div className="text-muted-foreground">Largest Day</div>
              <div className={cn("font-mono font-medium", failed && "text-red-400/90")}>
                ${fmtUsd(info.largestWinningDay)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Profit</div>
              <div className="font-mono font-medium">${fmtUsd(info.totalProfit)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Max Allowed</div>
              <div className="font-mono font-medium">${fmtUsd(info.maxAllowedDay)}</div>
            </div>
          </div>
          {failed && info.additionalProfitNeeded > 0 && (
            <div className="text-[10px] text-red-400/90 font-mono">
              Needed profit to restore: ${fmtUsd(info.additionalProfitNeeded)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PayoutStatusPanel({ account, eligibility, payouts, onAddPayout }: PayoutStatusPanelProps) {
  if (eligibility.firm === "Tradeify") {
    if (eligibility.tradeifyProgram === "select_daily") {
      return (
        <TradeifyDailyPayoutPanel
          account={account}
          eligibility={eligibility}
          payouts={payouts}
          onAddPayout={onAddPayout}
        />
      )
    }
    return (
      <TradeifyFlexPayoutPanel
        account={account}
        eligibility={eligibility}
        payouts={payouts}
        onAddPayout={onAddPayout}
      />
    )
  }
  return eligibility.firm === "Lucid"
    ? <LucidPayoutPanel account={account} eligibility={eligibility} payouts={payouts} onAddPayout={onAddPayout} />
    : <ApexPayoutPanel account={account} eligibility={eligibility} payouts={payouts} onAddPayout={onAddPayout} />
}

// ─── Apex Payout Panel ────────────────────────────────────────────────────────

function ApexPayoutPanel({ account, eligibility, payouts, onAddPayout }: PayoutStatusPanelProps) {
  const rules = getAccountRules(account)
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ date: localTodayKey(), amount: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0)
  const isMaxedOut = eligibility.payoutCount >= eligibility.maxPayouts
  const payoutCaps = rules.payoutCaps

  const validatePayout = (amount: number): string | null => {
    if (!eligibility.isEligible) return "Account not yet eligible for payout"
    if (amount < eligibility.minPayoutAmount) return `Minimum payout is $${eligibility.minPayoutAmount}`
    if (eligibility.maxPayoutAllowed && amount > eligibility.maxPayoutAllowed)
      return `Exceeds tier cap ($${eligibility.maxPayoutAllowed.toLocaleString()})`
    if (amount > eligibility.availableToWithdraw)
      return `Exceeds withdrawable balance ($${eligibility.availableToWithdraw.toLocaleString()})`
    if (isMaxedOut) return `All ${eligibility.maxPayouts} payouts used`
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return }
    const err = validatePayout(amount)
    if (err) { setError(err); return }
    onAddPayout({ date: formData.date, amount, notes: formData.notes || undefined })
    toast({ title: "Payout logged", description: `$${amount.toLocaleString()} withdrawal recorded.` })
    setOpen(false)
    setFormData({ date: localTodayKey(), amount: "", notes: "" })
  }

  const safetyNet = eligibility.safetyNet ?? rules.safetyNet
  const safetyNetStatus: "good" | "warning" | "danger" = (() => {
    const diff = (eligibility.stats?.currentBalance ?? 0) - safetyNet
    return diff >= 500 ? "good" : diff >= 0 ? "warning" : "danger"
  })()

  return (
    <Card className="p-2.5 sm:p-4 rounded-[20px] sm:rounded-[24px] glass-card h-fit">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 sm:mb-2.5">
        <h2 className="text-sm sm:text-lg font-semibold">Payout Status</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant={eligibility.isEligible && !isMaxedOut ? "default" : "outline"}
              className={cn(
                "gap-2",
                eligibility.isEligible && !isMaxedOut && "bg-emerald-600 hover:bg-emerald-700",
                (!eligibility.isEligible || isMaxedOut) && "opacity-60"
              )}
            >
              <Plus className="h-4 w-4" />Log Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Log Payout</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-red-500">{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min={eligibility.minPayoutAmount} placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => { setFormData({ ...formData, amount: e.target.value }); setError(null) }}
                  className="bg-background font-mono"
                />
                <div className="text-xs text-muted-foreground">
                  Min: ${eligibility.minPayoutAmount} | Max: ${eligibility.maxWithdrawable.toLocaleString()}
                  {eligibility.currentPayoutTier && (
                    <> | Tier {eligibility.currentPayoutTier} cap: ${(eligibility.maxPayoutAllowed ?? 0).toLocaleString()}</>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="e.g., First payout" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Log Payout</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Eligibility banner */}
      <div className={cn(
        "p-2 rounded-xl mb-2 flex items-start gap-2",
        isMaxedOut ? "bg-[#536878]/10 border border-[#536878]/25" :
        eligibility.isEligible ? "bg-emerald-500/10 border border-emerald-500/30" :
        "bg-amber-500/10 border border-amber-500/30"
      )}>
        {isMaxedOut
          ? <CheckCircle2 className="h-5 w-5 text-[#94AAB8] mt-0.5 shrink-0" />
          : eligibility.isEligible
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            : <XCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        }
        <div>
          <div className={cn(
            "font-semibold text-sm",
            isMaxedOut ? "text-[#94AAB8]" : eligibility.isEligible ? "text-emerald-500" : "text-amber-500"
          )}>
            {isMaxedOut
              ? "Maximum payouts reached"
              : eligibility.isEligible ? "Eligible for Payout" : "Not Yet Eligible"}
          </div>
          {!isMaxedOut && eligibility.payoutCount === eligibility.maxPayouts - 1 && (
            <p className="text-[11px] text-amber-500/90 mt-1">Final payout cycle next</p>
          )}
          {!eligibility.isEligible && !isMaxedOut && eligibility.missingConditions.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {eligibility.missingConditions.map((c, i) => (
                <li key={i} className="text-amber-500/80">• {c}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-1 mb-2">
        {eligibility.conditions && (
          <>
            <ChecklistRow
              label="Qualifying Days"
              value={`${eligibility.consistencyInfo?.daysWithMinProfit ?? 0} / ${rules.minProfitDays}`}
              isComplete={eligibility.conditions.hasEnoughProfitDays}
              tooltip={`$${rules.minDailyProfit}+ daily profit per day`}
            />
            {rules.hasConsistency && eligibility.consistencyInfo && (
              <ConsistencyChecklistRow
                account={account}
                isConsistent={eligibility.conditions.isConsistent}
                info={eligibility.consistencyInfo}
                percent={rules.consistencyPercent}
              />
            )}
            <ChecklistRow
              label="Minimum Payout"
              value={`$${rules.minPayoutAmount}`}
              isComplete={eligibility.conditions.hasMinWithdrawable}
              tooltip="Minimum gross withdrawal per Apex PA payout"
            />
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-900/50 border border-white/5">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">Safety Net</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-mono",
                  safetyNetStatus === "good" && "text-emerald-500",
                  safetyNetStatus === "warning" && "text-amber-500",
                  safetyNetStatus === "danger" && "text-red-500"
                )}>
                  ${safetyNet.toLocaleString()}
                </span>
                {eligibility.conditions.isAboveSafetyNet
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <XCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            <ChecklistRow
              label="Minimum Balance"
              value={`$${rules.minBalanceToRequest.toLocaleString()}`}
              isComplete={eligibility.conditions.hasMinBalance}
            />
            <ChecklistRow
              label="Payouts Used"
              value={`${eligibility.payoutCount} / ${eligibility.maxPayouts}`}
              isComplete={eligibility.conditions.hasPayoutsRemaining}
            />
          </>
        )}
      </div>

      {/* Available to withdraw */}
      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-2">
        <div className="text-xs text-emerald-500/80 mb-0.5">Available to Withdraw</div>
        <div className="text-xl font-bold font-mono text-emerald-500">
          {eligibility.availableToWithdraw >= eligibility.minPayoutAmount
            ? `$${eligibility.maxWithdrawable.toLocaleString()}`
            : "$0"}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Balance ${eligibility.stats?.currentBalance.toLocaleString()} - Safety Net ${safetyNet.toLocaleString()} = ${eligibility.availableToWithdraw.toLocaleString()}
        </div>
      </div>

      {/* Payout progress */}
      <div className="p-2 rounded-xl bg-muted/30 border border-border/50 mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Payout Tiers</span>
          <span className="text-sm font-mono">{eligibility.payoutCount} / {eligibility.maxPayouts} used</span>
        </div>
        <Progress value={(eligibility.payoutCount / eligibility.maxPayouts) * 100} className="h-1.5 mb-1.5" />
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${payoutCaps.length}, 1fr)` }}>
          {payoutCaps.map((cap, i) => (
            <div key={i} className={cn(
              "text-center py-1 px-0.5 rounded text-xs",
              i < eligibility.payoutCount
                ? "bg-emerald-500/20 text-emerald-500"
                : i === eligibility.payoutCount
                  ? "bg-primary/20 text-primary ring-1 ring-primary"
                  : "bg-muted/50 text-muted-foreground"
            )}>
              <div className="font-bold text-[10px]">#{i + 1}</div>
              <div className="font-mono text-[10px]">${(cap / 1000).toFixed(1)}k</div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <PayoutHistory payouts={payouts} />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-xs text-muted-foreground mb-0.5">Total Withdrawn</div>
          <div className="text-base font-bold font-mono text-emerald-500">${totalPayouts.toLocaleString()}</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-xs text-muted-foreground mb-0.5">Current Balance</div>
          <div className="text-base font-bold font-mono">${eligibility.stats?.currentBalance.toLocaleString()}</div>
        </div>
      </div>
    </Card>
  )
}

// ─── Lucid Payout Panel ───────────────────────────────────────────────────────

function LucidPayoutPanel({ account, eligibility, payouts, onAddPayout }: PayoutStatusPanelProps) {
  const rules = getAccountRules(account)
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ date: localTodayKey(), amount: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const isMaxedOut = eligibility.payoutCount >= eligibility.maxPayouts
  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0)
  const cycleProfit = eligibility.cycleProfit ?? 0
  const cycleProfitDays = eligibility.cycleProfitDays ?? 0
  const traderReceives = eligibility.traderReceives ?? 0
  const lucidSplit = eligibility.lucidSplit ?? 0
  const capKnown = eligibility.lucidPayoutCapKnown ?? rules.payoutAbsoluteCap > 0
  const capLabel = capKnown
    ? `$${rules.payoutAbsoluteCap.toLocaleString()}`
    : "Cap unavailable"

  const validatePayout = (amount: number): string | null => {
    if (!eligibility.isEligible) return "Account not yet eligible for payout"
    if (amount < eligibility.minPayoutAmount) return `Minimum payout is $${eligibility.minPayoutAmount}`
    if (amount > eligibility.maxWithdrawable) return `Exceeds max payout ($${eligibility.maxWithdrawable.toLocaleString()})`
    if (isMaxedOut) return `All ${eligibility.maxPayouts} payouts used`
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return }
    const err = validatePayout(amount)
    if (err) { setError(err); return }
    onAddPayout({ date: formData.date, amount, notes: formData.notes || undefined })
    toast({ title: "Payout logged", description: `$${amount.toLocaleString()} gross — you receive $${(amount * rules.payoutSplit).toLocaleString(undefined, { maximumFractionDigits: 0 })}.` })
    setOpen(false)
    setFormData({ date: localTodayKey(), amount: "", notes: "" })
  }

  const previewAmount = parseFloat(formData.amount) || 0
  const previewTrader = previewAmount * rules.payoutSplit
  const previewFirm   = previewAmount * (1 - rules.payoutSplit)

  return (
    <Card className="p-2.5 sm:p-4 rounded-[20px] sm:rounded-[24px] glass-card h-fit">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 sm:mb-2.5">
        <div>
          <h2 className="text-sm sm:text-lg font-semibold">Payout Status</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            LucidFlex — {Math.round(rules.payoutSplit * 100)}/{Math.round((1 - rules.payoutSplit) * 100)} split · $
            {rules.minDailyProfit}+ payout days · no minimum balance · {Math.round(rules.payoutMaxPercent * 100)}% of cycle (cap {capLabel})
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant={eligibility.isEligible && !isMaxedOut ? "default" : "outline"}
              className={cn(
                "gap-2",
                eligibility.isEligible && !isMaxedOut && "bg-[#536878] hover:bg-[#4a5c6a]",
                (!eligibility.isEligible || isMaxedOut) && "opacity-60"
              )}
            >
              <Plus className="h-4 w-4" />Log Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Log Lucid Payout</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-red-500">{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Gross Payout Amount ($)</Label>
                <Input type="number" step="0.01" min={eligibility.minPayoutAmount} placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => { setFormData({ ...formData, amount: e.target.value }); setError(null) }}
                  className="bg-background font-mono"
                />
                <div className="text-xs text-muted-foreground">
                  Min: ${eligibility.minPayoutAmount} | Max: ${eligibility.maxWithdrawable.toLocaleString()}
                </div>
              </div>
              {previewAmount > 0 && (
                <div className="p-3 rounded-lg bg-[#536878]/10 border border-[#536878]/25 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You receive ({Math.round(rules.payoutSplit * 100)}%)</span>
                    <span className="font-mono font-bold text-slate-200">${previewTrader.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lucid split ({Math.round((1 - rules.payoutSplit) * 100)}%)</span>
                    <span className="font-mono text-muted-foreground">${previewFirm.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="e.g., First payout" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-[#536878] hover:bg-[#4a5c6a]">Log Payout</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Eligibility banner */}
      <div className={cn(
        "p-2 rounded-xl mb-2 flex items-start gap-2",
        isMaxedOut ? "bg-[#536878]/10 border border-[#536878]/25" :
        eligibility.isEligible ? "bg-emerald-500/10 border border-emerald-500/30" :
        "bg-amber-500/10 border border-amber-500/30"
      )}>
        {isMaxedOut
          ? <CheckCircle2 className="h-5 w-5 text-[#94AAB8] mt-0.5 shrink-0" />
          : eligibility.isEligible
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            : <XCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        }
        <div>
          <div className={cn(
            "font-semibold text-sm",
            isMaxedOut ? "text-[#94AAB8]" : eligibility.isEligible ? "text-emerald-500" : "text-amber-500"
          )}>
            {isMaxedOut
              ? `All Payouts Complete (${eligibility.maxPayouts}/${eligibility.maxPayouts})`
              : eligibility.isEligible ? "Eligible for Payout" : "Not Yet Eligible"}
          </div>
          {!eligibility.isEligible && !isMaxedOut && eligibility.missingConditions.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {eligibility.missingConditions.map((c, i) => (
                <li key={i} className="text-amber-500/80">• {c}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug mb-2">
        LucidFlex cycle payout · 90/10 split · no minimum balance required.
      </p>

      {/* Checklist */}
      <div className="space-y-1 mb-2">
        <ChecklistRow
          label="Payout Days"
          value={`${cycleProfitDays} / ${eligibility.minProfitDays}`}
          isComplete={cycleProfitDays >= (eligibility.minProfitDays ?? 5)}
          tooltip={`$${rules.minDailyProfit}+ net profit per day this cycle`}
        />
        <ChecklistRow
          label="Cycle Profit"
          value={cycleProfit > 0 ? `+$${cycleProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${cycleProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          isComplete={cycleProfit > 0}
        />
        <ChecklistRow
          label="Payout Cap"
          value={capKnown ? `$${rules.payoutAbsoluteCap.toLocaleString()}` : "Unavailable"}
          isComplete={capKnown && eligibility.maxWithdrawable > 0}
        />
        <ChecklistRow
          label="No Minimum Balance"
          value="Not required"
          isComplete
        />
      </div>

      {/* Available to withdraw */}
      <div className="p-2 rounded-xl bg-[#536878]/10 border border-[#536878]/25 mb-2">
        <div className="text-xs text-slate-400 mb-0.5">Available to Withdraw</div>
        <div className="text-xl font-bold font-mono text-slate-200">
          ${eligibility.maxWithdrawable >= eligibility.minPayoutAmount
            ? eligibility.maxWithdrawable.toLocaleString()
            : "0"}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          min(Cycle Profit × {Math.round((eligibility.payoutMaxPercent ?? 0.5) * 100)}%
          {capKnown ? `, $${rules.payoutAbsoluteCap.toLocaleString()} cap` : ", cap unavailable"})
        </div>
        {eligibility.maxWithdrawable >= eligibility.minPayoutAmount && (
          <div className="mt-1.5 pt-1.5 border-t border-[#536878]/20 space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">You receive (90%)</span>
              <span className="font-mono text-slate-300">${traderReceives.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lucid split (10%)</span>
              <span className="font-mono text-muted-foreground">${lucidSplit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Payout count */}
      <div className="p-2 rounded-xl bg-muted/30 border border-border/50 mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Payout Progress</span>
          <span className="text-sm font-mono">{eligibility.payoutCount} / {eligibility.maxPayouts}</span>
        </div>
        <Progress value={(eligibility.payoutCount / eligibility.maxPayouts) * 100} className="h-1.5 mb-1" />
        <p className="text-xs text-muted-foreground">After {eligibility.maxPayouts} payouts, account may be moved live</p>
      </div>

      {/* History */}
      <PayoutHistory payouts={payouts} showSplit />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-xs text-muted-foreground mb-0.5">Total Withdrawn</div>
          <div className="text-base font-bold font-mono text-slate-200">${totalPayouts.toLocaleString()}</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-xs text-muted-foreground mb-0.5">Cycle Profit</div>
          <div className={cn("text-base font-bold font-mono", cycleProfit >= 0 ? "text-emerald-500" : "text-red-500")}>
            {cycleProfit >= 0 ? "+" : ""}${cycleProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Tradeify Select Flex ─────────────────────────────────────────────────────

function TradeifyFlexPayoutPanel({ account, eligibility, payouts, onAddPayout }: PayoutStatusPanelProps) {
  const rules = getAccountRules(account)
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ date: localTodayKey(), amount: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const winningDays = eligibility.winningDays ?? 0
  const cycleProfit = eligibility.cycleProfit ?? 0
  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0)
  const estimatedMax = eligibility.maxWithdrawable
  const flexLock = rules.lucidFlexFloor
  const peak = eligibility.stats?.floorPeakBalance ?? 0
  const drawdownLocked = flexLock != null && peak >= flexLock.lockPeakThreshold

  const validatePayout = (amount: number): string | null => {
    if (!eligibility.isEligible) return "Account not yet eligible for payout"
    if (amount > eligibility.maxWithdrawable) {
      return `Exceeds max payout ($${eligibility.maxWithdrawable.toLocaleString()})`
    }
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return }
    const err = validatePayout(amount)
    if (err) { setError(err); return }
    onAddPayout({ date: formData.date, amount, notes: formData.notes || undefined })
    toast({ title: "Payout logged", description: `$${amount.toLocaleString()} gross logged.` })
    setOpen(false)
    setFormData({ date: localTodayKey(), amount: "", notes: "" })
  }

  return (
    <Card className="p-2.5 sm:p-4 rounded-[20px] sm:rounded-[24px] glass-card h-fit">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm sm:text-lg font-semibold">Payout Status</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select Flex · 5 winning days · up to 50% of total profit (90/10 split)
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
          <DialogTrigger asChild>
            <Button size="sm" variant={eligibility.isEligible ? "default" : "outline"} className="gap-2">
              <Plus className="h-4 w-4" />Log Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Log Tradeify Flex Payout</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500">{error}</div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Gross Amount ($)</Label>
                <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="bg-background font-mono" />
                <p className="text-xs text-muted-foreground">Max: ${eligibility.maxWithdrawable.toLocaleString()}</p>
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Log Payout</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className={cn(
        "p-2 rounded-xl mb-2 text-sm font-semibold",
        eligibility.isEligible ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border border-amber-500/30",
      )}>
        {eligibility.isEligible ? "Eligible for Payout" : "Not Yet Eligible"}
        {!eligibility.isEligible && (
          <ul className="mt-1 font-normal text-xs space-y-0.5">
            {eligibility.missingConditions.map((c, i) => <li key={i}>• {c}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-1 mb-2">
        <ChecklistRow label="Winning Days" value={`${winningDays} / ${rules.minProfitDays}`} isComplete={winningDays >= rules.minProfitDays} />
        <ChecklistRow label="Cycle Profit" value={cycleProfit > 0 ? `+$${fmtUsd(cycleProfit)}` : `$${fmtUsd(cycleProfit)}`} isComplete={cycleProfit > 0} />
        <ChecklistRow
          label="50% Total Profit Cap"
          value={`$${fmtUsd(Math.min((eligibility.totalProfitForPayout ?? 0) * 0.5, rules.payoutAbsoluteCap))}`}
          isComplete={estimatedMax > 0}
          tooltip="min(50% of total account profit, size payout cap)"
        />
        <ChecklistRow label="Payout Cap" value={`$${rules.payoutAbsoluteCap.toLocaleString()}`} isComplete />
        <ChecklistRow label="No Minimum Balance" value="Not required" isComplete />
        <ChecklistRow
          label="Drawdown Lock"
          value={
            flexLock
              ? drawdownLocked
                ? `Locked at $${flexLock.lockedFloor.toLocaleString()}`
                : `$${flexLock.lockedFloor.toLocaleString()} at $${flexLock.lockPeakThreshold.toLocaleString()} peak`
              : "—"
          }
          isComplete={drawdownLocked}
        />
      </div>

      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 mb-2">
        <div className="text-xs text-muted-foreground">Available to Withdraw</div>
        <div className="text-xl font-bold font-mono text-emerald-400">${fmtUsd(eligibility.availableToWithdraw)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          90/10 split · min(50% total profit, ${rules.payoutAbsoluteCap.toLocaleString()} cap)
        </div>
      </div>

      <PayoutHistory payouts={payouts} showSplit />
      <div className="p-2 rounded-lg bg-muted/30 border border-border/50 mt-2">
        <div className="text-xs text-muted-foreground">Total Withdrawn</div>
        <div className="text-base font-bold font-mono text-emerald-500">${totalPayouts.toLocaleString()}</div>
      </div>
    </Card>
  )
}

// ─── Tradeify Select Daily ────────────────────────────────────────────────────

function TradeifyDailyPayoutPanel({ account, eligibility, payouts, onAddPayout }: PayoutStatusPanelProps) {
  const rules = getAccountRules(account)
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ date: localTodayKey(), amount: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const cycleProfit = eligibility.cycleProfit ?? 0
  const aboveBuffer = eligibility.aboveBuffer ?? 0
  const continuityMax = eligibility.continuityMax ?? 0
  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0)

  const validatePayout = (amount: number): string | null => {
    if (!eligibility.isEligible) return "Account not yet eligible for payout"
    if (amount < rules.minPayoutAmount) return `Minimum payout is $${rules.minPayoutAmount}`
    if (amount > eligibility.maxWithdrawable) return `Exceeds max ($${eligibility.maxWithdrawable.toLocaleString()})`
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return }
    const err = validatePayout(amount)
    if (err) { setError(err); return }
    onAddPayout({ date: formData.date, amount, notes: formData.notes || undefined })
    toast({ title: "Payout logged", description: `$${amount.toLocaleString()} logged.` })
    setOpen(false)
    setFormData({ date: localTodayKey(), amount: "", notes: "" })
  }

  return (
    <Card className="p-2.5 sm:p-4 rounded-[20px] sm:rounded-[24px] glass-card h-fit">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm sm:text-lg font-semibold">Payout Status</h2>
          <p className="text-xs text-slate-400 mt-0.5">Select Daily · buffer + 2× cycle continuity · min $250</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
          <DialogTrigger asChild>
            <Button size="sm" variant={eligibility.isEligible ? "default" : "outline"} className="gap-2">
              <Plus className="h-4 w-4" />Log Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Log Tradeify Daily Payout</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500">{error}</div>}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min={rules.minPayoutAmount} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="bg-background font-mono" />
                <p className="text-xs text-muted-foreground">Min ${rules.minPayoutAmount} · Max ${eligibility.maxWithdrawable.toLocaleString()}</p>
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Log Payout</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className={cn(
        "p-2 rounded-xl mb-2 text-sm font-semibold",
        eligibility.isEligible ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border border-amber-500/30",
      )}>
        {eligibility.isEligible ? "Eligible for Payout" : "Not Yet Eligible"}
        {!eligibility.isEligible && (
          <ul className="mt-1 font-normal text-xs space-y-0.5">
            {eligibility.missingConditions.map((c, i) => <li key={i}>• {c}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-1 mb-2">
        <ChecklistRow label="Buffer Requirement" value={`$${(eligibility.bufferLine ?? 0).toLocaleString()}`} isComplete={eligibility.conditions?.isAboveBuffer ?? false} />
        <ChecklistRow label="Above Buffer" value={`$${fmtUsd(aboveBuffer)}`} isComplete={aboveBuffer > 0} />
        <ChecklistRow label="Cycle Profit" value={cycleProfit > 0 ? `+$${fmtUsd(cycleProfit)}` : `$${fmtUsd(cycleProfit)}`} isComplete={cycleProfit > 0} />
        <ChecklistRow label="2× Limit" value={`$${fmtUsd(continuityMax)}`} isComplete={continuityMax >= rules.minPayoutAmount} tooltip="Up to 2× cycle profit" />
        <ChecklistRow label="Payout Cap" value={`$${rules.payoutAbsoluteCap.toLocaleString()}`} isComplete />
        <ChecklistRow label="Minimum Payout" value={`$${rules.minPayoutAmount}`} isComplete={eligibility.maxWithdrawable >= rules.minPayoutAmount} />
        <ChecklistRow label="Daily Loss Limit" value={`$${rules.dailyLossLimit.toLocaleString()}`} isComplete />
      </div>

      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 mb-2">
        <div className="text-xs text-muted-foreground">Available to Withdraw</div>
        <div className="text-xl font-bold font-mono text-emerald-400">${fmtUsd(eligibility.availableToWithdraw)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          min(2× cycle, ${rules.payoutAbsoluteCap.toLocaleString()} cap, above buffer) · min ${rules.minPayoutAmount}
        </div>
      </div>

      <PayoutHistory payouts={payouts} showSplit />
      <div className="p-2 rounded-lg bg-muted/30 border border-border/50 mt-2">
        <div className="text-xs text-muted-foreground">Total Withdrawn</div>
        <div className="text-base font-bold font-mono text-emerald-500">${totalPayouts.toLocaleString()}</div>
      </div>
    </Card>
  )
}

// ─── Shared payout history ────────────────────────────────────────────────────

function PayoutHistory({ payouts, showSplit }: { payouts: Payout[]; showSplit?: boolean }) {
  return (
    <div className="mb-2">
      <div className="text-xs font-medium text-muted-foreground mb-1">Payout History</div>
      {payouts.length > 0 ? (
        <div className="space-y-1 max-h-[130px] overflow-y-auto">
          {payouts.slice().reverse().map((payout) => (
            <div key={payout.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/30">
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <div>
                  <div className="text-sm font-semibold font-mono">${payout.amount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    {parseLocalDate(payout.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" • "}Payout #{payout.payoutNumber}
                    {payout.notes && ` • ${payout.notes}`}
                  </div>
                  {showSplit && payout.traderReceived && (
                    <div className="text-xs text-slate-400">You received ${payout.traderReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 px-4 text-center space-y-1 rounded-xl bg-[rgba(83,104,120,0.04)] border border-[rgba(83,104,120,0.12)]">
          <p className="text-sm text-[#E5E4E2]/48">Your first payout will appear here once logged.</p>
          <p className="text-xs text-[#E5E4E2]/28">Track withdrawals, payout cycles, and funded account progress.</p>
        </div>
      )}
    </div>
  )
}
