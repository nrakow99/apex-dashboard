"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ManualDrawdownMode = "remaining" | "floor"

interface ManualIntradayDrawdownModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBalance: number
  /** Which field to edit first when opening */
  initialMode: ManualDrawdownMode
  /** Current estimated values (no manual override) for placeholders */
  estimatedFloor: number
  estimatedDrawdownRemaining: number
  hasManualOverride: boolean
  onSave: (params: {
    manualIntradayFloor: number
    manualDrawdownRemaining: number
  }) => Promise<void>
  onClearManual: () => Promise<void>
  isSaving: boolean
}

export function ManualIntradayDrawdownModal({
  open,
  onOpenChange,
  currentBalance,
  initialMode,
  estimatedFloor,
  estimatedDrawdownRemaining,
  hasManualOverride,
  onSave,
  onClearManual,
  isSaving,
}: ManualIntradayDrawdownModalProps) {
  const [mode, setMode] = useState<ManualDrawdownMode>(initialMode)
  const [rawInput, setRawInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setError(null)
    const seed =
      initialMode === "remaining"
        ? (hasManualOverride ? estimatedDrawdownRemaining : estimatedDrawdownRemaining)
        : estimatedFloor
    setRawInput(Number.isFinite(seed) ? String(Math.max(0, seed)) : "")
  }, [open, initialMode, estimatedFloor, estimatedDrawdownRemaining, hasManualOverride])

  const parseAmount = (): number | null => {
    const v = parseFloat(rawInput.replace(/,/g, ""))
    if (Number.isNaN(v) || !Number.isFinite(v)) return null
    return v
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amount = parseAmount()
    if (amount === null) {
      setError("Enter a valid dollar amount.")
      return
    }
    if (amount < 0) {
      setError("Amount cannot be negative.")
      return
    }

    let manualFloor: number
    let manualDd: number
    if (mode === "remaining") {
      manualDd = amount
      manualFloor = currentBalance - manualDd
    } else {
      manualFloor = amount
      manualDd = currentBalance - manualFloor
    }

    try {
      await onSave({
        manualIntradayFloor: manualFloor,
        manualDrawdownRemaining: manualDd,
      })
      onOpenChange(false)
    } catch {
      // Parent shows toast; keep dialog open
    }
  }

  const handleClear = async () => {
    setError(null)
    try {
      await onClearManual()
      onOpenChange(false)
    } catch {
      // Parent shows toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Update intraday drawdown</DialogTitle>
          <DialogDescription className="text-slate-400">
            Enter values from Tradovate. Balance uses closed trades only; floor and distance reflect your live platform.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Update using</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ManualDrawdownMode)}>
              <SelectTrigger className="bg-[#0F1115]/80 border-white/[0.10]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remaining">Drawdown remaining ($)</SelectItem>
                <SelectItem value="floor">Active floor / intraday threshold ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-dd-amount">
              {mode === "remaining" ? "Drawdown remaining" : "Active floor"}
            </Label>
            <Input
              id="manual-dd-amount"
              type="number"
              step="0.01"
              min={0}
              className="font-mono bg-[#0F1115]/80 border-white/[0.10]"
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value)
                setError(null)
              }}
              placeholder={mode === "remaining" ? String(estimatedDrawdownRemaining.toFixed(2)) : String(estimatedFloor.toFixed(2))}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Current balance (closed trades):{" "}
              <span className="font-mono text-slate-300">${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <p className="text-[11px] text-muted-foreground/90 italic">Manually updated from Tradovate.</p>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="border-white/[0.10] text-slate-400"
              disabled={isSaving || !hasManualOverride}
              onClick={() => void handleClear()}
            >
              Clear manual override
            </Button>
            <div className="flex gap-2 justify-end w-full sm:w-auto">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
