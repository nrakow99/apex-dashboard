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
import type { Account, AccountType, Firm, DrawdownType, TradeifyProgram, TopstepPayoutPath, AlphaTier } from "@/lib/types"
import { getAccountRules } from "@/lib/rules"
import { defaultTradeifyAccountName } from "@/lib/tradeify-rules"
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

/** Every firm/tier's valid account sizes — drives the Account Size dropdown.
 *  50000 is valid for every combination below, so it's always a safe
 *  fallback when a firm/tier switch invalidates the currently selected size. */
function validSizesFor(firm: Firm, alphaTier: AlphaTier): number[] {
  if (firm === "Topstep") return [50000, 100000, 150000]
  if (firm === "Alpha") return alphaTier === "zero" ? [25000, 50000, 100000] : [50000, 100000, 150000]
  return ACCOUNT_SIZES
}

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
    <div className="flex flex-wrap gap-1 p-1 bg-[#0F1115]/80 border border-white/[0.08] rounded-xl">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 basis-[30%] py-1.5 px-2 rounded-lg text-sm font-medium transition-all",
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

const INITIAL_FORM = {
  name: "",
  firm: "Apex" as Firm,
  type: "Eval" as AccountType,
  drawdownType: "EOD" as DrawdownType,
  accountSize: 50000,
  quantity: 1,
  program: "select_eval" as TradeifyProgram,
  topstepPayoutPath: "standard" as TopstepPayoutPath,
  hasDailyLossLimit: false,
  alphaTier: "standard" as AlphaTier,
}

export function AddAccountModal({ onAddAccount }: AddAccountModalProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const isTradeify = form.firm === "Tradeify"
  const isTopstep = form.firm === "Topstep"
  const isAlpha = form.firm === "Alpha"
  const forcesEod = isTradeify || isTopstep || isAlpha

  const tradeifyType: AccountType = form.program === "select_eval" ? "Eval" : "PA"
  const effectiveType = isTradeify ? tradeifyType : form.type

  // Render-safe clamp: never let a stale accountSize from a previous firm/tier
  // reach getAccountRules (e.g. Topstep throws below 50K, Alpha Zero throws
  // above 100K) — the useEffect below settles form.accountSize itself, but
  // this guards the render that happens before that effect runs.
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
    // Deliberately NOT passing maxDrawdown/dailyLossLimit: every firm/type
    // with a real rule table ignores these inputs entirely, but the generic
    // "Live" fallback in getAccountRules reads account.maxDrawdown back as
    // its own default (`?? 2000`). Passing a literal 0 here — instead of
    // just omitting the field — used to defeat that `??` (0 is not
    // null/undefined) and permanently persist maxDrawdown: 0 on every new
    // Live account, which then reads as a breached account with a 0/0
    // drawdown bar from the moment it's created.
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

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const qty = Math.max(1, Math.min(MAX_ACCOUNT_QUANTITY, Math.floor(form.quantity) || 1))
  const portfolioBuyingPower = getPortfolioBuyingPower({ accountSize: effectiveAccountSize, quantity: qty })

  const defaultName = () => {
    if (isTradeify) return defaultTradeifyAccountName(effectiveAccountSize, form.program)
    const firmLabel = isAlpha ? `Alpha ${form.alphaTier[0].toUpperCase()}${form.alphaTier.slice(1)}` : form.firm
    return `${firmLabel} ${(effectiveAccountSize / 1000).toFixed(0)}K ${effectiveType}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAddAccount({
      name: form.name || defaultName(),
      firm: form.firm,
      type: effectiveType,
      status: "Active",
      drawdownType: forcesEod ? "EOD" : form.drawdownType,
      accountSize: effectiveAccountSize,
      quantity: qty,
      balance: effectiveAccountSize,
      startingBalance: effectiveAccountSize,
      maxBalance: effectiveAccountSize,
      profitTarget: rules.hasProfitTarget ? rules.profitTarget : undefined,
      maxDrawdown: rules.maxDrawdown,
      dailyLossLimit: rules.hasDLL ? rules.dailyLossLimit : 0,
      program: isTradeify ? form.program : undefined,
      hasDailyLossLimit: isTopstep ? form.hasDailyLossLimit : undefined,
      topstepPayoutPath: isTopstep && effectiveType === "PA" ? form.topstepPayoutPath : undefined,
      alphaTier: isAlpha ? form.alphaTier : undefined,
    })
    setOpen(false)
    setForm(INITIAL_FORM)
  }

  const showDrawdownSelector = form.firm === "Apex"
  const showApexTypeSelector = !isTradeify

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">

          {/* Account Name */}
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input
              placeholder={`e.g., ${defaultName()}`}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="bg-background"
            />
          </div>

          {/* Firm */}
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
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  firm: v,
                  drawdownType: v === "Apex" ? f.drawdownType : "EOD",
                  program: v === "Tradeify" ? "select_eval" : f.program,
                }))
              }
            />
          </div>

          {isTradeify ? (
            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={form.program}
                onValueChange={(v) => set("program", v as TradeifyProgram)}
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
          ) : showApexTypeSelector ? (
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
          ) : null}

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

          <div className="grid grid-cols-2 gap-3">
            {/* Account Size — filtered to what the selected firm/tier actually offers */}
            <div className="space-y-2">
              <Label>Account Size</Label>
              <Select
                value={String(effectiveAccountSize)}
                onValueChange={(v) => set("accountSize", Number(v))}
              >
                <SelectTrigger className="bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validSizes.map((s) => (
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
              {formatAccountBundleHelper({ accountSize: effectiveAccountSize, quantity: qty })} · Portfolio buying power{" "}
              <span className="font-mono text-[#94AAB8]">${portfolioBuyingPower.toLocaleString()}</span>
              <span className="block mt-0.5">Rules track one representative ${(effectiveAccountSize / 1000).toFixed(0)}K account.</span>
            </p>
          )}

          {/* Drawdown Type (Apex only — every other firm's rule engine ignores this field) */}
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
                />
                <p className="text-[11px] text-muted-foreground">
                  Optional at checkout. Doubles the funded payout ceiling when elected.
                </p>
              </div>
            </>
          )}

          {/* Rule preview — every figure below reads straight from getAccountRules().
              Never hardcode a second copy of these numbers here. */}
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
            {rules.minTradingDays > 0 && (
              <div className="flex justify-between">
                <span>Min Trading Days</span>
                <span className="font-mono">{rules.minTradingDays}</span>
              </div>
            )}
            {rules.minProfitDays > 0 && (
              <div className="flex justify-between">
                <span>{rules.winningDayThreshold > 0 ? "Winning Days" : "Qualifying Days"}</span>
                <span className="font-mono">
                  {rules.minProfitDays}
                  {rules.winningDayThreshold > 0 ? ` ($${rules.winningDayThreshold}+)` : ""}
                </span>
              </div>
            )}
            {rules.hasPayouts && rules.payoutAbsoluteCap > 0 && (
              <div className="flex justify-between">
                <span>Payout Cap</span>
                <span className="font-mono">${rules.payoutAbsoluteCap.toLocaleString()}</span>
              </div>
            )}
            {rules.hasPayouts && (
              <div className="flex justify-between">
                <span>Min Payout</span>
                <span className="font-mono">${rules.minPayoutAmount.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Account</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
