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
import type { Account, RiskProfile } from "@/lib/types"
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
import { TRADING_SYMBOLS } from "@/lib/trading-symbols"

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
  userDefaultRiskProfile?: RiskProfile | null
  onAddTrade: (
    trade: { date: string; symbol: string; pnl: number; notes?: string },
    meta: TradeMeta,
    accountIds: string[],
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
  symbol: TRADING_SYMBOLS[0] ?? "NQ",
  pnl: "",
  notes: "",
})

export function AddTradeModal({
  accounts,
  selectedAccountId,
  userDefaultRiskProfile = null,
  onAddTrade,
}: AddTradeModalProps) {
  const [open, setOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm(selectedAccountId))
  const [meta, setMeta] = useState<TradeMeta>(emptyMeta())
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (accountIds.length === 0) return
    const parsedPnl = Number(formData.pnl)
    if (formData.pnl.trim() === "" || !Number.isFinite(parsedPnl)) return
    onAddTrade(
      {
        date: formData.date,
        symbol: formData.symbol.toUpperCase(),
        pnl: parsedPnl,
        notes: formData.notes.trim() || undefined,
      },
      meta,
      accountIds,
    )
    setOpen(false)
    setFormData(emptyForm(selectedAccountId))
    setMeta(emptyMeta())
    setAccountIds(selectedAccountId ? [selectedAccountId] : [])
  }

  const n = accountIds.length

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          const initial = selectedAccountId ? [selectedAccountId] : []
          setFormData((prev) => ({ ...prev, accountId: selectedAccountId }))
          setAccountIds(initial)
        }
        setOpen(isOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Trade
        </Button>
      </DialogTrigger>

      <DialogContent className={`${TRADE_MODAL_CONTENT} rounded-[14px] border-[#303034] bg-[#111113]`}>
        <div className="px-4 pt-4 pb-2.5 sm:px-6 sm:pt-5 sm:pb-3 border-b border-white/[0.06] shrink-0">
          <DialogTitle className="text-base font-medium">Add trade</DialogTitle>
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
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            form="add-trade-form"
            type="submit"
            size="sm"
            disabled={n === 0}
          >
            {n <= 1 ? "Add Trade" : `Add to ${n} accounts`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
