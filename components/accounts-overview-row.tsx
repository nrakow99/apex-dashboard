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
    <div className="mb-2.5 grid grid-cols-2 gap-1.5 sm:mb-5 sm:gap-3 lg:grid-cols-4">
      {CELLS.map((cell) => (
        <div
          key={cell.topic}
          className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2.5 sm:px-4 sm:py-3"
        >
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {cell.label}
            <InfoHint topic={cell.topic} />
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums tracking-tight text-[var(--text)] sm:text-lg">
            {cell.value(overview)}
          </p>
        </div>
      ))}
    </div>
  )
}
