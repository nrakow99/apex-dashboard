"use client"

import { useMemo, useState } from "react"
import { Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localTodayKey } from "@/lib/date-utils"
import { simulatePayoutImpact } from "@/lib/payout-planner"
import type { Account, Payout, Trade } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

interface Props {
  account: Account
  trades: Trade[]
  payouts: Payout[]
  minAmount: number
  maxAmount: number
  eligible: boolean
}

export function PayoutImpactPlanner({ account, trades, payouts, minAmount, maxAmount, eligible }: Props) {
  const [amount, setAmount] = useState(eligible && maxAmount > 0 ? String(maxAmount) : "")
  const numericAmount = Number(amount)
  const result = useMemo(
    () => simulatePayoutImpact(account, trades, payouts, numericAmount, localTodayKey()),
    [account, numericAmount, payouts, trades],
  )

  return (
    <section className="mt-5 border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]"><Calculator className="h-4 w-4" /></span>
        <div><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">What-if planner</p><h2 className="mt-1 text-lg font-medium">Payout impact</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">Test a request against the current verified rules. This scenario does not save or submit anything.</p></div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="space-y-2"><Label htmlFor={`impact-${account.id}`}>Scenario amount</Label><Input id={`impact-${account.id}`} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" disabled={!eligible} /></div>
        <Button type="button" variant="outline" disabled={!eligible} onClick={() => setAmount(String(minAmount))}>Minimum</Button>
        <Button type="button" variant="outline" disabled={!eligible} onClick={() => setAmount(String(maxAmount))}>Maximum</Button>
      </div>

      {!eligible ? <p className="mt-4 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-xs text-[var(--muted)]">Complete the current payout requirements before modeling a request.</p> : !result.available ? <p className="mt-4 text-xs text-[var(--muted)]">{result.reason}</p> : (
        <div className="mt-5 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-4">
          <Impact label="Trader receives" value={formatCurrency(result.impact.traderReceives)} />
          <Impact label="Post-request balance" value={formatCurrency(result.impact.postRequestBalance)} />
          <Impact label="Active floor after" value={formatCurrency(result.impact.postRequestFloor)} supporting={result.impact.floorLocksOnPayout ? "Verified payout floor lock applies" : "Calculated from the scenario"} />
          <Impact label="Floor room after" value={formatCurrency(result.impact.postRequestDrawdownRemaining)} />
          <div className="bg-[var(--surface)] p-4 sm:col-span-2 xl:col-span-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Next verified requirement</p><p className="mt-2 text-sm">{result.impact.nextRequirement}</p></div>
        </div>
      )}
    </section>
  )
}

function Impact({ label, value, supporting }: { label: string; value: string; supporting?: string }) {
  return <div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p><p className="mt-2 font-mono text-base">{value}</p>{supporting && <p className="mt-1 text-[10px] text-[var(--muted)]">{supporting}</p>}</div>
}
