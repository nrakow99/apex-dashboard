"use client"

import { InfoHint } from "@/components/info-hint"
import { formatCurrency } from "@/lib/utils"
import type { AccountsOverview } from "@/lib/accounts-overview"
import type { RuleCopyKey } from "@/lib/rule-copy"

interface AccountsOverviewRowProps {
  overview: AccountsOverview
}

const CELLS: {
  topic: RuleCopyKey
  label: string
  value: (overview: AccountsOverview) => string
}[] = [
  {
    topic: "roomToday",
    label: "Room today",
    value: (o) => formatCurrency(o.roomToday),
  },
  {
    topic: "atRisk",
    label: "At risk",
    value: (o) => String(o.atRisk),
  },
  {
    topic: "payoutReady",
    label: "Payout ready",
    value: (o) => String(o.payoutReady),
  },
  {
    topic: "needsUpdate",
    label: "Needs update",
    value: (o) => String(o.needsUpdate),
  },
]

export function AccountsOverviewRow({ overview }: AccountsOverviewRowProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-[var(--hairline)] bg-[var(--hairline)] lg:grid-cols-4">
      {CELLS.map((cell) => (
        <div
          key={cell.topic}
          className="bg-[#101012] px-4 py-4 sm:px-5 sm:py-5"
        >
          <p className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {cell.label}
            <InfoHint topic={cell.topic} />
          </p>
          <p className="mt-2 font-mono text-xl font-medium tabular-nums tracking-[-0.04em] text-[var(--text)] sm:text-2xl">
            {cell.value(overview)}
          </p>
        </div>
      ))}
    </div>
  )
}
