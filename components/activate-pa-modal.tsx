"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Loader2 } from "lucide-react"
import type { Account, TopstepPayoutPath } from "@/lib/types"
import {
  defaultPaAccountName,
  getPaActivationRuleSummary,
} from "@/lib/pa-activation"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface ActivatePaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evalAccount: Account | null
  onConfirm: (args: {
    name: string
    activatedAtIso: string
    activationStartDate: string
    tradeifyProgram?: "select_flex" | "select_daily"
    topstepPayoutPath?: TopstepPayoutPath
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
  const [tradeifyPolicy, setTradeifyPolicy] = useState<"select_flex" | "select_daily">("select_flex")
  const [topstepPayoutPath, setTopstepPayoutPath] = useState<TopstepPayoutPath>("standard")

  const isTradeify = evalAccount?.firm === "Tradeify"
  const isTopstep = evalAccount?.firm === "Topstep"

  useEffect(() => {
    if (evalAccount && open) {
      setTradeifyPolicy("select_flex")
      setTopstepPayoutPath("standard")
      setName(
        isTradeify
          ? defaultPaAccountName(evalAccount, "select_flex")
          : defaultPaAccountName(evalAccount),
      )
      setActivationDate("")
    }
  }, [evalAccount, open, isTradeify])

  useEffect(() => {
    if (evalAccount && open && isTradeify) {
      setName(defaultPaAccountName(evalAccount, tradeifyPolicy))
    }
  }, [tradeifyPolicy, evalAccount, open, isTradeify])

  // getPaActivationRuleSummary calls getAccountRules, which throws for an
  // Alpha account with no alphaTier — a case that should be impossible today
  // (alphaTier is required at Eval creation) but this modal shouldn't crash
  // on click if that invariant is ever violated upstream. Guarded + memoized
  // so a bad input degrades to an inline error state instead of a white
  // screen.
  const summary = useMemo(() => {
    if (!evalAccount) return { lines: [] as string[], error: null as string | null }
    try {
      return {
        lines: getPaActivationRuleSummary(
          evalAccount,
          isTradeify ? tradeifyPolicy : undefined,
          isTopstep ? topstepPayoutPath : undefined,
        ),
        error: null,
      }
    } catch (err) {
      return {
        lines: [] as string[],
        error: err instanceof Error ? err.message : "Could not load rules for this account.",
      }
    }
  }, [evalAccount, isTradeify, tradeifyPolicy, isTopstep, topstepPayoutPath])

  if (!evalAccount) return null

  const ddLabel =
    evalAccount.drawdownType === "Intraday"
      ? "Intraday trailing"
      : "EOD (end of day)"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (summary.error) return
    const finalName =
      name.trim() ||
      defaultPaAccountName(evalAccount, isTradeify ? tradeifyPolicy : undefined)
    const activationStartDate =
      activationDate || new Date().toISOString().slice(0, 10)
    const activatedAtIso = new Date().toISOString()
    await onConfirm({
      name: finalName,
      activatedAtIso,
      activationStartDate,
      tradeifyProgram: isTradeify ? tradeifyPolicy : undefined,
      topstepPayoutPath: isTopstep ? topstepPayoutPath : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-tight">
            {isTradeify ? "Activate Funded Account" : "Activate Performance Account"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Firm</span>
              <span className="font-medium text-[var(--text)]">{evalAccount.firm}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Account size</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(evalAccount.accountSize)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Drawdown type</span>
              <span className="text-[var(--text)]">{ddLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Starting balance</span>
              <span className="font-mono tabular-nums text-[var(--text)]">
                {formatCurrency(evalAccount.accountSize)}
              </span>
            </div>
          </div>

          {isTradeify && (
            <div className="space-y-2">
              <Label>Choose payout policy (permanent)</Label>
              <div className="flex gap-0 rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] p-1">
                {(
                  [
                    { value: "select_flex" as const, label: "Select Flex" },
                    { value: "select_daily" as const, label: "Select Daily" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTradeifyPolicy(opt.value)}
                    className={cn(
                      "flex-1 rounded-[2px] px-2 py-2 text-sm font-medium transition-colors",
                      tradeifyPolicy === opt.value
                        ? "bg-[var(--text)] text-[var(--ground)]"
                        : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-medium text-[var(--text)]">
                This choice is permanent for this funded account.
              </p>
              <p className="text-[11px] text-muted-foreground">
                The resolved policy requirements appear below.
              </p>
            </div>
          )}

          {isTopstep && (
            <div className="space-y-2">
              <Label>Payout Path (permanent)</Label>
              <div className="flex gap-0 rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] p-1">
                {(
                  [
                    { value: "standard" as const, label: "Standard" },
                    { value: "consistency" as const, label: "Consistency" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTopstepPayoutPath(opt.value)}
                    className={cn(
                      "flex-1 rounded-[2px] px-2 py-2 text-sm font-medium transition-colors",
                      topstepPayoutPath === opt.value
                        ? "bg-[var(--text)] text-[var(--ground)]"
                        : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-medium text-[var(--text)]">
                This choice is permanent for this funded account.
              </p>
              <p className="text-[11px] text-muted-foreground">
                The resolved payout-path requirements appear below.
              </p>
            </div>
          )}

          {summary.error ? (
            <p className="flex items-start gap-2 text-sm font-medium text-[var(--text)] bg-[var(--raised)] px-3 py-2 rounded-[2px] border-l-2 border-[var(--text)]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              Couldn&apos;t load funded rules for this account: {summary.error}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isTradeify || isTopstep ? "Funded rule summary" : "PA rule summary"}
              </div>
              <ul className="list-inside list-disc space-y-1.5 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 py-2.5 text-xs text-[var(--muted)]">
                {summary.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pa-name">New account name</Label>
            <Input
              id="pa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultPaAccountName(
                evalAccount,
                isTradeify ? tradeifyPolicy : undefined,
              )}
              className="bg-background"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activation-date">Activation date (optional)</Label>
            <Input
              id="activation-date"
              type="date"
              value={activationDate}
              onChange={(e) => setActivationDate(e.target.value)}
              className="bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              PA metrics use trades on or after this date. Defaults to today.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || Boolean(summary.error)}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Activating…
                </>
              ) : (
                "Activate"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
