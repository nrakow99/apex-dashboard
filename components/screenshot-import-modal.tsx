"use client"

import { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  FileImage,
  ImageUp,
  Loader2,
  ScanLine,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  importScreenshotTrades,
  type ScreenshotTradeImportResult,
} from "@/lib/supabase/database"
import {
  createScreenshotImportKey,
  isImportableScreenshotRow,
  isLikelyExistingTrade,
  normalizeImportedSymbol,
  type ExtractedScreenshotTradeRow,
  type ImportableScreenshotTradeRow,
  type ScreenshotExtractionResult,
} from "@/lib/screenshot-import"
import type { Account, Trade } from "@/lib/types"
import { cn, formatCurrency } from "@/lib/utils"

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_FILES = 8
const MAX_FILE_BYTES = 10 * 1024 * 1024

interface ScreenshotImportModalProps {
  accounts: Account[]
  selectedAccountId: string
  existingTrades: Trade[]
  onImported: (result: ScreenshotTradeImportResult) => void | Promise<void>
}

interface ReviewRow {
  id: string
  included: boolean
  date: string
  rawSymbol: string
  symbol: string
  netPnl: string
  quantity: string
  commission: string
  extracted: ExtractedScreenshotTradeRow
}

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function editableNumber(value: number | null): string {
  return value == null ? "" : String(value)
}

