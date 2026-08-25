"use client"

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatPnL, pnlColorClass } from "@/lib/utils"
import { tradeReviewAreaCount } from "@/lib/trades-workspace"
import type { Account, Trade } from "@/lib/types"

interface GlobalTradesTableProps {
  trades: Trade[]
  accounts: Account[]
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

function localDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function ReviewContext({ trade }: { trade: Trade }) {
  const captured = tradeReviewAreaCount(trade)
  const labels = [trade.session?.replace("ny_", "NY ").replace("am", "AM").replace("pm", "PM"), trade.grade, trade.setupTags?.[0]].filter(Boolean)
  if (captured === 0) return <span className="text-[11px] text-[var(--faint)]">Not reviewed</span>
  return (
    <div>
      <p className="text-xs text-[var(--text)]">{captured} of 4 areas</p>
      {labels.length > 0 && <p className="mt-1 max-w-[240px] truncate text-[10px] text-[var(--muted)]">{labels.join(" · ")}</p>}
    </div>
  )
}

export function GlobalTradesTable({ trades, accounts, onEdit, onDelete }: GlobalTradesTableProps) {
  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  if (trades.length === 0) {
    return <div className="border border-[var(--hairline)] bg-[var(--surface)] px-5 py-14 text-center"><p className="text-sm font-medium">No matching trade records</p><p className="mt-1 text-xs text-[var(--muted)]">Change the filters or add a trade to start a review.</p></div>
  }

  return (
    <div className="overflow-hidden border border-[var(--hairline)] bg-[var(--surface)]">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--hairline)] bg-[var(--raised)] text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Symbol</th>
              <th className="px-4 py-3 text-right font-medium">Net P&amp;L</th>
              <th className="px-4 py-3 font-medium">Review context</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {trades.map((trade) => {
              const account = accountMap.get(trade.accountId)
              return (
                <tr key={trade.id} className="transition-colors hover:bg-[var(--raised)]/60">
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs">{localDate(trade.date)}</td>
                  <td className="px-4 py-3.5"><p className="max-w-[190px] truncate text-xs">{account?.name ?? "Unavailable account"}</p><p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{account ? `${account.firm} · ${account.type}` : "Account removed"}</p></td>
                  <td className="px-4 py-3.5"><span className="border border-[var(--hairline)] bg-[var(--raised)] px-2 py-1 font-mono text-[11px]">{trade.symbol}</span></td>
                  <td className={cn("px-4 py-3.5 text-right font-mono text-sm", pnlColorClass(trade.pnl))}>{formatPnL(trade.pnl)}</td>
                  <td className="px-4 py-3.5"><ReviewContext trade={trade} /></td>
                  <td className="px-4 py-3.5 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{trade.importSource === "screenshot" ? "Screenshot" : trade.notes?.startsWith("Imported from CSV:") ? "CSV" : "Manual"}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${trade.symbol} trade`} onClick={() => onEdit(trade)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${trade.symbol} trade`} onClick={() => onDelete(trade)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[var(--hairline)] md:hidden">
        {trades.map((trade) => {
          const account = accountMap.get(trade.accountId)
          return (
            <article key={trade.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div><p className="font-mono text-xs">{trade.symbol}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{account?.name ?? "Unavailable account"} · {localDate(trade.date)}</p></div>
                <p className={cn("font-mono text-sm", pnlColorClass(trade.pnl))}>{formatPnL(trade.pnl)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline)] pt-3">
                <ReviewContext trade={trade} />
                <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => onEdit(trade)} aria-label="Edit trade"><Pencil /></Button><Button variant="ghost" size="icon" onClick={() => onDelete(trade)} aria-label="Delete trade"><Trash2 /></Button></div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
