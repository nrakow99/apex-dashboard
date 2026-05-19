"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  getTradeMeta,
  type TradeGrade,
  type DisciplineTag,
  type TradeMeta,
} from "@/lib/trade-meta"

const GRADES: TradeGrade[] = ["A+", "A", "B", "C", "FOMO", "Revenge"]

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
  const [formData, setFormData] = useState({ date: "", accountId: "", symbol: "", pnl: "", notes: "" })
  const [meta, setMeta] = useState<TradeMeta>({})

  useEffect(() => {
    if (trade) {
      setFormData({ date: trade.date, accountId: trade.accountId, symbol: trade.symbol, pnl: trade.pnl.toString(), notes: trade.notes ?? "" })
      setMeta(getTradeMeta(trade.id))
    }
  }, [trade])

  const toggleDiscipline = (tag: DisciplineTag) => {
    setMeta((prev) => {
      const tags = prev.disciplineTags ?? []
      return { ...prev, disciplineTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] }
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit Trade</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">

          {/* Date + Time */}
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-background"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5 w-[90px]">
              <Label className="text-muted-foreground">Time (PST)</Label>
              <Input
                type="time"
                value={meta.time ?? ""}
                onChange={(e) => setMeta({ ...meta, time: e.target.value })}
                className="bg-background text-xs"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Account */}
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={formData.accountId} onValueChange={(v) => setFormData({ ...formData, accountId: v })} disabled={isSaving}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Symbol + PnL */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Symbol</Label>
              <Select value={formData.symbol} onValueChange={(v) => setFormData({ ...formData, symbol: v })} disabled={isSaving}>
                <SelectTrigger className="bg-background font-mono"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NQM6">NQM6</SelectItem>
                  <SelectItem value="ESM6">ESM6</SelectItem>
                  <SelectItem value="NQ">NQ</SelectItem>
                  <SelectItem value="ES">ES</SelectItem>
                  <SelectItem value="MNQ">MNQ</SelectItem>
                  <SelectItem value="MES">MES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Net PnL ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.pnl}
                onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
                className="bg-background font-mono"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Entry / Exit / Contracts */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Entry $</Label>
              <Input
                type="number"
                step="0.25"
                placeholder="—"
                value={meta.entryPrice ?? ""}
                onChange={(e) => setMeta({ ...meta, entryPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="bg-background font-mono text-xs"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Exit $</Label>
              <Input
                type="number"
                step="0.25"
                placeholder="—"
                value={meta.exitPrice ?? ""}
                onChange={(e) => setMeta({ ...meta, exitPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="bg-background font-mono text-xs"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Contracts</Label>
              <Input
                type="number"
                step="1"
                min="1"
                placeholder="—"
                value={meta.contracts ?? ""}
                onChange={(e) => setMeta({ ...meta, contracts: e.target.value ? parseInt(e.target.value) : undefined })}
                className="bg-background font-mono text-xs"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Grade */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px] uppercase tracking-wider">Grade</Label>
            <div className="flex gap-1.5 flex-wrap">
              {GRADES.map((grade) => {
                const s = GRADE_STYLES[grade]
                const active = meta.grade === grade
                return (
                  <button
                    key={grade}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setMeta({ ...meta, grade: active ? undefined : grade })}
                    className={cn(
                      "text-[11px] font-semibold px-2 py-1 rounded-md border transition-all",
                      active ? s.activeClassName : s.className,
                    )}
                  >
                    {grade}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Discipline */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px] uppercase tracking-wider">Discipline</Label>
            <div className="space-y-1">
              <div className="flex gap-1 flex-wrap">
                {DISCIPLINE_POSITIVE.map((tag) => {
                  const active = meta.disciplineTags?.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={isSaving}
                      onClick={() => toggleDiscipline(tag)}
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all",
                        active
                          ? "bg-teal-500/[0.12] border-teal-500/30 text-teal-300/90"
                          : "border-teal-500/18 text-teal-400/45 hover:border-teal-500/28 hover:text-teal-400/65",
                      )}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1 flex-wrap">
                {DISCIPLINE_NEGATIVE.map((tag) => {
                  const active = meta.disciplineTags?.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={isSaving}
                      onClick={() => toggleDiscipline(tag)}
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all",
                        active
                          ? "bg-amber-500/[0.10] border-amber-500/28 text-amber-400/90"
                          : "border-amber-500/16 text-amber-400/40 hover:border-amber-500/26 hover:text-amber-400/60",
                      )}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px] uppercase tracking-wider">Notes</Label>
            <Textarea
              placeholder="Brief context on this trade..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-background resize-none h-16 text-sm"
              disabled={isSaving}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