function nullableNumber(value: string): number | null {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toExtractedRow(row: ReviewRow): ExtractedScreenshotTradeRow {
  return {
    ...row.extracted,
    date: row.date.trim() || null,
    rawSymbol: row.rawSymbol.trim().toUpperCase() || null,
    symbol: row.symbol.trim().toUpperCase() || null,
    symbolRecognized: normalizeImportedSymbol(row.rawSymbol).recognized,
    netPnl: nullableNumber(row.netPnl),
    quantity: nullableNumber(row.quantity),
    commission: nullableNumber(row.commission),
  }
}

function confidenceLabel(confidence: ExtractedScreenshotTradeRow["confidence"]): string {
  if (confidence === "high") return "High confidence"
  if (confidence === "medium") return "Review"
  return "Needs review"
}

function reviewRowsFromExtraction(
  extraction: ScreenshotExtractionResult,
  accountId: string,
  existingTrades: Trade[],
): ReviewRow[] {
  const seen = new Set<string>()
  return extraction.rows.map((row, index) => {
    const importable = isImportableScreenshotRow(row)
    const key = importable ? createScreenshotImportKey(accountId, row) : null
    const duplicate =
      importable && (seen.has(key!) || isLikelyExistingTrade(row, accountId, existingTrades))
    if (key) seen.add(key)
    return {
      id: `${index}-${row.date ?? "unknown"}-${row.rawSymbol ?? "symbol"}`,
      included: importable && row.confidence !== "low" && !duplicate,
      date: row.date ?? "",
      rawSymbol: row.rawSymbol ?? "",
      symbol: row.symbol ?? "",
      netPnl: editableNumber(row.netPnl),
      quantity: editableNumber(row.quantity),
      commission: editableNumber(row.commission),
      extracted: row,
    }
  })
}

function FieldInput({
  value,
  onChange,
  type = "text",
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  type?: "text" | "number" | "date"
  ariaLabel: string
  className?: string
}) {
  return (
    <input
      aria-label={ariaLabel}
      type={type}
      value={value}
      step={type === "number" ? "any" : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-9 w-full rounded-[8px] border border-[#2B2B2E] bg-[#111113] px-2.5 font-mono text-xs text-white outline-none transition focus:border-[#55555B]",
        className,
      )}
    />
  )
}

function StatusBadge({
  row,
  duplicate,
  valid,
}: {
  row: ReviewRow
  duplicate: boolean
  valid: boolean
}) {
  const confidence = row.extracted.confidence
  const label = duplicate
    ? "Likely duplicate"
    : !valid
      ? "Missing required value"
      : confidenceLabel(confidence)
  return (
    <div>
      <span
        className={cn(
          "inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
          duplicate || !valid || confidence === "low"
            ? "border-amber-400/20 bg-amber-400/[0.07] text-amber-200"
            : confidence === "medium"
              ? "border-blue-400/20 bg-blue-400/[0.07] text-blue-200"
              : "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200",
        )}
      >
        {label}
      </span>
      {row.extracted.warnings.length > 0 && (
        <p className="mt-1 max-w-[180px] text-[10px] leading-4 text-[#77777D]">
          {row.extracted.warnings.join(" ")}
        </p>
      )}
    </div>
  )
}

export function ScreenshotImportModal({
  accounts,
  selectedAccountId,
  existingTrades,
  onImported,
}: ScreenshotImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"upload" | "review">("upload")
  const [accountId, setAccountId] = useState(selectedAccountId)
  const [files, setFiles] = useState<File[]>([])
  const [extraction, setExtraction] = useState<ScreenshotExtractionResult | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep("upload")
    setAccountId(selectedAccountId)
    setFiles([])
    setExtraction(null)
    setRows([])
    setError(null)
    setIsDragging(false)
  }

  const addFiles = (incoming: File[]) => {
    setError(null)
    const rejectedType = incoming.find((file) => !ACCEPTED_TYPES.has(file.type))
    if (rejectedType) {
      setError(`${rejectedType.name} is not a PNG, JPEG, or WebP image.`)
      return
    }
    const rejectedSize = incoming.find((file) => file.size > MAX_FILE_BYTES)
    if (rejectedSize) {
      setError(`${rejectedSize.name} is larger than 10 MB.`)
      return
    }
    setFiles((current) => {
      const combined = [...current]
      for (const file of incoming) {
        if (!combined.some((item) => item.name === file.name && item.size === file.size)) {
          combined.push(file)
        }
      }
      if (combined.length > MAX_FILES) {
        setError(`Choose no more than ${MAX_FILES} screenshots.`)
        return current
      }
      return combined
    })
  }

  const analyze = async () => {
    if (!accountId || files.length === 0) return
    setIsAnalyzing(true)
    setError(null)
    try {
      const body = new FormData()
      files.forEach((file) => body.append("images", file))
      const response = await fetch("/api/import/screenshot", { method: "POST", body })
      const payload = (await response.json().catch(() => null)) as
        | { extraction?: ScreenshotExtractionResult; error?: string }
        | null
      if (!response.ok || !payload?.extraction) {
        throw new Error(payload?.error || "These screenshots could not be read.")
      }
      const nextRows = reviewRowsFromExtraction(payload.extraction, accountId, existingTrades)
      setExtraction(payload.extraction)
      setRows(nextRows)
      setStep("review")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "These screenshots could not be read.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const rowState = useMemo(() => {
    const seen = new Set<string>()
    return rows.map((row) => {
      const extracted = toExtractedRow(row)
      const valid = isImportableScreenshotRow(extracted)
      let duplicate = false
      if (valid) {
        const key = createScreenshotImportKey(accountId, extracted)
        duplicate = seen.has(key) || isLikelyExistingTrade(extracted, accountId, existingTrades)
        seen.add(key)
      }
      return { row, extracted, valid, duplicate }
    })
  }, [accountId, existingTrades, rows])

  const selectedRows = useMemo(
    () =>
      rowState
        .filter(
          (item): item is typeof item & { extracted: ImportableScreenshotTradeRow } =>
            item.row.included && item.valid,
        )
        .map((item) => item.extracted),
    [rowState],
  )
  const selectedNetPnl = selectedRows.reduce((sum, row) => sum + row.netPnl, 0)
  const lowConfidenceCount = rowState.filter(
    ({ row }) => row.extracted.confidence === "low" || row.extracted.warnings.length > 0,
  ).length
  const duplicateCount = rowState.filter(({ duplicate }) => duplicate).length
  const invalidSelected = rowState.some(({ row, valid }) => row.included && !valid)

  const confirmImport = async () => {
    if (!extraction || selectedRows.length === 0 || invalidSelected) return
    setIsImporting(true)
    setError(null)
    try {
      const result = await importScreenshotTrades({
        accountId,
        source: extraction.source,
        filenames: files.map((file) => file.name),
        coverageStart: extraction.coverageStart,
        coverageEnd: extraction.coverageEnd,
        warnings: extraction.warnings,
        rows: selectedRows,
      })
      if (result.error || !result.data) throw result.error ?? new Error("Import failed")
      await onImported(result.data)
      setOpen(false)
      reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reviewed rows could not be imported.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setAccountId(selectedAccountId)
        else if (!isAnalyzing && !isImporting) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-[9px]">
          <ImageUp className="h-4 w-4" />
          <span className="hidden sm:inline">Import screenshot</span>
          <span className="sm:hidden">Import</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-24px)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-[16px] border-[#303034] bg-[#0E0E10] p-0 sm:w-[calc(100vw-48px)]">
        <header className="shrink-0 border-b border-white/[0.06] px-5 py-5 pr-14 sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            {step === "review" && (
              <button
                type="button"
                onClick={() => {
                  setStep("upload")
                  setError(null)
                }}
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#2B2B2E] bg-[#171719] text-[#A1A1A7] hover:text-white"
                aria-label="Back to screenshots"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#78787E]">
                <ScanLine className="h-3.5 w-3.5" />
                Screenshot import · {step === "upload" ? "1 of 2" : "2 of 2"}
              </div>
              <DialogTitle className="text-lg font-medium tracking-[-0.02em] text-white sm:text-xl">
                {step === "upload" ? "Bring your trading history with you" : "Verify every row before it counts"}
              </DialogTitle>
              <DialogDescription className="mt-1.5 max-w-2xl text-xs leading-5 text-[#88888E] sm:text-sm">
                {step === "upload"
                  ? "Upload visible trading-history screenshots. We read the table, then you approve the exact rows added to this account."
                  : "Only selected rows with a confirmed date, symbol, and Net P&L affect balances or prop-firm rules."}
              </DialogDescription>
            </div>
          </div>
        </header>

        {step === "upload" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files ?? []))
                    event.target.value = ""
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setIsDragging(false)
                    addFiles(Array.from(event.dataTransfer.files))
                  }}
                  className={cn(
                    "flex min-h-[240px] w-full flex-col items-center justify-center rounded-[14px] border border-dashed bg-[#121214] px-6 text-center transition",
                    isDragging
                      ? "border-white/35 bg-white/[0.04]"
                      : "border-[#343438] hover:border-[#505056] hover:bg-[#151517]",
                  )}
                >
                  <div className="grid h-12 w-12 place-items-center rounded-[12px] border border-[#323236] bg-[#1A1A1D] shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
                    <ImageUp className="h-5 w-5 text-white" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-white">Drop screenshots here</p>
                  <p className="mt-1 text-xs text-[#77777D]">or click to choose up to 8 images</p>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-[#55555B]">
                    PNG · JPEG · WebP · 10 MB each
                  </p>
                </button>

                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((file) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="flex items-center gap-3 rounded-[10px] border border-[#29292D] bg-[#151517] px-3 py-2.5"
                      >
                        <FileImage className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-[#E7E7EA]">{file.name}</p>
                          <p className="mt-0.5 text-[10px] text-[#66666C]">{fileSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((current) => current.filter((candidate) => candidate !== file))
                          }
                          aria-label={`Remove ${file.name}`}
                          className="rounded-[7px] p-2 text-[#66666C] hover:bg-white/[0.04] hover:text-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-3">
                <div className="rounded-[12px] border border-[#29292D] bg-[#151517] p-4">
                  <label className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#68686E]">
                    Import into
                  </label>
                  <select
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    className="mt-2 h-10 w-full rounded-[9px] border border-[#303034] bg-[#101012] px-3 text-xs text-white outline-none focus:border-[#55555B]"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.firm} {account.type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-[12px] border border-[#29292D] bg-[#151517] p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#D7D7DA]">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    Review-first by design
                  </div>
                  <ul className="mt-3 space-y-2.5 text-[11px] leading-4 text-[#818187]">
                    <li>Nothing is saved before you approve it.</li>
                    <li>Blank or unclear values stay unavailable.</li>
                    <li>Likely duplicates start excluded.</li>
                    <li>Screenshots are not stored by this workflow.</li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 grid grid-cols-2 gap-px border-b border-[#29292D] bg-[#29292D] sm:grid-cols-4">
              {[
                ["Selected rows", String(selectedRows.length)],
                ["Net P&L", formatCurrency(selectedNetPnl)],
                ["Needs attention", String(lowConfidenceCount)],
                ["Likely duplicates", String(duplicateCount)],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#121214] px-4 py-3 sm:px-5">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#5F5F65]">{label}</p>
                  <p className="mt-1 font-mono text-sm font-medium text-[#ECECEF]">{value}</p>
                </div>
              ))}
            </div>

            {(extraction?.warnings.length || extraction?.isLikelyComplete === false) && (
              <div className="mx-4 mt-4 flex gap-2.5 rounded-[10px] border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2.5 text-[11px] leading-4 text-amber-100/75 sm:mx-6">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                <p>
                  {[
                    extraction?.isLikelyComplete === false
                      ? "The screenshots may not show the full history."
                      : null,
                    ...(extraction?.warnings ?? []),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              </div>
            )}

            <div className="hidden px-6 py-4 md:block">
              <div className="overflow-x-auto rounded-[12px] border border-[#29292D]">
                <table className="w-full min-w-[960px] border-collapse text-left">
                  <thead className="bg-[#171719]">
                    <tr className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#67676D]">
                      <th className="w-12 px-3 py-3">Use</th>
                      <th className="px-2 py-3">Date</th>
                      <th className="px-2 py-3">Contract</th>
                      <th className="px-2 py-3">Root</th>
                      <th className="px-2 py-3">Net P&L</th>
                      <th className="px-2 py-3">Qty</th>
                      <th className="px-2 py-3">Commission</th>
                      <th className="min-w-[180px] px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowState.map(({ row, valid, duplicate }) => (
                      <tr key={row.id} className="border-t border-[#242427] bg-[#111113] align-top">
                        <td className="px-3 py-3">
                          <input
                            aria-label={`Include ${row.rawSymbol || "row"} on ${row.date || "unknown date"}`}
                            type="checkbox"
                            checked={row.included}
                            onChange={(event) => updateRow(row.id, { included: event.target.checked })}
                            className="h-4 w-4 accent-white"
                          />
                        </td>
                        <td className="w-[142px] px-2 py-3">
                          <FieldInput
                            ariaLabel="Trade date"
                            type="date"
                            value={row.date}
                            onChange={(date) => updateRow(row.id, { date })}
                          />
                        </td>
                        <td className="w-[116px] px-2 py-3">
                          <FieldInput
                            ariaLabel="Contract symbol"
                            value={row.rawSymbol}
                            onChange={(rawSymbol) => {
                              const normalized = normalizeImportedSymbol(rawSymbol)
                              updateRow(row.id, {
                                rawSymbol: rawSymbol.toUpperCase(),
                                symbol: normalized.symbol ?? rawSymbol.toUpperCase(),
                              })
                            }}
                          />
                        </td>
                        <td className="w-[92px] px-2 py-3">
                          <FieldInput
                            ariaLabel="Root symbol"
                            value={row.symbol}
                            onChange={(symbol) => updateRow(row.id, { symbol: symbol.toUpperCase() })}
                          />
                        </td>
                        <td className="w-[120px] px-2 py-3">
                          <FieldInput
                            ariaLabel="Net P and L"
                            type="number"
                            value={row.netPnl}
                            onChange={(netPnl) => updateRow(row.id, { netPnl })}
                          />
                        </td>
                        <td className="w-[78px] px-2 py-3">
                          <FieldInput
                            ariaLabel="Quantity"
                            type="number"
                            value={row.quantity}
                            onChange={(quantity) => updateRow(row.id, { quantity })}
                          />
                        </td>
                        <td className="w-[114px] px-2 py-3">
                          <FieldInput
                            ariaLabel="Commission"
                            type="number"
                            value={row.commission}
                            onChange={(commission) => updateRow(row.id, { commission })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge row={row} duplicate={duplicate} valid={valid} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 px-4 py-4 md:hidden">
              {rowState.map(({ row, valid, duplicate }) => (
                <section key={row.id} className="rounded-[12px] border border-[#29292D] bg-[#121214] p-3.5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-white">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(event) => updateRow(row.id, { included: event.target.checked })}
                        className="h-4 w-4 accent-white"
                      />
                      Include row
                    </label>
                    <StatusBadge row={row} duplicate={duplicate} valid={valid} />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <FieldInput ariaLabel="Trade date" type="date" value={row.date} onChange={(date) => updateRow(row.id, { date })} className="col-span-2" />
                    <FieldInput ariaLabel="Contract symbol" value={row.rawSymbol} onChange={(rawSymbol) => {
                      const normalized = normalizeImportedSymbol(rawSymbol)
                      updateRow(row.id, { rawSymbol: rawSymbol.toUpperCase(), symbol: normalized.symbol ?? rawSymbol.toUpperCase() })
                    }} />
                    <FieldInput ariaLabel="Root symbol" value={row.symbol} onChange={(symbol) => updateRow(row.id, { symbol: symbol.toUpperCase() })} />
                    <FieldInput ariaLabel="Net P and L" type="number" value={row.netPnl} onChange={(netPnl) => updateRow(row.id, { netPnl })} />
                    <FieldInput ariaLabel="Quantity" type="number" value={row.quantity} onChange={(quantity) => updateRow(row.id, { quantity })} />
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-5 mb-3 flex gap-2 rounded-[9px] border border-red-400/15 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-200/80 sm:mx-7">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] bg-[#111113] px-5 py-4 sm:px-7">
          <p className="hidden text-[10px] text-[#64646A] sm:block">
            {step === "upload"
              ? "Images are processed only to build the review."
              : `${rows.length} extracted row${rows.length === 1 ? "" : "s"} · ${selectedRows.length} selected`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isAnalyzing || isImporting}>
              Cancel
            </Button>
            {step === "upload" ? (
              <Button type="button" size="sm" onClick={analyze} disabled={!accountId || files.length === 0 || isAnalyzing} className="gap-2">
                {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                {isAnalyzing ? "Reading screenshots" : "Review extracted rows"}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={confirmImport} disabled={selectedRows.length === 0 || invalidSelected || isImporting} className="gap-2">
                {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {isImporting ? "Importing" : `Import ${selectedRows.length} row${selectedRows.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

