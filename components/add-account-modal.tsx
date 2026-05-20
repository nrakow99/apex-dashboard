"use client"

import { useState, useEffect } from "react"
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
import type { Account, AccountType, Firm, DrawdownType } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import {
  formatAccountBundleHelper,
  getPortfolioBuyingPower,
  MAX_ACCOUNT_QUANTITY,
} from "@/lib/account-quantity"
import { cn } from "@/lib/utils"

interface AddAccountModalProps {
  onAddAccount: (account: Omit<Account, "id">) => void
}

const ACCOUNT_SIZES = [25000, 50000, 100000, 150000]

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-0 p-1 bg-[#0F1115]/80 border border-white/[0.08] rounded-xl">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-lg text-sm font-medium transition-all",
            value === opt.value
              ? "bg-[#1E2229] text-[#E5E4E2] shadow-[inset_0_0_0_1px_rgba(83,104,120,0.40),inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "text-slate-500 hover:text-[#E5E4E2]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function AddAccountModal({ onAddAccount }: AddAccountModalProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    firm: "Apex" as Firm,
    type: "Eval" as AccountType,
    drawdownType: "EOD" as DrawdownType,
    accountSize: 50000,
    quantity: 1,
  })

  // Auto-derive rules whenever firm/type/drawdown/size changes
  const rules = getAccountRules({ ...form, maxDrawdown: 0, dailyLossLimit: 0 })

  // Reset drawdown type when Lucid is selected (Lucid defaults to EOD)
  useEffect(() => {
    if (form.firm === "Lucid" && form.drawdownType === "Intraday") {
      setForm((f) => ({ ...f, drawdownType: "EOD" }))
    }
  }, [form.firm, form.drawdownType])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const qty = Math.max(1, Math.min(MAX_ACCOUNT_QUANTITY, Math.floor(form.quantity) || 1))
  const portfolioBuyingPower = getPortfolioBuyingPower({ accountSize: form.accountSize, quantity: qty })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAddAccount({
      name: form.name || `${form.firm} ${(form.accountSize / 1000).toFixed(0)}K ${form.type}`,
      firm: form.firm,
      type: form.type,
      status: "Active",
      drawdownType: form.drawdownType,
      accountSize: form.accountSize,
      quantity: qty,
      balance: form.accountSize,
      startingBalance: form.accountSize,
      maxBalance: form.accountSize,
      profitTarget: rules.hasProfitTarget ? rules.profitTarget : undefined,
      maxDrawdown: rules.maxDrawdown,
      dailyLossLimit: rules.dailyLossLimit,
    })
    setOpen(false)
    setForm({ name: "", firm: "Apex", type: "Eval", drawdownType: "EOD", accountSize: 50000, quantity: 1 })
  }

  const showDrawdownSelector = form.firm === "Apex"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">

          {/* Account Name */}
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input
              placeholder={`e.g., ${form.firm} ${(form.accountSize / 1000).toFixed(0)}K ${form.type}`}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="bg-background"
            />
          </div>

          {/* Firm */}
          <div className="space-y-2">
            <Label>Firm</Label>
            <SegmentedControl
              options={[{ value: "Apex", label: "Apex" }, { value: "Lucid", label: "Lucid" }]}
              value={form.firm}
              onChange={(v) => set("firm", v)}
            />
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label>Account Type</Label>
            <SegmentedControl
              options={[
                { value: "Eval", label: "Eval" },
                { value: "PA", label: "PA / Funded" },
                { value: "Live", label: "Live" },
              ]}
              value={form.type}
              onChange={(v) => set("type", v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Account Size */}
            <div className="space-y-2">
              <Label>Account Size</Label>
              <Select
                value={String(form.accountSize)}
                onValueChange={(v) => set("accountSize", Number(v))}
              >
                <SelectTrigger className="bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      ${s.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Number of Accounts */}
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
              />
            </div>
          </div>
          {qty > 1 && (
            <p className="text-[11px] text-muted-foreground -mt-2">
              {formatAccountBundleHelper({ accountSize: form.accountSize, quantity: qty })} · Portfolio buying power{" "}
              <span className="font-mono text-[#94AAB8]">${portfolioBuyingPower.toLocaleString()}</span>
              <span className="block mt-0.5">Rules track one representative ${(form.accountSize / 1000).toFixed(0)}K account.</span>
            </p>
          )}

          {/* Drawdown Type (Apex only) */}
          {showDrawdownSelector && (
            <div className="space-y-2">
              <Label>Drawdown Type</Label>
              <SegmentedControl
                options={[
                  { value: "EOD", label: "EOD Drawdown" },
                  { value: "Intraday", label: "Intraday Trailing" },
                ]}
                value={form.drawdownType}
                onChange={(v) => set("drawdownType", v)}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.drawdownType === "Intraday"
                  ? "Floor trails peak balance in real time"
                  : "Floor updates after the trading day close"}
              </p>
            </div>
          )}

          {/* Rule preview */}
          <div className="p-3 rounded-xl bg-[#0F1115]/70 border border-white/[0.07] text-xs text-slate-400 space-y-1">
            <div className="font-medium text-foreground mb-1">Account Rules</div>
            <div className="flex justify-between">
              <span>Max Drawdown</span>
              <span className="font-mono">${rules.maxDrawdown.toLocaleString()}</span>
            </div>
            {rules.hasDLL && (
              <div className="flex justify-between">
                <span>Daily Loss Limit</span>
                <span className="font-mono">${rules.dailyLossLimit.toLocaleString()}</span>
              </div>
            )}
            {rules.hasProfitTarget && (
              <div className="flex justify-between">
                <span>Profit Target</span>
                <span className="font-mono">${rules.profitTarget.toLocaleString()}</span>
              </div>
            )}
            {rules.maxContracts && (
              <div className="flex justify-between">
                <span>Max Size</span>
                <span className="font-mono">{rules.maxContracts}</span>
              </div>
            )}
            {rules.hasConsistency && (
              <div className="flex justify-between">
                <span>Consistency Rule</span>
                <span className="font-mono">{rules.consistencyPercent}%</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Create Account</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
