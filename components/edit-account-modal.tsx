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
import type { Account, AccountType, Firm, DrawdownType, TradeifyProgram, TopstepPayoutPath, AlphaTier } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { defaultTradeifyAccountName } from "@/lib/tradeify-rules"
import {
  formatAccountBundleHelper,
  getPortfolioBuyingPower,
  getRuleStartingBalance,
  MAX_ACCOUNT_QUANTITY,
} from "@/lib/account-quantity"

const ACCOUNT_SIZES = [25000, 50000, 100000, 150000]

/** Same table as add-account-modal.tsx — keep in sync. 50000 is valid for
 *  every combination, so it's always a safe fallback size. */
function validSizesFor(firm: Firm, alphaTier: AlphaTier): number[] {
  if (firm === "Topstep") return [50000, 100000, 150000]
  if (firm === "Alpha") return alphaTier === "zero" ? [25000, 50000, 100000] : [50000, 100000, 150000]
  return ACCOUNT_SIZES
}

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
    program?: TradeifyProgram | null
    hasDailyLossLimit?: boolean
    topstepPayoutPath?: TopstepPayoutPath | null
    alphaTier?: AlphaTier | null
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
    program: "select_eval" as TradeifyProgram,
    topstepPayoutPath: "standard" as TopstepPayoutPath,
    hasDailyLossLimit: false,
    alphaTier: "standard" as AlphaTier,
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
        program:
          account.program ??
          (account.type === "Eval" ? "select_eval" : "select_flex"),
        topstepPayoutPath: account.topstepPayoutPath ?? "standard",
        hasDailyLossLimit: account.hasDailyLossLimit ?? false,
        alphaTier: account.alphaTier ?? "standard",
      })
    }
  }, [account])

  useEffect(() => {
    if ((form.firm === "Lucid" || form.firm === "Tradeify") && form.drawdownType === "Intraday") {
      setForm((f) => ({ ...f, drawdownType: "EOD" }))
    }
  }, [form.firm, form.drawdownType])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const isTradeify = form.firm === "Tradeify"
  const isTopstep = form.firm === "Topstep"
  const isAlpha = form.firm === "Alpha"
  const forcesEod = isTradeify || isTopstep || isAlpha
  const tradeifyType: AccountType =
    form.program === "select_eval" ? "Eval" : "PA"
  const effectiveType = isTradeify ? tradeifyType : form.type

  // Render-safe clamp: never let a stale accountSize from a previous
  // firm/tier reach getAccountRules (Topstep throws below 50K, Alpha Zero
  // throws above 100K) — the useEffect below settles form.accountSize
  // itself, but this guards the render that happens before that effect runs.
  const validSizes = validSizesFor(form.firm, form.alphaTier)
  const effectiveAccountSize = validSizes.includes(form.accountSize) ? form.accountSize : 50000

  const rules = getAccountRules({
    firm: form.firm,
    type: effectiveType,
    drawdownType: forcesEod ? "EOD" : form.drawdownType,
    accountSize: effectiveAccountSize,
    program: isTradeify ? form.program : undefined,
    hasDailyLossLimit: isTopstep ? form.hasDailyLossLimit : undefined,
    topstepPayoutPath: isTopstep ? form.topstepPayoutPath : undefined,
    alphaTier: isAlpha ? form.alphaTier : undefined,
  })

  useEffect(() => {
    if (forcesEod && form.drawdownType === "Intraday") {
      setForm((f) => ({ ...f, drawdownType: "EOD" }))
    }
  }, [forcesEod, form.drawdownType])

  useEffect(() => {
    if (!validSizesFor(form.firm, form.alphaTier).includes(form.accountSize)) {
      setForm((f) => ({ ...f, accountSize: 50000 }))
    }
  }, [form.firm, form.alphaTier, form.accountSize])

  const qty = Math.max(1, Math.min(MAX_ACCOUNT_QUANTITY, Math.floor(form.quantity) || 1))
  const portfolioBuyingPower = getPortfolioBuyingPower({ accountSize: effectiveAccountSize, quantity: qty })
  const ruleStartingBalance = account
    ? getRuleStartingBalance({ ...account, accountSize: effectiveAccountSize, quantity: qty })
    : effectiveAccountSize

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) return
    await onSave(account.id, {
      name: form.name || (isTradeify ? defaultTradeifyAccountName(effectiveAccountSize, form.program) : form.name),
      firm: form.firm,
      type: effectiveType,
      status: form.status,
      drawdownType: forcesEod ? "EOD" : form.drawdownType,
      accountSize: effectiveAccountSize,
      quantity: qty,
      startingBalance: ruleStartingBalance,
      maxDrawdown: parseFloat(form.maxDrawdown) || rules.maxDrawdown,
      dailyLossLimit: rules.hasDLL ? (parseFloat(form.dailyLossLimit) || rules.dailyLossLimit) : null,
      profitTarget:
        effectiveType === "Eval" && form.profitTarget
          ? parseFloat(form.profitTarget)
          : effectiveType === "Eval" && rules.hasProfitTarget
            ? rules.profitTarget
            : null,
      program: isTradeify ? form.program : null,
      // Always send the current form value (not conditionally omitted) so a
      // save always round-trips these fields — including firm switches away
      // from Topstep/Alpha, which correctly clears them via null/false.
      hasDailyLossLimit: isTopstep ? form.hasDailyLossLimit : false,
      topstepPayoutPath: isTopstep ? form.topstepPayoutPath : null,
      alphaTier: isAlpha ? form.alphaTier : null,
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
              options={[
                { value: "Apex", label: "Apex" },
                { value: "Lucid", label: "Lucid" },
                { value: "Tradeify", label: "Tradeify" },
                { value: "Topstep", label: "Topstep" },
                { value: "Alpha", label: "Alpha" },
              ]}
              value={form.firm}
              onChange={(v) => {
                setForm((f) => ({
                  ...f,
                  firm: v,
                  drawdownType: v === "Apex" ? f.drawdownType : "EOD",
                  program: v === "Tradeify" ? "select_eval" : f.program,
                }))
              }}
              disabled={isSaving}
            />
          </div>

          {/* Alpha Tier — a rule-variant choice independent of Eval/PA, required for every Alpha account */}
          {isAlpha && (
            <div className="space-y-2">
              <Label>Alpha Tier</Label>
              <SegmentedControl
                options={[
                  { value: "zero", label: "Zero" },
                  { value: "standard", label: "Standard" },
                  { value: "advanced", label: "Advanced" },
                ]}
                value={form.alphaTier}
                onChange={(v) => set("alphaTier", v)}
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.alphaTier === "zero"
                  ? "No consistency rule at Eval. Daily Loss Guard at both stages. Sizes: 25K/50K/100K."
                  : form.alphaTier === "standard"
                    ? "Daily Loss Guard applies once funded only. Sizes: 50K/100K/150K."
                    : "No Daily Loss Guard, no consistency rule at either stage. Sizes: 50K/100K/150K."}
              </p>
            </div>
          )}

          {isTradeify ? (
            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={form.program}
                onValueChange={(v) => set("program", v as TradeifyProgram)}
                disabled={isSaving}
              >
                <SelectTrigger className="bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select_eval">Select Evaluation</SelectItem>
                  <SelectItem value="select_flex">Select Flex Funded</SelectItem>
                  <SelectItem value="select_daily">Select Daily Funded</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Tradeify Select uses EOD drawdown only.</p>
            </div>
          ) : (
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
          )}

          {isTradeify && (
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Size (each)</Label>
              <Select
                value={String(effectiveAccountSize)}
                onValueChange={(v) => set("accountSize", Number(v))}
                disabled={isSaving}
              >
                <SelectTrigger className="bg-background h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {validSizes.map((s) => (
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
              {formatAccountBundleHelper({ accountSize: effectiveAccountSize, quantity: qty })} · Portfolio buying power{" "}
              <span className="font-mono text-[#94AAB8]">${portfolioBuyingPower.toLocaleString()}</span>
              <span className="block mt-0.5">Rules track one representative account (starting ${ruleStartingBalance.toLocaleString()}).</span>
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

          {/* Topstep: payout path (funded stage only) + DLL election (either stage) */}
          {isTopstep && (
            <>
              {effectiveType === "PA" && (
                <div className="space-y-2">
                  <Label>Payout Path</Label>
                  <SegmentedControl
                    options={[
                      { value: "standard", label: "Standard" },
                      { value: "consistency", label: "Consistency" },
                    ]}
                    value={form.topstepPayoutPath}
                    onChange={(v) => set("topstepPayoutPath", v)}
                    disabled={isSaving}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {form.topstepPayoutPath === "consistency"
                      ? "Higher payout ceiling. 40% consistency rule applies; 3 trading days required, no winning-day count."
                      : "5 winning days of $150+ required. No consistency rule."}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Daily Loss Limit</Label>
                <SegmentedControl
                  options={[
                    { value: "yes", label: "Elected" },
                    { value: "no", label: "Not Elected" },
                  ]}
                  value={form.hasDailyLossLimit ? "yes" : "no"}
                  onChange={(v) => set("hasDailyLossLimit", v === "yes")}
                  disabled={isSaving}
                />
                <p className="text-[11px] text-muted-foreground">
                  Optional at checkout. Doubles the funded payout ceiling when elected.
                </p>
              </div>
            </>
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

          {effectiveType === "Eval" && (
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
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
