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
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PA_CONSTANTS } from "@/lib/types"
import type { Payout } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface PayoutEligibility {
  isEligible: boolean
  conditions: {
    hasEnoughTradingDays: boolean
    hasEnoughProfitDays: boolean
    isConsistent: boolean
    hasMinBalance: boolean
    isAboveSafetyNet: boolean
    hasMinWithdrawable: boolean
    hasPayoutsRemaining: boolean
  }
  missingConditions: string[]
  availableToWithdraw: number
  maxPayoutAllowed: number
  maxWithdrawable: number
  payoutCount: number
  currentPayoutTier: number
  safetyNet: number
  consistencyInfo: {
    daysWithMinProfit: number
    isValid: boolean
    largestWinningDay: number
    totalProfit: number
    maxAllowedDay: number
    additionalProfitNeeded: number
  }
  stats: {
    currentBalance: number
    tradingDays: number
  }
}

interface PayoutStatusPanelProps {
  accountId: string
  eligibility: PayoutEligibility
  payouts: Payout[]
  onAddPayout: (payout: { date: string; amount: number; notes?: string }) => void
}

export function PayoutStatusPanel({ 
  eligibility, 
  payouts, 
  onAddPayout 
}: PayoutStatusPanelProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0)
  const isMaxedOut = eligibility.payoutCount >= 6

  const validatePayout = (amount: number): string | null => {
    if (!eligibility.isEligible) {
      return "This account is not yet eligible for payout"
    }
    if (amount < PA_CONSTANTS.MIN_PAYOUT_AMOUNT) {
      return `Minimum payout is $${PA_CONSTANTS.MIN_PAYOUT_AMOUNT}`
    }
    if (amount > eligibility.maxPayoutAllowed) {
      return `Requested amount exceeds current payout cap ($${eligibility.maxPayoutAllowed.toLocaleString()})`
    }
    if (amount > eligibility.availableToWithdraw) {
      return `Requested amount exceeds withdrawable balance ($${eligibility.availableToWithdraw.toLocaleString()})`
    }
    if (eligibility.payoutCount >= 6) {
      return "All 6 payouts have been used for this account"
    }
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    const validationError = validatePayout(amount)
    if (validationError) {
      setError(validationError)
      return
    }

    onAddPayout({
      date: formData.date,
      amount,
      notes: formData.notes || undefined,
    })
    
    toast({
      title: "Payout logged",
      description: `Payout of $${amount.toLocaleString()} logged successfully`,
    })
    
    setOpen(false)
    setFormData({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      notes: "",
    })
    setError(null)
  }

  // Safety net status color
  const getSafetyNetStatus = () => {
    const balance = eligibility.stats.currentBalance
    const safetyNet = PA_CONSTANTS.SAFETY_NET
    const diff = balance - safetyNet
    
    if (diff >= 500) return "good" // Green - above safety net
    if (diff >= 0) return "warning" // Amber - at or close to safety net
    return "danger" // Red - below safety net
  }

  const safetyNetStatus = getSafetyNetStatus()

  return (
    <Card className="p-5 bg-card/50 backdrop-blur border-border/50">
      {/* 1. Header with Log Payout Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Payout Status</h2>
        <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setError(null); }}>
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
              <Plus className="h-4 w-4" />
              Log Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>Log Payout</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-red-500">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="payout-date">Date</Label>
                <Input
                  id="payout-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-amount">Amount ($)</Label>
                <Input
                  id="payout-amount"
                  type="number"
                  step="0.01"
                  min={PA_CONSTANTS.MIN_PAYOUT_AMOUNT}
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => { setFormData({ ...formData, amount: e.target.value }); setError(null); }}
                  className="bg-background font-mono"
                />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Min: ${PA_CONSTANTS.MIN_PAYOUT_AMOUNT} | Max: ${eligibility.maxWithdrawable.toLocaleString()}</div>
                  <div>Tier {eligibility.currentPayoutTier} cap: ${eligibility.maxPayoutAllowed.toLocaleString()}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-notes">Notes (Optional)</Label>
                <Input
                  id="payout-notes"
                  placeholder="e.g., First payout"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  Log Payout
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 2. Overall Eligibility Status Banner */}
      <div className={cn(
        "p-3 rounded-xl mb-4 flex items-start gap-3",
        isMaxedOut 
          ? "bg-blue-500/10 border border-blue-500/30"
          : eligibility.isEligible 
            ? "bg-emerald-500/10 border border-emerald-500/30" 
            : "bg-amber-500/10 border border-amber-500/30"
      )}>
        {isMaxedOut ? (
          <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        ) : eligibility.isEligible ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        )}
        <div>
          <div className={cn(
            "font-semibold text-sm",
            isMaxedOut ? "text-blue-500" : eligibility.isEligible ? "text-emerald-500" : "text-amber-500"
          )}>
            {isMaxedOut ? "All Payouts Complete (6/6)" : eligibility.isEligible ? "Eligible for Payout" : "Not Yet Eligible"}
          </div>
          {/* 3. Missing Requirements List */}
          {!eligibility.isEligible && !isMaxedOut && eligibility.missingConditions.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {eligibility.missingConditions.map((condition, i) => (
                <li key={i} className="text-amber-500/80">• {condition}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Checklist Section */}
      <div className="space-y-2 mb-4">
        {/* 4. Trading Days */}
        <ChecklistRow
          label="Trading Days"
          value={`${eligibility.stats.tradingDays} / ${PA_CONSTANTS.MIN_QUALIFYING_DAYS}`}
          isComplete={eligibility.conditions.hasEnoughTradingDays}
        />

        {/* 5. $250+ Profit Days */}
        <ChecklistRow
          label="$250+ Profit Days"
          value={`${eligibility.consistencyInfo.daysWithMinProfit} / ${PA_CONSTANTS.MIN_QUALIFYING_DAYS}`}
          isComplete={eligibility.conditions.hasEnoughProfitDays}
        />

        {/* 6. Consistency */}
        <ChecklistRow
          label="Consistency (50%)"
          value={eligibility.conditions.isConsistent ? "Compliant" : "Not yet"}
          isComplete={eligibility.conditions.isConsistent}
          tooltip={`Largest: $${eligibility.consistencyInfo.largestWinningDay.toLocaleString()} / Max: $${eligibility.consistencyInfo.maxAllowedDay.toLocaleString()}`}
        />

        {/* 7. Safety Net */}
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">Safety Net ($52,100)</span>
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
            {safetyNetStatus === "good" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : safetyNetStatus === "warning" ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>

        {/* 8. Minimum Balance to Request */}
        <ChecklistRow
          label="Min Balance ($52,600)"
          value={eligibility.conditions.hasMinBalance ? "Met" : `$${(PA_CONSTANTS.MIN_BALANCE_FOR_PAYOUT - eligibility.stats.currentBalance).toLocaleString()} needed`}
          isComplete={eligibility.conditions.hasMinBalance}
        />
      </div>

      {/* 9. Available to Withdraw */}
      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-4">
        <div className="text-xs text-emerald-500/80 mb-0.5">Available to Withdraw</div>
        <div className="text-xl font-bold font-mono text-emerald-500">
          {eligibility.availableToWithdraw >= PA_CONSTANTS.MIN_PAYOUT_AMOUNT 
            ? `$${eligibility.maxWithdrawable.toLocaleString()}`
            : "$0"
          }
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Balance ${eligibility.stats.currentBalance.toLocaleString()} - Safety Net ${PA_CONSTANTS.SAFETY_NET.toLocaleString()} = ${eligibility.availableToWithdraw.toLocaleString()}
        </div>
      </div>

      {/* 10. Payout Progress */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border/50 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Payout Progress</span>
          <span className="text-sm font-mono">{eligibility.payoutCount} / 6</span>
        </div>
        <Progress value={(eligibility.payoutCount / 6) * 100} className="h-2 mb-2" />
        
        {/* Payout Tiers */}
        <div className="grid grid-cols-6 gap-1">
          {PA_CONSTANTS.PAYOUT_TIERS.map((tier, i) => (
            <div 
              key={i}
              className={cn(
                "text-center py-1.5 px-1 rounded text-xs",
                i < eligibility.payoutCount 
                  ? "bg-emerald-500/20 text-emerald-500" 
                  : i === eligibility.payoutCount 
                    ? "bg-primary/20 text-primary ring-1 ring-primary"
                    : "bg-muted/50 text-muted-foreground"
              )}
            >
              <div className="font-bold text-[10px]">#{i + 1}</div>
              <div className="font-mono text-[10px]">${(tier / 1000).toFixed(1)}k</div>
            </div>
          ))}
        </div>
      </div>

      {/* 11. Payout History */}
      <div className="mb-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">Payout History</div>
        {payouts.length > 0 ? (
          <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
            {payouts
              .slice()
              .reverse()
              .map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30"
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    <div>
                      <div className="text-sm font-semibold font-mono">
                        ${payout.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(payout.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {" • "}Payout #{payout.payoutNumber}
                        {payout.notes && ` • ${payout.notes}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 rounded-lg bg-muted/20 border border-border/30">
            No payouts logged yet
          </div>
        )}
      </div>

      {/* 12. Summary Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-xs text-muted-foreground mb-0.5">Total Withdrawn</div>
          <div className="text-base font-bold font-mono text-emerald-500">
            ${totalPayouts.toLocaleString()}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-xs text-muted-foreground mb-0.5">Current Balance</div>
          <div className="text-base font-bold font-mono">${eligibility.stats.currentBalance.toLocaleString()}</div>
        </div>
      </div>
    </Card>
  )
}

function ChecklistRow({ 
  label, 
  value, 
  isComplete,
  tooltip
}: { 
  label: string
  value: string
  isComplete: boolean
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20" title={tooltip}>
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-xs font-mono",
          isComplete ? "text-emerald-500" : "text-amber-500"
        )}>
          {value}
        </span>
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        )}
      </div>
    </div>
  )
}
