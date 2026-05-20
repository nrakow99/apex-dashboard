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
import { localTodayKey, parseLocalDate } from "@/lib/date-utils"

// ─── Shared prop types ────────────────────────────────────────────────────────

interface PayoutEligibility {
  isEligible: boolean
  firm: "Apex" | "Lucid"
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
  }

  // Lucid
  cycleProfit?: number
  cycleProfitDays?: number
  minProfitDays?: number
  minDailyProfit?: number
  payoutMaxPercent?: number
  payoutAbsoluteCap?: number
  payoutSplit?: number
  traderReceives?: number
  lucidSplit?: number
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

// ─── Main component ───────────────────────────────────────────────────────────

export function PayoutStatusPanel({ account, eligibility, payouts, onAddPayout }: PayoutStatusPanelProps) {
  return eligibility.firm === "Lucid"
    ? <LucidPayoutPanel account={account} eligibility={eligibility} payouts={payouts} onAddPayout={onAddPayout} />
    : <ApexPayoutPanel  account={account} eligibility={eligibility} payouts={payouts} onAddPayout={onAddPayout} />
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

      {/* Checklist */}
      <div className="space-y-1 mb-2">
        {eligibility.conditions && (
          <>
            <ChecklistRow
              label={`$${rules.minDailyProfit}+ Profit Days`}
              value={`${eligibility.consistencyInfo?.daysWithMinProfit ?? 0} / ${rules.minProfitDays}`}
              isComplete={eligibility.conditions.hasEnoughProfitDays}
            />
            {rules.hasConsistency && (
              <ChecklistRow
                label="Consistency (50%)"
                value={eligibility.conditions.isConsistent ? "Compliant" : "Not yet"}
                isComplete={eligibility.conditions.isConsistent}
                tooltip={`Largest: $${eligibility.consistencyInfo?.largestWinningDay.toLocaleString()} / Max: $${eligibility.consistencyInfo?.maxAllowedDay.toLocaleString()}`}
              />
            )}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">Safety Net (${safetyNet.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-mono",
                  safetyNetStatus === "good" && "text-emerald-500",
                  safetyNetStatus === "warning" && "text-amber-500",
                  safetyNetStatus === "danger" && "text-red-500"
                )}>
                  {safetyNetStatus === "good" ? "Safe" : safetyNetStatus === "warning" ? "Close" : "Below"}
                </span>
                {safetyNetStatus === "good"
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : safetyNetStatus === "warning"
                    ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                    : <XCircle className="h-4 w-4 text-red-500" />
                }
              </div>
            </div>
            <ChecklistRow
              label={`Min Balance ($${rules.minBalanceToRequest.toLocaleString()})`}
              value={eligibility.conditions.hasMinBalance ? "Met" : `$${(rules.minBalanceToRequest - (eligibility.stats?.currentBalance ?? 0)).toLocaleString()} needed`}
              isComplete={eligibility.conditions.hasMinBalance}
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
          <span className="text-sm font-medium">Payout Progress</span>
          <span className="text-sm font-mono">{eligibility.payoutCount} / {eligibility.maxPayouts}</span>
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
            LucidFlex — {Math.round(rules.payoutSplit * 100)}% / {Math.round((1 - rules.payoutSplit) * 100)}% split · min $
            {rules.minPayoutAmount} · max {Math.round(rules.payoutMaxPercent * 100)}% of cycle profit (cap $
            {rules.payoutAbsoluteCap.toLocaleString()})
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
        Eligibility is cycle-based (qualifying days + net profit). Unlike Apex PA, there is no minimum account balance to request a payout.
      </p>

      {/* Checklist */}
      <div className="space-y-1 mb-2">
        <ChecklistRow
          label={`$${eligibility.minDailyProfit}+ Profit Days (cycle)`}
          value={`${cycleProfitDays} / ${eligibility.minProfitDays}`}
          isComplete={cycleProfitDays >= (eligibility.minProfitDays ?? 5)}
        />
        <ChecklistRow
          label="Cycle Net Profit"
          value={cycleProfit > 0 ? `+$${cycleProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${cycleProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          isComplete={cycleProfit > 0}
        />
      </div>

      {/* Available to withdraw */}
      <div className="p-2 rounded-xl bg-[#536878]/10 border border-[#536878]/25 mb-2">
        <div className="text-xs text-slate-400 mb-0.5">Max Payout Available</div>
        <div className="text-xl font-bold font-mono text-slate-200">
          ${eligibility.maxWithdrawable >= eligibility.minPayoutAmount
            ? eligibility.maxWithdrawable.toLocaleString()
            : "0"}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          min(Cycle Profit × {Math.round((eligibility.payoutMaxPercent ?? 0.5) * 100)}%, ${(eligibility.payoutAbsoluteCap ?? 0).toLocaleString()}) cap
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
