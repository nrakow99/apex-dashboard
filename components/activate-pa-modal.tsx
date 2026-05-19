"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import type { Account } from "@/lib/types"
import {
  defaultPaAccountName,
  getPaActivationRuleSummary,
} from "@/lib/pa-activation"
import { formatCurrency } from "@/lib/utils"

interface ActivatePaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evalAccount: Account | null
  onConfirm: (args: {
    name: string
    activatedAtIso: string
    activationStartDate: string
  }) => Promise<void>
  isSubmitting?: boolean
}

export function ActivatePaModal({
  open,
  onOpenChange,
  evalAccount,
  onConfirm,
  isSubmitting = false,
}: ActivatePaModalProps) {
  const [name, setName] = useState("")
  const [activationDate, setActivationDate] = useState("")

  useEffect(() => {
    if (evalAccount && open) {
      setName(defaultPaAccountName(evalAccount))
      setActivationDate("")
    }
  }, [evalAccount, open])

  if (!evalAccount) return null

  const summaryLines = getPaActivationRuleSummary(evalAccount)
  const ddLabel =
    evalAccount.drawdownType === "Intraday"
      ? "Intraday trailing"
      : "EOD (end of day)"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalName = name.trim() || defaultPaAccountName(evalAccount)
    const activationStartDate =
      activationDate || new Date().toISOString().slice(0, 10)
    const activatedAtIso = new Date().toISOString()
    await onConfirm({ name: finalName, activatedAtIso, activationStartDate })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-tight">
            Activate Performance Account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="rounded-xl border border-white/[0.07] bg-[#0F1115]/60 p-3 text-sm space-y-2">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Firm</span>
              <span className="font-medium text-slate-100">{evalAccount.firm}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Account size</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(evalAccount.accountSize)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Drawdown type</span>
              <span className="text-slate-200">{ddLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Starting balance</span>
              <span className="font-mono tabular-nums text-emerald-400/95">
                {formatCurrency(evalAccount.accountSize)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              PA rule summary
            </div>
            <ul className="rounded-xl border border-white/[0.07] bg-[#0F1115]/50 px-3 py-2.5 text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              {summaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pa-name">New account name</Label>
            <Input
              id="pa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultPaAccountName(evalAccount)}
              className="bg-background"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pa-activation-date">PA metrics start date (optional)</Label>
            <Input
              id="pa-activation-date"
              type="date"
              value={activationDate}
              onChange={(e) => setActivationDate(e.target.value)}
              className="bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Defaults to today. PA stats, payouts, and eligibility count only trades on or after this
              date; older eval trades stay saved but are ignored for PA rules.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-emerald-600 to-[#3d5a6a] hover:from-emerald-500 hover:to-[#4a6b7e] text-white shadow-md shadow-emerald-900/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating…
                </>
              ) : (
                "Confirm activation"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
