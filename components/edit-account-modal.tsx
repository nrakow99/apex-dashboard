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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { Account, AccountType } from "@/lib/types"

interface EditAccountModalProps {
  account: Account | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (accountId: string, updates: {
    name: string
    type: AccountType
    status: "Active" | "Inactive" | "Breached" | "Passed"
    startingBalance: number
    maxDrawdown: number
    dailyLossLimit: number
    profitTarget?: number
  }) => Promise<void>
  isSaving?: boolean
}

export function EditAccountModal({ 
  account, 
  open, 
  onOpenChange, 
  onSave,
  isSaving = false 
}: EditAccountModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "Eval" as AccountType,
    status: "Active" as "Active" | "Inactive" | "Breached" | "Passed",
    startingBalance: "",
    maxDrawdown: "",
    dailyLossLimit: "",
    profitTarget: "",
  })

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        status: account.status,
        startingBalance: account.startingBalance.toString(),
        maxDrawdown: account.maxDrawdown.toString(),
        dailyLossLimit: account.dailyLossLimit.toString(),
        profitTarget: account.profitTarget?.toString() ?? "",
      })
    }
  }, [account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) return

    await onSave(account.id, {
      name: formData.name,
      type: formData.type,
      status: formData.status,
      startingBalance: parseFloat(formData.startingBalance) || 50000,
      maxDrawdown: parseFloat(formData.maxDrawdown) || 2000,
      dailyLossLimit: parseFloat(formData.dailyLossLimit) || 1000,
      profitTarget: formData.type === "Eval" && formData.profitTarget 
        ? parseFloat(formData.profitTarget) 
        : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-account-name">Account Name</Label>
            <Input
              id="edit-account-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-background"
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-account-type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: AccountType) => setFormData({ ...formData, type: value })}
                disabled={isSaving}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Eval">Eval</SelectItem>
                  <SelectItem value="PA">PA</SelectItem>
                  <SelectItem value="Live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-account-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "Active" | "Inactive" | "Breached" | "Passed") => 
                  setFormData({ ...formData, status: value })
                }
                disabled={isSaving}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Passed">Passed</SelectItem>
                  <SelectItem value="Breached">Breached</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-starting-balance">Starting Balance ($)</Label>
              <Input
                id="edit-starting-balance"
                type="number"
                value={formData.startingBalance}
                onChange={(e) => setFormData({ ...formData, startingBalance: e.target.value })}
                className="bg-background font-mono"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-max-drawdown">Max Drawdown ($)</Label>
              <Input
                id="edit-max-drawdown"
                type="number"
                value={formData.maxDrawdown}
                onChange={(e) => setFormData({ ...formData, maxDrawdown: e.target.value })}
                className="bg-background font-mono"
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-daily-loss">Daily Loss Limit ($)</Label>
              <Input
                id="edit-daily-loss"
                type="number"
                value={formData.dailyLossLimit}
                onChange={(e) => setFormData({ ...formData, dailyLossLimit: e.target.value })}
                className="bg-background font-mono"
                disabled={isSaving}
              />
            </div>

            {formData.type === "Eval" && (
              <div className="space-y-2">
                <Label htmlFor="edit-profit-target">Profit Target ($)</Label>
                <Input
                  id="edit-profit-target"
                  type="number"
                  value={formData.profitTarget}
                  onChange={(e) => setFormData({ ...formData, profitTarget: e.target.value })}
                  className="bg-background font-mono"
                  disabled={isSaving}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
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
