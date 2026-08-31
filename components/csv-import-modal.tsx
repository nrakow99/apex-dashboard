"use client"

import { useMemo, useRef, useState } from "react"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createCsvTrades } from "@/lib/supabase/database"
import { isLikelyCsvDuplicate, parseTradeCsv, type CsvParseResult } from "@/lib/csv-import"
import type { Account, Trade } from "@/lib/types"
import { cn, formatPnL, pnlColorClass } from "@/lib/utils"

interface Props {
  accounts: Account[]
  selectedAccountId: string
  existingTrades: Trade[]
  onImported: (trades: Trade[], duplicates: number) => void | Promise<void>
}

export function CsvImportModal({ accounts, selectedAccountId, existingTrades, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(() => typeof window !== "undefined" && ["/trades", "/review"].includes(window.location.pathname) && new URLSearchParams(window.location.search).get("onboarding") === "csv")
  const [accountId, setAccountId] = useState(selectedAccountId)
  const [filename, setFilename] = useState("")
  const [result, setResult] = useState<CsvParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const duplicates = useMemo(() => result?.rows.filter((row) => isLikelyCsvDuplicate(row, accountId, existingTrades)) ?? [], [accountId, existingTrades, result])
  const pending = useMemo(() => result?.rows.filter((row) => !isLikelyCsvDuplicate(row, accountId, existingTrades)) ?? [], [accountId, existingTrades, result])

  const reset = () => { setAccountId(selectedAccountId); setFilename(""); setResult(null); setError(null); setImporting(false) }

  const readFile = async (file: File) => {
    setError(null)
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Choose a CSV file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("CSV files must be 5 MB or smaller.")
      return
    }
    const parsed = parseTradeCsv(await file.text())
    setFilename(file.name)
    setResult(parsed)
    if (parsed.rows.length === 0) setError(parsed.errors[0] ?? "No valid trade rows were found.")
  }

  const importRows = async () => {
    if (!filename || pending.length === 0) return
    setImporting(true)
    setError(null)
    const saved = await createCsvTrades(pending.map((row) => ({ ...row, accountId, filename })))
    setImporting(false)
    if (saved.error || !saved.data) {
      setError(saved.error?.message ?? "The CSV rows were not saved.")
      return
    }
    await onImported(saved.data, duplicates.length)
    setOpen(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
      <DialogTrigger asChild><Button variant="outline"><FileSpreadsheet />Import CSV</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] sm:max-w-[760px]">
        <DialogHeader><DialogTitle>Import trade history from CSV</DialogTitle><DialogDescription>Choose the destination account, review locally parsed rows, and save only records that do not already appear in the workspace. No AI key is required.</DialogDescription></DialogHeader>
        <div className="mt-4 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div><label className="text-xs text-[var(--muted)]" htmlFor="csv-account">Destination account</label><select id="csv-account" value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-2 h-10 w-full rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 text-xs">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
          <div><p className="text-xs text-[var(--muted)]">Required columns</p><p className="mt-2 text-xs leading-relaxed">Date · Symbol · Net P&amp;L <span className="text-[var(--muted)]">· Quantity optional</span></p></div>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = "" }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 flex min-h-24 w-full items-center justify-center gap-3 rounded-[2px] border border-dashed border-[var(--faint)] bg-[var(--raised)] px-5 text-sm text-[var(--muted)] hover:text-white"><Upload className="h-4 w-4" />{filename || "Choose CSV file"}</button>
        {error && <p role="alert" className="mt-4 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-xs">{error}</p>}
        {result && result.rows.length > 0 && <>
          <div className="mt-5 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3"><Summary label="Valid rows" value={result.rows.length} /><Summary label="Duplicates skipped" value={duplicates.length} /><Summary label="Rejected rows" value={result.rejectedRows} /></div>
          {result.errors.length > 0 && <div className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">{result.errors.join(" ")}{result.rejectedRows > result.errors.length ? " Additional invalid rows were omitted." : ""}</div>}
          <div className="mt-4 overflow-x-auto border border-[var(--hairline)]"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-[var(--raised)] text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Symbol</th><th className="px-3 py-2 text-right">Net P&amp;L</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-[var(--hairline)]">{result.rows.slice(0, 20).map((row) => { const duplicate = isLikelyCsvDuplicate(row, accountId, existingTrades); return <tr key={row.rowNumber}><td className="px-3 py-2 font-mono">{row.rowNumber}</td><td className="px-3 py-2 font-mono">{row.date}</td><td className="px-3 py-2 font-mono">{row.symbol}</td><td className={cn("px-3 py-2 text-right font-mono", pnlColorClass(row.pnl))}>{formatPnL(row.pnl)}</td><td className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">{duplicate ? "Skip duplicate" : "Ready"}</td></tr>})}</tbody></table></div>
          {result.rows.length > 20 && <p className="mt-2 text-[10px] text-[var(--muted)]">Previewing 20 of {result.rows.length} valid rows.</p>}
        </>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={importRows} disabled={pending.length === 0 || importing}>{importing && <Loader2 className="animate-spin" />}Import {pending.length || ""} row{pending.length === 1 ? "" : "s"}</Button></div>
      </DialogContent>
    </Dialog>
  )
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="bg-[var(--surface)] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-1 font-mono text-lg">{value}</p></div> }
