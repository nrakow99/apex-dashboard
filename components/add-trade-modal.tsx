"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react"
import type { Account } from "@/lib/types"

interface AddTradeModalProps {
  accounts: Account[]
  selectedAccountId: string
  onAddTrade: (trade: {
    date: string
    accountId: string
    symbol: string
    pnl: number
    notes?: string
  }) => void
}

export function AddTradeModal({ accounts, selectedAccountId, onAddTrade }: AddTradeModalProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    accountId: selectedAccountId,
    symbol: "NQM6",
    pnl: "",
    notes: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAddTrade({
      date: formData.date,
      accountId: formData.accountId,
      symbol: formData.symbol.toUpperCase(),
      pnl: parseFloat(formData.pnl) || 0,
      notes: formData.notes.trim() || undefined,
    })
    setOpen(false)
    setFormData({
      date: new Date().toISOString().split("T")[0],
      accountId: selectedAccountId,
      symbol: "NQM6",
      pnl: "",
      notes: "",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Trade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add New Trade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Account</Label>
            <Select
              value={formData.accountId}
              onValueChange={(value) => setFormData({ ...formData, accountId: value })}
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
            <Label htmlFor="symbol">Symbol</Label>
            <Select
              value={formData.symbol}
              onValueChange={(value) => setFormData({ ...formData, symbol: value })}
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
            <Label htmlFor="pnl">Net PnL ($)</Label>
            <Input
              id="pnl"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.pnl}
              onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
              className="bg-background font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this trade..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-background resize-none h-20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              Add Trade
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
