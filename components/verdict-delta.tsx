"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { verdictLabel, type VerdictDelta } from "@/lib/verdict"

function signedAmount(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${formatCurrency(Math.abs(value))}`
}

export function VerdictDeltaPanel({ deltas, onDismiss }: { deltas: VerdictDelta[]; onDismiss: () => void }) {
  if (deltas.length === 0) return null
  return <section className="mb-6 border border-[var(--hairline)] bg-[var(--surface)]">
    <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4">
      <div><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">Result saved</p><h2 className="mt-1 text-base font-medium">What changed</h2><p className="mt-1 text-[11px] text-[var(--muted)]">Account state recalculated from the result you just recorded.</p></div>
      <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss change summary"><X className="h-4 w-4" /></Button>
    </div>
    <div className="divide-y divide-[var(--hairline)]">
      {deltas.map((delta) => <div key={delta.accountId} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_190px_180px] sm:items-center">
        <div><p className="text-sm font-medium">{delta.accountName}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{verdictLabel[delta.previous]} → {verdictLabel[delta.current]}</p></div>
        <div><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Verified room change</p><p className="mt-1 font-mono text-sm">{delta.dollarsOfRoomChange == null ? "Unavailable" : signedAmount(delta.dollarsOfRoomChange)}</p></div>
        <div><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Estimated full-stop change</p><p className="mt-1 font-mono text-sm">{delta.tradesOfRoomChange == null ? "Unavailable" : `${delta.tradesOfRoomChange > 0 ? "+" : ""}${delta.tradesOfRoomChange} losses`}</p></div>
      </div>)}
    </div>
  </section>
}
