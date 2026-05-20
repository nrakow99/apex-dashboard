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
import { cn } from "@/lib/utils"
import type { Account, AccountType, Firm, DrawdownType } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import {
  formatAccountBundleHelper,
  getAccountStartingBalance,
  MAX_ACCOUNT_QUANTITY,
} from "@/lib/account-quantity"

const ACCOUNT_SIZES = [25000, 50000, 100000, 150000]

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-0 p-1 bg-[#0F1115]/80 border border-white/[0.08] rounded-xl">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-lg text-sm font-medium transition-all",
            value === opt.value
              ? "bg-[#1E2229] text-[#E5E4E2] shadow-[inset_0_0_0_1px_rgba(83,104,120,0.40),inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "text-slate-500 hover:text-[#E5E4E2]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface EditAccountModalProps {
  account: Account | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (accountId: string, updates: {
    name: string
    firm: Firm
    type: AccountType
    status: "Active" | "Inactive" | "Breached" | "Passed"
    drawdownType: DrawdownType
    accountSize: number
    quantity: number
    startingBalance: number
    maxDrawdown: number
    dailyLossLimit: number | null
    profitTarget?: number | null
  }) => Promise<void>
  isSaving?: boolean
}

export function EditAccountModal({
  account,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: EditAccountModalProps) {
  const [form, setForm] = useState({
    name: "",
    firm: "Apex" as Firm,
    type: "Eval" as AccountType,
    status: "Active" as "Active" | "Inactive" | "Breached" | "Passed",
    drawdownType: "EOD" as DrawdownType,
    accountSize: 50000,
    quantity: 1,
    startingBalance: "",
    maxDrawdown: "",
    dailyLossLimit: "",
    profitTarget: "",
  })

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name,
        firm: account.firm ?? "Apex",
        type: account.type,
        status: account.status,
        drawdownType: account.drawdownType ?? "EOD",
        accountSize: account.accountSize ?? 50000,
        quantity: account.quantity ?? 1,
        startingBalance: account.startingBalance.toString(),
        maxDrawdown: account.maxDrawdown.toString(),
        dailyLossLimit: (account.dailyLossLimit ?? "").toString(),
        profitTarget: account.profitTarget?.toString() ?? "",
      })
    }
  }, [account])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const rules = getAccountRules({
    firm: form.firm,
    type: form.type,
    drawdownType: form.drawdownType,
    accountSize: form.accountSize,
  })

  const qty = Math.max(1, Math.min(MAX_ACCOUNT_QUANTITY, Math.floor(form.quantity) || 1))
  const aggregateStarting = getAccountStartingBalance({
    accountSize: form.accountSize,
    quantity: qty,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) return
    await onSave(account.id, {
      name: form.name,
      firm: form.firm,
      type: form.type,
      status: form.status,
      drawdownType: form.drawdownType,
      accountSize: form.accountSize,
      quantity: qty,
      startingBalance: aggregateStarting,
      maxDrawdown: parseFloat(form.maxDrawdown) || rules.maxDrawdown,
      dailyLossLimit: rules.hasDLL ? (parseFloat(form.dailyLossLimit) || rules.dailyLossLimit) : null,
      profitTarget: form.type === "Eval" && form.profitTarget ? parseFloat(form.profitTarget) : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="bg-background"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label>Firm</Label>
            <SegmentedControl
              options={[{ value: "Apex", label: "Apex" }, { value: "Lucid", label: "Lucid" }]}
              value={form.firm}
              onChange={(v) => set("firm", v)}
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={form.type} onValueChange={(v: AccountType) => set("type", v)} disabled={isSaving}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Eval">Eval</SelectItem>
                  <SelectItem value="PA">PA / Funded</SelectItem>
                  <SelectItem value="Live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: "Active" | "Inactive" | "Breached" | "Passed") => set("status", v)}
                disabled={isSaving}
              >
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
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
              <Label>Account Size (each)</Label>
              <Select value={String(form.accountSize)} onValueChange={(v) => set("accountSize", Number(v))} disabled={isSaving}>
                <SelectTrigger className="bg-background h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>${s.toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Accounts</Label>
              <Input
                type="number"
                min={1}
                max={MAX_ACCOUNT_QUANTITY}
                step={1}
                value={form.quantity}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  set("quantity", Number.isFinite(n) ? n : 1)
                }}
                className="bg-background font-mono h-9"
                disabled={isSaving}
              />
            </div>
          </div>
          {qty > 1 && (
            <p className="text-[11px] text-muted-foreground -mt-2">
              {formatAccountBundleHelper({ accountSize: form.accountSize, quantity: qty })} · Aggregate starting{" "}
              <span className="font-mono text-[#94AAB8]">${aggregateStarting.toLocaleString()}</span>
            </p>
          )}

          {form.firm === "Apex" && (
            <div className="space-y-2">
              <Label>Drawdown Type</Label>
              <SegmentedControl
                options={[
                  { value: "EOD", label: "EOD Drawdown" },
                  { value: "Intraday", label: "Intraday Trailing" },
                ]}
                value={form.drawdownType}
                onChange={(v) => set("drawdownType", v)}
                disabled={isSaving}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Drawdown ($)</Label>
              <Input
                type="number"
                value={form.maxDrawdown}
                onChange={(e) => set("maxDrawdown", e.target.value)}
                className="bg-background font-mono"
                disabled={isSaving}
              />
            </div>
            {rules.hasDLL && (
              <div className="space-y-2">
                <Label>Daily Loss Limit ($)</Label>
                <Input
                  type="number"
                  value={form.dailyLossLimit}
                  onChange={(e) => set("dailyLossLimit", e.target.value)}
                  className="bg-background font-mono"
                  disabled={isSaving}
                />
              </div>
            )}
          </div>

          {form.type === "Eval" && (
            <div className="space-y-2">
              <Label>Profit Target ($)</Label>
              <Input
                type="number"
                value={form.profitTarget}
                onChange={(e) => set("profitTarget", e.target.value)}
                className="bg-background font-mono"
                disabled={isSaving}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
