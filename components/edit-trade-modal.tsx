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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { Account, Trade } from "@/lib/types"

interface EditTradeModalProps {
  trade: Trade | null
  accounts: Account[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (tradeId: string, updates: {
    date: string
    accountId: string
    symbol: string
    pnl: number
    notes?: string
  }) => Promise<void>
  isSaving?: boolean
}

export function EditTradeModal({ 
  trade, 
  accounts, 
  open, 
  onOpenChange, 
  onSave,
  isSaving = false 
}: EditTradeModalProps) {
  const [formData, setFormData] = useState({
    date: "",
    accountId: "",
    symbol: "",
    pnl: "",
    notes: "",
  })

  useEffect(() => {
    if (trade) {
      setFormData({
        date: trade.date,
        accountId: trade.accountId,
        symbol: trade.symbol,
        pnl: trade.pnl.toString(),
        notes: trade.notes ?? "",
      })
    }
  }, [trade])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trade) return

    await onSave(trade.id, {
      date: formData.date,
      accountId: formData.accountId,
      symbol: formData.symbol.toUpperCase(),
      pnl: parseFloat(formData.pnl) || 0,
      notes: formData.notes.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Trade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="bg-background"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-account">Account</Label>
            <Select
              value={formData.accountId}
              onValueChange={(value) => setFormData({ ...formData, accountId: value })}
              disabled={isSaving}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-symbol">Symbol</Label>
            <Select
              value={formData.symbol}
              onValueChange={(value) => setFormData({ ...formData, symbol: value })}
              disabled={isSaving}
            >
              <SelectTrigger className="bg-background font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NQM6">NQM6</SelectItem>
                <SelectItem value="ESM6">ESM6</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-pnl">Net PnL ($)</Label>
            <Input
              id="edit-pnl"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.pnl}
              onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
              className="bg-background font-mono"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Textarea
              id="edit-notes"
              placeholder="Add any notes about this trade..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-background resize-none h-20"
              disabled={isSaving}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
