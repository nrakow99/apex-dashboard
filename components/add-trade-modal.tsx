"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { Account, RiskProfile } from "@/lib/types"
import {
  type DisciplineTag,
  type SetupTag,
  type TradeMeta,
} from "@/lib/trade-meta"
import {
  TRADE_MODAL_CONTENT,
  TRADE_MODAL_FORM,
  TRADE_MODAL_FOOTER,
} from "@/components/trade-modal-layout"
import { TradeFormBody } from "@/components/trade-form-body"
import { format } from "date-fns"

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC day-shift). */
function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Serialize a Date to the YYYY-MM-DD format used throughout trade storage. */
function serializeDateStr(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

interface AddTradeModalProps {
  accounts: Account[]
  selectedAccountId: string
  userDefaultRiskProfile?: RiskProfile | null
  onAddTrade: (
    trade: { date: string; symbol: string; pnl: number; notes?: string },
    meta: TradeMeta,
    accountIds: string[],
  ) => void | Promise<void>
  requestedOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const emptyMeta = (): TradeMeta => ({
  session: undefined,
  direction: undefined,
  grade: undefined,
  disciplineTags: [],
  setupTags: [],
  entryPrice: undefined,
  exitPrice: undefined,
  contracts: undefined,
})

const emptyForm = (accountId: string) => ({
  date: serializeDateStr(new Date()),
  accountId,
  symbol: "",
  pnl: "",
  notes: "",
})

export function AddTradeModal({
  accounts,
  selectedAccountId,
  userDefaultRiskProfile = null,
  onAddTrade,
  requestedOpen = false,
  onOpenChange,
}: AddTradeModalProps) {
  const [open, setOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm(selectedAccountId))
  const [meta, setMeta] = useState<TradeMeta>(emptyMeta())
  const [saving, setSaving] = useState(false)
  const [accountIds, setAccountIds] = useState<string[]>(
    selectedAccountId ? [selectedAccountId] : [],
  )

  const toggleDiscipline = (tag: DisciplineTag) => {
    setMeta((prev) => {
      const tags = prev.disciplineTags ?? []
      return {
        ...prev,
        disciplineTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
      }
    })
  }

  const toggleSetup = (tag: SetupTag) => {
    setMeta((prev) => {
      const tags = prev.setupTags ?? []
      return {
        ...prev,
        setupTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
      }
    })
  }

  const submitTrade = async (keepOpen: boolean) => {
    if (accountIds.length === 0) return
    const parsedPnl = Number(formData.pnl)
    if (formData.pnl.trim() === "" || !Number.isFinite(parsedPnl)) return
    setSaving(true)
    try {
      await onAddTrade(
        {
          date: formData.date,
          symbol: formData.symbol.toUpperCase(),
          pnl: parsedPnl,
          notes: formData.notes.trim() || undefined,
        },
        meta,
        accountIds,
      )
      if (typeof window !== "undefined") {
        window.localStorage.setItem("propdash:last-trade-symbol", formData.symbol.toUpperCase())
      }
      setMeta(emptyMeta())
      if (keepOpen) {
        setFormData((current) => ({ ...current, pnl: "", notes: "" }))
      } else {
        setOpen(false)
        onOpenChange?.(false)
        setFormData(emptyForm(selectedAccountId))
        setAccountIds(selectedAccountId ? [selectedAccountId] : [])
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submitTrade(false)
  }

  const n = accountIds.length
  const parsedPnl = Number(formData.pnl)
  const canSubmit = n > 0 && formData.symbol !== "" && formData.pnl.trim() !== "" && Number.isFinite(parsedPnl)

  return (
    <Dialog
      open={open || requestedOpen}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          const initial = selectedAccountId ? [selectedAccountId] : []
          setFormData((prev) => ({ ...prev, accountId: selectedAccountId }))
          setAccountIds(initial)
        }
        if (isOpen && typeof window !== "undefined") {
          const rememberedSymbol = window.localStorage.getItem("propdash:last-trade-symbol")
          if (rememberedSymbol) setFormData((prev) => ({ ...prev, symbol: rememberedSymbol }))
        }
        setOpen(isOpen)
        onOpenChange?.(isOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Trade
        </Button>
      </DialogTrigger>

      <DialogContent className={`${TRADE_MODAL_CONTENT} rounded-[2px] border-[var(--hairline)] bg-[var(--surface)]`}>
        <div className="shrink-0 border-b border-[var(--hairline)] px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <DialogTitle className="text-base font-medium">Add trade</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-[var(--muted)]">Account, date, symbol, and net P&amp;L are all you need. Journal details stay optional.</DialogDescription>
        </div>

        <form id="add-trade-form" onSubmit={handleSubmit} className={TRADE_MODAL_FORM}>
          <TradeFormBody
            formData={formData}
            setFormData={setFormData}
            meta={meta}
            setMeta={setMeta}
            accounts={accounts}
            calendarOpen={calendarOpen}
            setCalendarOpen={setCalendarOpen}
            parseDateStr={parseDateStr}
            serializeDateStr={serializeDateStr}
            toggleDiscipline={toggleDiscipline}
            toggleSetup={toggleSetup}
            accountIds={accountIds}
            onAccountIdsChange={setAccountIds}
            userDefaultRiskProfile={userDefaultRiskProfile}
          />
        </form>

        <div className={TRADE_MODAL_FOOTER}>
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { setOpen(false); onOpenChange?.(false) }}>
            Cancel
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!canSubmit || saving} onClick={() => void submitTrade(true)}>
            Save &amp; next
          </Button>
          <Button
            form="add-trade-form"
            type="submit"
            size="sm"
            disabled={!canSubmit || saving}
          >
            {saving ? "Saving…" : n <= 1 ? "Save trade" : `Save to ${n} accounts`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
