"use client"

import { useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { useToast } from "@/hooks/use-toast"
import { deleteTradeImportBatch } from "@/lib/supabase/database"
import type { Account, TradeImportBatch } from "@/lib/types"

function sourceLabel(source: TradeImportBatch["source"]): string {
  return source === "csv" ? "CSV" : "Screenshot"
}

export function ImportBatchHistory({
  accounts,
  batches,
  available,
  onDeleted,
}: {
  accounts: Account[]
  batches: TradeImportBatch[]
  available: boolean
  onDeleted: () => void | Promise<void>
}) {
  const { toast } = useToast()
  const [selected, setSelected] = useState<TradeImportBatch | null>(null)
  const [deleting, setDeleting] = useState(false)
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])

  const undo = async () => {
    if (!selected) return
    setDeleting(true)
    const result = await deleteTradeImportBatch(selected.id)
    setDeleting(false)
    if (result.error) {
      toast({ variant: "destructive", title: "Import was not removed", description: result.error.message })
      return
    }
    setSelected(null)
    await onDeleted()
    toast({ title: "Import removed", description: `${result.deletedCount} trade record${result.deletedCount === 1 ? "" : "s"} deleted. Unrelated trades were preserved.` })
  }

  return (
    <section className="mt-6 border border-[var(--hairline)] bg-[var(--surface)]">
      <div className="border-b border-[var(--hairline)] px-5 py-4">
        <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Recovery</p>
        <h2 className="mt-1 text-base font-medium">Import history</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Undo a CSV or screenshot import as one batch. Manual trades and other imports are never touched.</p>
      </div>
      {!available ? <p className="px-5 py-8 text-sm text-[var(--muted)]">Batch recovery becomes available after the database migration is applied.</p> : batches.length === 0 ? <p className="px-5 py-8 text-sm text-[var(--muted)]">No reversible imports recorded yet.</p> : <div className="divide-y divide-[var(--hairline)]">{batches.slice(0, 8).map((batch) => (
        <div key={batch.id} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{batch.filenames[0] || `${sourceLabel(batch.source)} import`}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{accountMap.get(batch.accountId)?.name ?? "Unavailable account"} · {new Date(batch.createdAt).toLocaleString()}</p></div>
          <div><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Source</p><p className="mt-1 text-xs">{sourceLabel(batch.source)}</p></div>
          <div><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Rows</p><p className="mt-1 font-mono text-xs">{batch.rowCount}</p></div>
          <Button variant="outline" size="sm" onClick={() => setSelected(batch)}><RotateCcw />Undo</Button>
        </div>
      ))}</div>}
      <DeleteConfirmationModal open={selected != null} onOpenChange={(open) => { if (!open) setSelected(null) }} title="Undo this import?" description="Only trade rows attached to this import batch will be permanently removed. Account balances and analytics will recalculate immediately." warningText="This cannot be reversed after confirmation." itemDetails={selected ? <div className="flex items-center justify-between gap-4"><span className="truncate text-sm">{selected.filenames[0] || sourceLabel(selected.source)}</span><span className="shrink-0 font-mono text-sm">{selected.rowCount} rows</span></div> : undefined} onConfirm={undo} isDeleting={deleting} confirmText="Remove imported rows" />
    </section>
  )
}
