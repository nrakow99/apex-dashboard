"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { Account, Trade } from "@/lib/types"
import {
  getTradeMeta,
  type DisciplineTag,
  type SetupTag,
  type TradeMeta,
} from "@/lib/trade-meta"
import { resolveSession, type SessionId } from "@/lib/sessions"
import {
  TRADE_MODAL_CONTENT,
  TRADE_MODAL_FORM,
  TRADE_MODAL_FOOTER,
} from "@/components/trade-modal-layout"
import { TradeFormBody } from "@/components/trade-form-body"

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

interface EditTradeModalProps {
  trade: Trade | null
  accounts: Account[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    tradeId: string,
    updates: { date: string; accountId: string; symbol: string; pnl: number; notes?: string },
    meta: TradeMeta,
  ) => Promise<void>
  isSaving?: boolean
}

export function EditTradeModal({
  trade,
  accounts,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: EditTradeModalProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formData, setFormData] = useState({ date: "", accountId: "", symbol: "", pnl: "", notes: "" })
  const [meta, setMeta] = useState<TradeMeta>({})

  useEffect(() => {
    if (trade) {
      setFormData({
        date: trade.date,
        accountId: trade.accountId,
        symbol: trade.symbol,
        pnl: trade.pnl.toString(),
        notes: trade.notes ?? "",
      })
      const existing = getTradeMeta(trade)
      const resolvedSession = resolveSession(existing) ?? DEFAULT_SESSION
      setMeta({ ...existing, session: resolvedSession })
    }
  }, [trade])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trade) return
    await onSave(
      trade.id,
      {
        date: formData.date,
        accountId: formData.accountId,
        symbol: formData.symbol.toUpperCase(),
        pnl: parseFloat(formData.pnl) || 0,
        notes: formData.notes.trim() || undefined,
      },
      meta,
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={TRADE_MODAL_CONTENT}>
        <div className="px-4 pt-4 pb-2.5 sm:px-6 sm:pt-5 sm:pb-3 border-b border-white/[0.06] shrink-0">
          <DialogTitle className="text-base font-semibold">Edit Trade</DialogTitle>
        </div>

        <form id="edit-trade-form" onSubmit={handleSubmit} className={TRADE_MODAL_FORM}>
          <TradeFormBody
            disabled={isSaving}
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            form="edit-trade-form"
            type="submit"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
