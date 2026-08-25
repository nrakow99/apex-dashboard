"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { resolveSession } from "@/lib/sessions"
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
      const resolvedSession = resolveSession(existing) ?? undefined
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
    const parsedPnl = Number(formData.pnl)
    if (
      !trade ||
      !formData.date ||
      !formData.accountId ||
      !formData.symbol.trim() ||
      !formData.pnl.trim() ||
      !Number.isFinite(parsedPnl)
    ) return
    await onSave(
      trade.id,
      {
        date: formData.date,
        accountId: formData.accountId,
        symbol: formData.symbol.trim().toUpperCase(),
        pnl: parsedPnl,
        notes: formData.notes.trim() || undefined,
      },
      meta,
    )
  }

  const parsedPnl = Number(formData.pnl)
  const canSubmit =
    !!trade &&
    !!formData.date &&
    !!formData.accountId &&
    !!formData.symbol.trim() &&
    !!formData.pnl.trim() &&
    Number.isFinite(parsedPnl)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={TRADE_MODAL_CONTENT}>
        <div className="shrink-0 border-b border-[var(--hairline)] px-4 pb-2.5 pt-4 sm:px-6 sm:pb-3 sm:pt-5">
          <DialogTitle className="text-base font-semibold">Edit Trade</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-[var(--muted)]">Update the record or add review context without changing firm rules.</DialogDescription>
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
            defaultDetailsOpen={Boolean(
              formData.notes.trim() ||
              meta.session ||
              meta.direction ||
              meta.grade ||
              meta.setupTags?.length ||
              meta.disciplineTags?.length ||
              meta.entryPrice != null ||
              meta.exitPrice != null ||
              meta.contracts != null
            )}
          />
        </form>

        <div className={TRADE_MODAL_FOOTER}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || !canSubmit}
          >
            Cancel
          </Button>
          <Button
            form="edit-trade-form"
            type="submit"
            size="sm"
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
