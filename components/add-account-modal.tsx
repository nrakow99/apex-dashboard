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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import type { Account, AccountType } from "@/lib/types"

interface AddAccountModalProps {
  onAddAccount: (account: Omit<Account, "id">) => void
}

export function AddAccountModal({ onAddAccount }: AddAccountModalProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    type: "Eval" as AccountType,
    startingBalance: "50000",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const startingBalance = parseFloat(formData.startingBalance) || 50000
    
    onAddAccount({
      name: formData.name || `${formData.type} Account`,
      type: formData.type,
      status: "Active",
      balance: startingBalance,
      startingBalance,
      maxBalance: startingBalance,
      profitTarget: formData.type === "Eval" ? 3000 : undefined,
      maxDrawdown: 2000,
      dailyLossLimit: 1000,
    })
    
    setOpen(false)
    setFormData({
      name: "",
      type: "Eval",
      startingBalance: "50000",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account Name</Label>
            <Input
              id="account-name"
              placeholder="e.g., Apex 50K Eval"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: AccountType) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Eval">Eval</SelectItem>
                <SelectItem value="PA">PA (Performance Account)</SelectItem>
                <SelectItem value="Live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="starting-balance">Starting Balance ($)</Label>
            <Input
              id="starting-balance"
              type="number"
              placeholder="50000"
              value={formData.startingBalance}
              onChange={(e) => setFormData({ ...formData, startingBalance: e.target.value })}
              className="bg-background font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              Create Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
