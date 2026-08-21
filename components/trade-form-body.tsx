"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
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
import { cn } from "@/lib/utils"
import type { Account, RiskProfile } from "@/lib/types"
import {
  DISCIPLINE_POSITIVE,
  DISCIPLINE_NEGATIVE,
  GRADE_STYLES,
  DIRECTION_OPTIONS,
  DIRECTION_SELECTOR_STYLES,
  SETUP_TAGS,
  type TradeGrade,
  type DisciplineTag,
  type SetupTag,
  type TradeMeta,
  type TradeDirection,
} from "@/lib/trade-meta"
import { SESSION_OPTIONS, SESSION_SELECTOR_STYLES } from "@/lib/sessions"
import { TRADING_SYMBOLS } from "@/lib/trading-symbols"
import {
  TRADE_FIELD,
  TRADE_LABEL,
  COL_FULL,
  COL_HALF,
  COL_THIRD,
  COL_DATE,
  COL_SESSION_DIR,
} from "@/components/trade-modal-layout"
import { getAccountQuantity } from "@/lib/account-quantity"
import { hasMixedRiskContracts } from "@/lib/headroom"

const GRADES: TradeGrade[] = ["A+", "A", "B", "C", "FOMO", "Revenge"]

export interface TradeFormData {
  date: string
  accountId: string
  symbol: string
  pnl: string
  notes: string
}

interface TradeFormBodyProps {
  disabled?: boolean
  formData: TradeFormData
  setFormData: React.Dispatch<React.SetStateAction<TradeFormData>>
  meta: TradeMeta
  setMeta: React.Dispatch<React.SetStateAction<TradeMeta>>
  accounts: Account[]
  calendarOpen: boolean
  setCalendarOpen: (open: boolean) => void
  parseDateStr: (dateStr: string) => Date
  serializeDateStr: (date: Date) => string
  toggleDiscipline: (tag: DisciplineTag) => void
  toggleSetup: (tag: SetupTag) => void
  /** Add Trade: multi-select. Edit Trade omits this and stays single-select. */
  accountIds?: string[]
  onAccountIdsChange?: (ids: string[]) => void
  /** User-level default risk profile — used only to compare contract counts across a bulk selection. */
  userDefaultRiskProfile?: RiskProfile | null
}

