"use client"

import { format } from "date-fns"
import { useId, useState } from "react"
import { CalendarIcon, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Account, RiskProfile } from "@/lib/types"
import {
  DISCIPLINE_NEGATIVE,
  DISCIPLINE_POSITIVE,
  DIRECTION_OPTIONS,
  SETUP_TAGS,
  type DisciplineTag,
  type SetupTag,
  type TradeDirection,
  type TradeGrade,
  type TradeMeta,
} from "@/lib/trade-meta"
import { SESSION_OPTIONS } from "@/lib/sessions"
import { TRADING_SYMBOLS } from "@/lib/trading-symbols"
import { COL_DATE, COL_FULL, COL_HALF, TRADE_FIELD, TRADE_LABEL } from "@/components/trade-modal-layout"
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
  accountIds?: string[]
  onAccountIdsChange?: (ids: string[]) => void
  userDefaultRiskProfile?: RiskProfile | null
  defaultDetailsOpen?: boolean
}

const inactivePill = "border-[var(--hairline)] bg-[var(--raised)] text-[var(--muted)] hover:border-[var(--faint)] hover:text-[var(--text)]"
const activePill = "border-[var(--text)] bg-[var(--text)] text-[var(--ground)]"

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
  defaultDetailsOpen = false,
}: TradeFormBodyProps) {
  const symbolListId = useId()
  const [detailsPreference, setDetailsPreference] = useState<boolean | null>(null)
  const [showAccounts, setShowAccounts] = useState(false)
  const isMultiAccount = onAccountIdsChange != null
  const selectedIds = isMultiAccount ? (accountIds ?? []) : formData.accountId ? [formData.accountId] : []
  const selectedAccounts = accounts.filter((account) => selectedIds.includes(account.id))
  const selectedQty = selectedAccounts.reduce((max, account) => Math.max(max, getAccountQuantity(account)), 1)
  const mixedContracts = isMultiAccount && hasMixedRiskContracts(selectedAccounts, userDefaultRiskProfile)

  const showDetails = detailsPreference ?? defaultDetailsOpen

  const reviewAreas = [
    Boolean(meta.session || meta.direction || meta.entryPrice != null || meta.exitPrice != null || meta.contracts != null),
    Boolean(meta.grade || meta.setupTags?.length),
    Boolean(meta.disciplineTags?.length),
    Boolean(formData.notes.trim()),
  ]
  const completedReviewAreas = reviewAreas.filter(Boolean).length

  const toggleAccount = (id: string) => {
    if (!onAccountIdsChange) return
    const next = selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]
    onAccountIdsChange(next)
  }

  return (
    <>
      <div className={cn(TRADE_FIELD, COL_DATE)}>
        <Label className={TRADE_LABEL}>Date</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={disabled} className={cn("h-10 w-full justify-start gap-2 text-left font-normal", !formData.date && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {formData.date ? format(parseDateStr(formData.date), "MMMM d, yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-[var(--hairline)] bg-[var(--raised)] p-0" align="start" sideOffset={6}>
            <Calendar
              mode="single"
              selected={formData.date ? parseDateStr(formData.date) : undefined}
              onSelect={(date) => {
                if (!date) return
                setFormData({ ...formData, date: serializeDateStr(date) })
                setCalendarOpen(false)
              }}
              defaultMonth={formData.date ? parseDateStr(formData.date) : new Date()}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className={cn(TRADE_FIELD, "md:col-span-8")}>
        <Label className={TRADE_LABEL}>{isMultiAccount ? "Accounts" : "Account"}</Label>
        {isMultiAccount ? (
          <div className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]">
            <button type="button" disabled={disabled} onClick={() => setShowAccounts((value) => !value)} className="flex h-10 w-full items-center justify-between gap-4 px-3 text-left" aria-expanded={showAccounts}>
              <span className="min-w-0 truncate text-sm">
                {selectedAccounts.length === 0 ? "Choose accounts" : selectedAccounts.length === 1 ? selectedAccounts[0].name : `${selectedAccounts.length} accounts selected`}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                Change
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAccounts && "rotate-180")} />
              </span>
            </button>
            {showAccounts && (
              <div className="max-h-44 divide-y divide-[var(--hairline)] overflow-y-auto border-t border-[var(--hairline)]">
                {accounts.map((account) => {
                  const checked = selectedIds.includes(account.id)
                  const quantity = getAccountQuantity(account)
                  return (
                    <button key={account.id} type="button" disabled={disabled} onClick={() => toggleAccount(account.id)} aria-pressed={checked} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface)]", disabled && "cursor-not-allowed opacity-50", checked ? "text-[var(--text)]" : "text-[var(--muted)]")}>
                      <span className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border", checked ? "border-[var(--text)] bg-[var(--text)]" : "border-[var(--faint)]")} aria-hidden>
                        {checked && <span className="h-1.5 w-1.5 bg-[var(--ground)]" />}
                      </span>
                      <span className="truncate">{account.name}</span>
                      {quantity > 1 && <span className="ml-auto font-mono text-[10px] text-[var(--muted)]">{quantity}x</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <Select value={formData.accountId} onValueChange={(value) => setFormData({ ...formData, accountId: value })} disabled={disabled}>
            <SelectTrigger className="h-10 bg-[var(--raised)]"><SelectValue placeholder="Choose account" /></SelectTrigger>
            <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {selectedQty > 1 && <p className="mt-1 text-[10px] text-muted-foreground">{isMultiAccount ? "Cards marked Nx track identical copies. Enter P&L for one representative account." : `This card tracks ${selectedQty} identical accounts. Enter P&L for one representative account.`}</p>}
        {mixedContracts && <p className="mt-1 text-[10px] text-muted-foreground">Contract sizes differ across this selection. Log those accounts separately when P&amp;L differs.</p>}
      </div>

      <div className={cn(TRADE_FIELD, COL_HALF)}>
        <Label className={TRADE_LABEL}>Symbol</Label>
        <Input
          value={formData.symbol}
          onChange={(event) => setFormData({ ...formData, symbol: event.target.value.toUpperCase() })}
          onBlur={() => setFormData((current) => ({ ...current, symbol: current.symbol.trim().toUpperCase() }))}
          list={symbolListId}
          placeholder="NQ or custom symbol"
          autoComplete="off"
          maxLength={16}
          className="h-10 bg-[var(--raised)] font-mono uppercase"
          disabled={disabled}
          required
        />
        <datalist id={symbolListId}>{TRADING_SYMBOLS.map((symbol) => <option key={symbol} value={symbol} />)}</datalist>
        <p className="mt-1 text-[10px] text-[var(--muted)]">Choose a suggestion or type any market symbol.</p>
      </div>

      <div className={cn(TRADE_FIELD, COL_HALF)}>
        <Label className={TRADE_LABEL}>Net P&amp;L</Label>
        <Input type="number" step="0.01" placeholder="0.00" value={formData.pnl} onChange={(event) => setFormData({ ...formData, pnl: event.target.value })} className="h-10 bg-[var(--raised)] font-mono" disabled={disabled} required />
      </div>

      <div className={cn(COL_FULL, "mt-1 overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]")}>
        <button type="button" disabled={disabled} onClick={() => setDetailsPreference(!showDetails)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50" aria-expanded={showDetails}>
          <span>
            <span className="block text-sm font-medium text-[var(--text)]">Review details</span>
            <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{completedReviewAreas === 0 ? "Optional context for better analytics" : `${completedReviewAreas} of 4 review areas captured`}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{showDetails ? "Hide" : "Review"}<ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} /></span>
        </button>

        {showDetails && (
          <div className="divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
            <section className="grid gap-4 px-4 py-4 md:grid-cols-[150px_1fr] md:px-5">
              <div>
                <p className="font-mono text-[10px] text-[var(--faint)]">01</p>
                <h3 className="mt-1 text-sm font-medium">Execution</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">When and how the position was taken.</p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={TRADE_FIELD}>
                    <Label className={TRADE_LABEL}>Session</Label>
                    <div className="flex gap-1">
                      {SESSION_OPTIONS.map(({ id, label }) => {
                        const active = meta.session === id
                        return <button key={id} type="button" disabled={disabled} onClick={() => setMeta({ ...meta, session: active ? undefined : id })} className={cn("flex-1 rounded-[2px] border px-2 py-2 text-[11px] font-semibold transition-colors", active ? activePill : inactivePill)}>{label}</button>
                      })}
                    </div>
                  </div>
                  <div className={TRADE_FIELD}>
                    <Label className={TRADE_LABEL}>Direction</Label>
                    <div className="flex gap-1">
                      {DIRECTION_OPTIONS.map(({ id, label }) => {
                        const active = meta.direction === id
                        return <button key={id} type="button" disabled={disabled} onClick={() => setMeta({ ...meta, direction: active ? undefined : id as TradeDirection })} className={cn("flex-1 rounded-[2px] border px-2 py-2 text-[11px] font-semibold transition-colors", active ? activePill : inactivePill)}>{label}</button>
                      })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className={TRADE_FIELD}>
                    <Label className={TRADE_LABEL}>Entry price</Label>
                    <Input type="number" step="0.25" placeholder="—" value={meta.entryPrice ?? ""} onChange={(event) => setMeta({ ...meta, entryPrice: event.target.value ? Number(event.target.value) : undefined })} className="h-9 bg-[var(--surface)] font-mono text-xs" disabled={disabled} />
                  </div>
                  <div className={TRADE_FIELD}>
                    <Label className={TRADE_LABEL}>Exit price</Label>
                    <Input type="number" step="0.25" placeholder="—" value={meta.exitPrice ?? ""} onChange={(event) => setMeta({ ...meta, exitPrice: event.target.value ? Number(event.target.value) : undefined })} className="h-9 bg-[var(--surface)] font-mono text-xs" disabled={disabled} />
                  </div>
                  <div className={TRADE_FIELD}>
                    <Label className={TRADE_LABEL}>Contracts</Label>
                    <Input type="number" step="1" min="1" placeholder="—" value={meta.contracts ?? ""} onChange={(event) => setMeta({ ...meta, contracts: event.target.value ? Number.parseInt(event.target.value, 10) : undefined })} className="h-9 bg-[var(--surface)] font-mono text-xs" disabled={disabled} />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 px-4 py-4 md:grid-cols-[150px_1fr] md:px-5">
              <div>
                <p className="font-mono text-[10px] text-[var(--faint)]">02</p>
                <h3 className="mt-1 text-sm font-medium">Playbook</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">What you traded and the quality of the decision.</p>
              </div>
              <div className="space-y-4">
                <div className={TRADE_FIELD}>
                  <Label className={TRADE_LABEL}>Decision grade</Label>
                  <div className="flex flex-wrap gap-1">
                    {GRADES.map((grade) => {
                      const active = meta.grade === grade
                      return <button key={grade} type="button" disabled={disabled} onClick={() => setMeta({ ...meta, grade: active ? undefined : grade })} className={cn("min-w-10 rounded-[2px] border px-2.5 py-1.5 text-[11px] font-semibold transition-colors", active ? activePill : inactivePill)}>{grade}</button>
                    })}
                  </div>
                </div>
                <div className={TRADE_FIELD}>
                  <Label className={TRADE_LABEL}>Setup tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {SETUP_TAGS.map((tag) => {
                      const active = meta.setupTags?.includes(tag)
                      return <button key={tag} type="button" disabled={disabled} onClick={() => toggleSetup(tag)} className={cn("rounded-[2px] border px-2 py-1.5 text-[10px] font-medium transition-colors", active ? activePill : inactivePill)}>{tag}</button>
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 px-4 py-4 md:grid-cols-[150px_1fr] md:px-5">
              <div>
                <p className="font-mono text-[10px] text-[var(--faint)]">03</p>
                <h3 className="mt-1 text-sm font-medium">Review</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">Capture process strengths and leaks while they are fresh.</p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <Label className={TRADE_LABEL}>Kept process</Label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {DISCIPLINE_POSITIVE.map((tag) => {
                        const active = meta.disciplineTags?.includes(tag)
                        return <button key={tag} type="button" disabled={disabled} onClick={() => toggleDiscipline(tag)} className={cn("rounded-[2px] border px-2 py-1.5 text-[10px] font-medium transition-colors", active ? activePill : inactivePill)}>{tag}</button>
                      })}
                    </div>
                  </div>
                  <div className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <Label className={TRADE_LABEL}>Process leaks</Label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {DISCIPLINE_NEGATIVE.map((tag) => {
                        const active = meta.disciplineTags?.includes(tag)
                        return <button key={tag} type="button" disabled={disabled} onClick={() => toggleDiscipline(tag)} className={cn("rounded-[2px] border px-2 py-1.5 text-[10px] font-medium transition-colors", active ? activePill : inactivePill)}>{tag}</button>
                      })}
                    </div>
                  </div>
                </div>
                <div className={TRADE_FIELD}>
                  <Label className={TRADE_LABEL}>Notes</Label>
                  <Textarea placeholder="What mattered about this trade?" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} className="min-h-20 resize-none bg-[var(--surface)] text-sm" disabled={disabled} />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
