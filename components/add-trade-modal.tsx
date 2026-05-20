"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { Account } from "@/lib/types"
import {
  type DisciplineTag,
  type SetupTag,
  type TradeMeta,
} from "@/lib/trade-meta"
import { type SessionId } from "@/lib/sessions"
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

const DEFAULT_SESSION: SessionId = "ny_am"

interface AddTradeModalProps {
  accounts: Account[]
  selectedAccountId: string
  onAddTrade: (
    trade: { date: string; accountId: string; symbol: string; pnl: number; notes?: string },
    meta: TradeMeta,
  ) => void
}

const emptyMeta = (): TradeMeta => ({
  session: DEFAULT_SESSION,
  direction: "long",
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
  symbol: "NQM6",
  pnl: "",
  notes: "",
})

export function AddTradeModal({ accounts, selectedAccountId, onAddTrade }: AddTradeModalProps) {
  const [open, setOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm(selectedAccountId))
  const [meta, setMeta] = useState<TradeMeta>(emptyMeta())

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAddTrade(
      {
        date: formData.date,
        accountId: formData.accountId,
        symbol: formData.symbol.toUpperCase(),
        pnl: parseFloat(formData.pnl) || 0,
        notes: formData.notes.trim() || undefined,
      },
      meta,
    )
    setOpen(false)
    setFormData(emptyForm(selectedAccountId))
    setMeta(emptyMeta())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) setFormData((prev) => ({ ...prev, accountId: selectedAccountId }))
        setOpen(isOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Trade
        </Button>
      </DialogTrigger>

      <DialogContent className={TRADE_MODAL_CONTENT}>
        <div className="px-4 pt-4 pb-2.5 sm:px-6 sm:pt-5 sm:pb-3 border-b border-white/[0.06] shrink-0">
          <DialogTitle className="text-base font-semibold">Add New Trade</DialogTitle>
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
          />
        </form>

        <div className={TRADE_MODAL_FOOTER}>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button form="add-trade-form" type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            Add Trade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
