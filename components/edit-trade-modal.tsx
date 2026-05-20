"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Account, Trade } from "@/lib/types"
import {
  DISCIPLINE_POSITIVE,
  DISCIPLINE_NEGATIVE,
  GRADE_STYLES,
  DIRECTION_OPTIONS,
  DIRECTION_SELECTOR_STYLES,
  SETUP_TAGS,
  getTradeMeta,
  type TradeGrade,
  type DisciplineTag,
  type SetupTag,
  type TradeMeta,
  type TradeDirection,
} from "@/lib/trade-meta"
import {
  SESSION_OPTIONS,
  SESSION_SELECTOR_STYLES,
  resolveSession,
  type SessionId,
} from "@/lib/sessions"
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

const GRADES: TradeGrade[] = ["A+", "A", "B", "C", "FOMO", "Revenge"]
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

export function EditTradeModal({ trade, accounts, open, onOpenChange, onSave, isSaving = false }: EditTradeModalProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formData, setFormData] = useState({ date: "", accountId: "", symbol: "", pnl: "", notes: "" })
  const [meta, setMeta] = useState<TradeMeta>({})

  useEffect(() => {
    if (trade) {
      setFormData({ date: trade.date, accountId: trade.accountId, symbol: trade.symbol, pnl: trade.pnl.toString(), notes: trade.notes ?? "" })
      const existing = getTradeMeta(trade.id)
      // Resolve session from existing meta (handles both new `session` and legacy `time`)
      const resolvedSession = resolveSession(existing) ?? DEFAULT_SESSION
      setMeta({ ...existing, session: resolvedSession })
    }
  }, [trade])

  const toggleDiscipline = (tag: DisciplineTag) => {
    setMeta((prev) => {
      const tags = prev.disciplineTags ?? []
      return { ...prev, disciplineTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] }
    })
  }

  const toggleSetup = (tag: SetupTag) => {
    setMeta((prev) => {
      const tags = prev.setupTags ?? []
      return { ...prev, setupTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trade) return
    await onSave(
      trade.id,
      { date: formData.date, accountId: formData.accountId, symbol: formData.symbol.toUpperCase(), pnl: parseFloat(formData.pnl) || 0, notes: formData.notes.trim() || undefined },
      meta,
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0">
        <div className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <DialogTitle className="text-base font-semibold">Edit Trade</DialogTitle>
        </div>

        <form id="edit-trade-form" onSubmit={handleSubmit} className="overflow-y-auto max-h-[min(80vh,560px)] px-5 py-3 space-y-3">

          {/* Date */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" disabled={isSaving}
                  className={cn("w-full justify-start text-left font-normal gap-2 h-9", !formData.date && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {formData.date ? format(parseDateStr(formData.date), "MMMM d, yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-[rgba(83,104,120,0.22)] bg-[rgba(10,12,16,0.92)] backdrop-blur-xl" align="start" sideOffset={6}>
                <Calendar mode="single"
                  selected={formData.date ? parseDateStr(formData.date) : undefined}
                  onSelect={(date) => { if (date) { setFormData({ ...formData, date: serializeDateStr(date) }); setCalendarOpen(false) } }}
                  defaultMonth={formData.date ? parseDateStr(formData.date) : new Date()}
                  disabled={(date) => date > new Date()}
                  initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Session + Direction */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Session</Label>
              <div className="flex gap-1">
                {SESSION_OPTIONS.map(({ id, label }) => {
                  const s = SESSION_SELECTOR_STYLES[id]
                  const active = meta.session === id
                  return (
                    <button key={id} type="button" disabled={isSaving} onClick={() => setMeta({ ...meta, session: id })}
                      className={cn("flex-1 text-[11px] font-semibold py-1.5 rounded-lg border transition-all", active ? s.active : s.inactive)}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Dir.</Label>
              <div className="flex gap-1">
                {DIRECTION_OPTIONS.map(({ id, label }) => {
                  const s = DIRECTION_SELECTOR_STYLES[id]
                  const active = meta.direction === id
                  return (
                    <button key={id} type="button" disabled={isSaving} onClick={() => setMeta({ ...meta, direction: id as TradeDirection })}
                      className={cn("px-2.5 text-[11px] font-semibold py-1.5 rounded-lg border transition-all", active ? s.active : s.inactive)}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Account</Label>
            <Select value={formData.accountId} onValueChange={(v) => setFormData({ ...formData, accountId: v })} disabled={isSaving}>
              <SelectTrigger className="bg-background h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Symbol + PnL */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Symbol</Label>
              <Select value={formData.symbol} onValueChange={(v) => setFormData({ ...formData, symbol: v })} disabled={isSaving}>
                <SelectTrigger className="bg-background font-mono h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRADING_SYMBOLS.map((sym) => <SelectItem key={sym} value={sym}>{sym}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Net PnL ($)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={formData.pnl}
                onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
                className="bg-background font-mono h-9" disabled={isSaving} />
            </div>
          </div>

          {/* Entry / Exit / Contracts */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">Entry $</Label>
              <Input type="number" step="0.25" placeholder="—" value={meta.entryPrice ?? ""}
                onChange={(e) => setMeta({ ...meta, entryPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="bg-background font-mono text-xs h-9" disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">Exit $</Label>
              <Input type="number" step="0.25" placeholder="—" value={meta.exitPrice ?? ""}
                onChange={(e) => setMeta({ ...meta, exitPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="bg-background font-mono text-xs h-9" disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">Qty</Label>
              <Input type="number" step="1" min="1" placeholder="—" value={meta.contracts ?? ""}
                onChange={(e) => setMeta({ ...meta, contracts: e.target.value ? parseInt(e.target.value) : undefined })}
                className="bg-background font-mono text-xs h-9" disabled={isSaving} />
            </div>
          </div>

          {/* Grade */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px] uppercase tracking-wider">Grade</Label>
            <div className="flex gap-1 flex-wrap">
              {GRADES.map((grade) => {
                const s = GRADE_STYLES[grade]
                const active = meta.grade === grade
                return (
                  <button key={grade} type="button" disabled={isSaving}
                    onClick={() => setMeta({ ...meta, grade: active ? undefined : grade })}
                    className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all",
                      active ? s.activeClassName : s.className)}>
                    {grade}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Setup */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px] uppercase tracking-wider">Setup</Label>
            <div className="flex gap-1 flex-wrap">
              {SETUP_TAGS.map((tag) => {
                const active = meta.setupTags?.includes(tag)
                return (
                  <button key={tag} type="button" disabled={isSaving} onClick={() => toggleSetup(tag)}
                    className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all",
                      active ? "bg-[rgba(83,104,120,0.18)] border-[rgba(83,104,120,0.38)] text-[#94AAB8]"
                             : "border-[rgba(83,104,120,0.15)] text-[#E5E4E2]/35 hover:border-[rgba(83,104,120,0.28)] hover:text-[#94AAB8]/70")}>
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Discipline */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px] uppercase tracking-wider">Discipline</Label>
            <div className="space-y-0.5">
              <div className="flex gap-1 flex-wrap">
                {DISCIPLINE_POSITIVE.map((tag) => {
                  const active = meta.disciplineTags?.includes(tag)
                  return (
                    <button key={tag} type="button" disabled={isSaving} onClick={() => toggleDiscipline(tag)}
                      className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all",
                        active ? "bg-teal-500/[0.12] border-teal-500/30 text-teal-300/90"
                               : "border-teal-500/18 text-teal-400/45 hover:border-teal-500/28 hover:text-teal-400/65")}>
                      {tag}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1 flex-wrap">
                {DISCIPLINE_NEGATIVE.map((tag) => {
                  const active = meta.disciplineTags?.includes(tag)
                  return (
                    <button key={tag} type="button" disabled={isSaving} onClick={() => toggleDiscipline(tag)}
                      className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all",
                        active ? "bg-amber-500/[0.10] border-amber-500/28 text-amber-400/90"
                               : "border-amber-500/16 text-amber-400/40 hover:border-amber-500/26 hover:text-amber-400/60")}>
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px] uppercase tracking-wider">Notes</Label>
            <Textarea placeholder="Brief context on this trade..." value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-background resize-none h-[72px] text-sm" disabled={isSaving} />
          </div>

        </form>

        <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button form="edit-trade-form" type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
            {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