export function TradeFormBody({
  disabled = false,
  formData,
  setFormData,
  meta,
  setMeta,
  accounts,
  calendarOpen,
  setCalendarOpen,
  parseDateStr,
  serializeDateStr,
  toggleDiscipline,
  toggleSetup,
  accountIds,
  onAccountIdsChange,
  userDefaultRiskProfile = null,
}: TradeFormBodyProps) {
  const isMultiAccount = onAccountIdsChange != null
  const selectedIds = isMultiAccount
    ? (accountIds ?? [])
    : formData.accountId
      ? [formData.accountId]
      : []
  const selectedAccounts = accounts.filter((a) => selectedIds.includes(a.id))
  const selectedQty = selectedAccounts.reduce((max, a) => Math.max(max, getAccountQuantity(a)), 1)
  const mixedContracts = isMultiAccount && hasMixedRiskContracts(selectedAccounts, userDefaultRiskProfile)

  const toggleAccount = (id: string) => {
    if (!onAccountIdsChange) return
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onAccountIdsChange(next)
  }

  return (
    <>
      {/* Date */}
      <div className={cn(TRADE_FIELD, COL_DATE)}>
        <Label className={TRADE_LABEL}>Date</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal gap-2 h-9",
                !formData.date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {formData.date
                ? format(parseDateStr(formData.date), "MMMM d, yyyy")
                : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 border-[rgba(83,104,120,0.22)] bg-[rgba(10,12,16,0.92)] backdrop-blur-xl"
            align="start"
            sideOffset={6}
          >
            <Calendar
              mode="single"
              selected={formData.date ? parseDateStr(formData.date) : undefined}
              onSelect={(date) => {
                if (date) {
                  setFormData({ ...formData, date: serializeDateStr(date) })
                  setCalendarOpen(false)
                }
              }}
              defaultMonth={formData.date ? parseDateStr(formData.date) : new Date()}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Session + Direction */}
      <div
        className={cn(
          TRADE_FIELD,
          COL_SESSION_DIR,
          "grid grid-cols-[1fr_auto] md:grid-cols-2 gap-2 md:gap-3 items-end",
        )}
      >
        <div className={TRADE_FIELD}>
          <Label className={TRADE_LABEL}>Session</Label>
          <div className="flex gap-0.5 sm:gap-1">
            {SESSION_OPTIONS.map(({ id, label }) => {
              const s = SESSION_SELECTOR_STYLES[id]
              const active = meta.session === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMeta({ ...meta, session: id })}
                  className={cn(
                    "flex-1 text-[11px] font-semibold py-1.5 rounded-lg border transition-all",
                    active ? s.active : s.inactive,
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <div className={TRADE_FIELD}>
          <Label className={TRADE_LABEL}>Dir.</Label>
          <div className="flex gap-0.5 sm:gap-1">
            {DIRECTION_OPTIONS.map(({ id, label }) => {
              const s = DIRECTION_SELECTOR_STYLES[id]
              const active = meta.direction === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMeta({ ...meta, direction: id as TradeDirection })}
                  className={cn(
                    "px-2.5 text-[11px] font-semibold py-1.5 rounded-lg border transition-all",
                    active ? s.active : s.inactive,
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Account */}
      <div className={cn(TRADE_FIELD, COL_FULL)}>
        <Label className={TRADE_LABEL}>
          {isMultiAccount ? "Accounts" : "Account"}
        </Label>
        {isMultiAccount ? (
          <div className="max-h-40 overflow-y-auto rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] divide-y divide-[var(--hairline)]">
            {accounts.map((a) => {
              const checked = selectedIds.includes(a.id)
              const qty = getAccountQuantity(a)
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleAccount(a.id)}
                  aria-pressed={checked}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                    disabled && "opacity-50 cursor-not-allowed",
                    checked ? "text-[var(--text)]" : "text-[var(--muted-foreground)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border",
                      checked
                        ? "border-[var(--text)] bg-[var(--text)]"
                        : "border-[var(--faint)] bg-transparent",
                    )}
                    aria-hidden
                  >
                    {checked && (
                      <span className="block h-1.5 w-1.5 bg-[var(--ground)]" />
                    )}
                  </span>
                  <span className="truncate">{a.name}</span>
                  {qty > 1 && (
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                      {qty}x
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <Select
            value={formData.accountId}
            onValueChange={(v) => setFormData({ ...formData, accountId: v })}
            disabled={disabled}
          >
            <SelectTrigger className="bg-background h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedQty > 1 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isMultiAccount
              ? "Cards marked Nx track identical copies. PnL is for one representative account, not a combined total."
              : `This card tracks ${selectedQty} identical accounts. PnL is for one representative account, not a combined total.`}
          </p>
        )}
        {mixedContracts && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Net PnL is copied as-is. If contract size differs across these accounts, log them separately.
          </p>
        )}
      </div>

      {/* Symbol */}
      <div className={cn(TRADE_FIELD, COL_HALF)}>
        <Label className={TRADE_LABEL}>Symbol</Label>
        <Select
          value={formData.symbol}
          onValueChange={(v) => setFormData({ ...formData, symbol: v })}
          disabled={disabled}
        >
          <SelectTrigger className="bg-background font-mono h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRADING_SYMBOLS.map((sym) => (
              <SelectItem key={sym} value={sym}>
                {sym}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Net PnL */}
      <div className={cn(TRADE_FIELD, COL_HALF)}>
        <Label className={TRADE_LABEL}>Net PnL ($)</Label>
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.pnl}
          onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
          className="bg-background font-mono h-9"
          disabled={disabled}
        />
      </div>

      {/* Entry */}
      <div className={cn(TRADE_FIELD, COL_THIRD)}>
        <Label className={cn(TRADE_LABEL, "text-muted-foreground")}>Entry $</Label>
        <Input
          type="number"
          step="0.25"
          placeholder="—"
          value={meta.entryPrice ?? ""}
          onChange={(e) =>
            setMeta({
              ...meta,
              entryPrice: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
          className="bg-background font-mono text-xs h-9"
          disabled={disabled}
        />
      </div>

      {/* Exit */}
      <div className={cn(TRADE_FIELD, COL_THIRD)}>
        <Label className={cn(TRADE_LABEL, "text-muted-foreground")}>Exit $</Label>
        <Input
          type="number"
          step="0.25"
          placeholder="—"
          value={meta.exitPrice ?? ""}
          onChange={(e) =>
            setMeta({
              ...meta,
              exitPrice: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
          className="bg-background font-mono text-xs h-9"
          disabled={disabled}
        />
      </div>

      {/* Qty */}
      <div className={cn(TRADE_FIELD, COL_THIRD)}>
        <Label className={cn(TRADE_LABEL, "text-muted-foreground")}>Qty</Label>
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="—"
          value={meta.contracts ?? ""}
          onChange={(e) =>
            setMeta({
              ...meta,
              contracts: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className="bg-background font-mono text-xs h-9"
          disabled={disabled}
        />
      </div>

      {/* Grade */}
      <div className={cn(TRADE_FIELD, COL_FULL)}>
        <Label className={cn(TRADE_LABEL, "text-muted-foreground")}>Grade</Label>
        <div className="flex gap-0.5 sm:gap-1 flex-wrap">
          {GRADES.map((grade) => {
            const s = GRADE_STYLES[grade]
            const active = meta.grade === grade
            return (
              <button
                key={grade}
                type="button"
                disabled={disabled}
                onClick={() => setMeta({ ...meta, grade: active ? undefined : grade })}
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all",
                  active ? s.activeClassName : s.className,
                )}
              >
                {grade}
              </button>
            )
          })}
        </div>
      </div>

      {/* Setup */}
      <div className={cn(TRADE_FIELD, COL_FULL)}>
        <Label className={cn(TRADE_LABEL, "text-muted-foreground")}>Setup</Label>
        <div className="flex gap-0.5 sm:gap-1 flex-wrap">
          {SETUP_TAGS.map((tag) => {
            const active = meta.setupTags?.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                disabled={disabled}
                onClick={() => toggleSetup(tag)}
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all",
                  active
                    ? "bg-[rgba(83,104,120,0.18)] border-[rgba(83,104,120,0.38)] text-[#94AAB8]"
                    : "border-[rgba(83,104,120,0.15)] text-[#E5E4E2]/35 hover:border-[rgba(83,104,120,0.28)] hover:text-[#94AAB8]/70",
                )}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      {/* Discipline */}
      <div className={cn(TRADE_FIELD, COL_FULL)}>
        <Label className={cn(TRADE_LABEL, "text-muted-foreground")}>Discipline</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
          <div className="flex gap-0.5 sm:gap-1 flex-wrap">
            {DISCIPLINE_POSITIVE.map((tag) => {
              const active = meta.disciplineTags?.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={disabled}
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
          <div className="flex gap-0.5 sm:gap-1 flex-wrap">
            {DISCIPLINE_NEGATIVE.map((tag) => {
              const active = meta.disciplineTags?.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={disabled}
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
      <div className={cn(TRADE_FIELD, COL_FULL)}>
        <Label className={cn(TRADE_LABEL, "text-muted-foreground")}>Notes</Label>
        <Textarea
          placeholder="Brief context on this trade..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="bg-background resize-none h-[72px] md:h-14 text-sm"
          disabled={disabled}
        />
      </div>
    </>
  )
}
