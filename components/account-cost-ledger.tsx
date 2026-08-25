"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { useToast } from "@/hooks/use-toast"
import { createAccountCost, deleteAccountCost } from "@/lib/supabase/database"
import { localTodayKey } from "@/lib/date-utils"
import type { Account, AccountCost, AccountCostCategory } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

const categoryLabels: Record<AccountCostCategory, string> = {
  evaluation: "Evaluation",
  activation: "Activation",
  reset: "Reset",
  platform: "Platform",
  data: "Market data",
  other: "Other",
}

export function AccountCostLedger({
  accounts,
  costs,
  available,
  onChange,
}: {
  accounts: Account[]
  costs: AccountCost[]
  available: boolean
  onChange: (costs: AccountCost[]) => void
}) {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<AccountCost | null>(null)
  const [draft, setDraft] = useState({ accountId: accounts[0]?.id ?? "", date: localTodayKey(), category: "evaluation" as AccountCostCategory, amount: "", notes: "" })
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const sorted = [...costs].sort((a, b) => b.date.localeCompare(a.date))
  const selectedAccountId = draft.accountId || accounts[0]?.id || ""

  const add = async () => {
    const amount = Number(draft.amount)
    if (!selectedAccountId || !Number.isFinite(amount) || amount <= 0 || !draft.date) {
      toast({ variant: "destructive", title: "Cost is incomplete", description: "Choose an account, date, and positive amount." })
      return
    }
    setSaving(true)
    const result = await createAccountCost({ ...draft, accountId: selectedAccountId, amount })
    setSaving(false)
    if (result.error || !result.data) {
      toast({ variant: "destructive", title: "Cost was not saved", description: result.error?.message ?? "No record returned." })
      return
    }
    onChange([result.data, ...costs])
    setDraft((current) => ({ ...current, amount: "", notes: "" }))
    setShowForm(false)
    toast({ title: "Account cost recorded", description: `${formatCurrency(amount)} added to tracked economics.` })
  }

  const remove = async () => {
    if (!deleting) return
    setSaving(true)
    const result = await deleteAccountCost(deleting.id)
    setSaving(false)
    if (result.error) {
      toast({ variant: "destructive", title: "Cost was not deleted", description: result.error.message })
      return
    }
    onChange(costs.filter((cost) => cost.id !== deleting.id))
    setDeleting(null)
    toast({ title: "Account cost deleted" })
  }

  return (
    <section className="mt-8 border border-[var(--hairline)] bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4">
        <div><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Cost basis</p><h2 className="mt-1 text-base font-medium">Account costs</h2><p className="mt-1 text-xs text-[var(--muted)]">Track only fees you actually paid. They never alter account balances or firm rules.</p></div>
        <Button variant="outline" size="sm" onClick={() => setShowForm((value) => !value)} disabled={!available || accounts.length === 0}><Plus />Add cost</Button>
      </div>

      {!available ? <p className="px-5 py-8 text-sm text-[var(--muted)]">Cost tracking is unavailable until the database update is applied.</p> : <>
        {showForm && <div className="border-b border-[var(--hairline)] bg-[var(--raised)] p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_150px_160px_140px_1.2fr]">
            <label className="space-y-2"><Label>Account</Label><select value={selectedAccountId} onChange={(event) => setDraft((current) => ({ ...current, accountId: event.target.value }))} className="h-10 w-full rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-3 text-xs outline-none">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="space-y-2"><Label>Date paid</Label><Input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
            <label className="space-y-2"><Label>Category</Label><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as AccountCostCategory }))} className="h-10 w-full rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-3 text-xs outline-none">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-2"><Label>Amount</Label><Input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" className="font-mono" /></label>
            <label className="space-y-2"><Label>Note</Label><Input value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional receipt context" /></label>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={add} disabled={saving}>{saving && <Loader2 className="animate-spin" />}Save cost</Button></div>
        </div>}

        {sorted.length === 0 ? <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">No account costs recorded. Return metrics remain unavailable until a real cost is added.</p> : <div className="divide-y divide-[var(--hairline)]">{sorted.map((cost) => <div key={cost.id} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[1fr_150px_120px_120px_44px]"><div className="min-w-0"><p className="truncate text-sm">{accountMap.get(cost.accountId)?.name ?? "Unavailable account"}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{cost.notes || "No note"}</p></div><p className="text-xs text-[var(--muted)]">{categoryLabels[cost.category]}</p><p className="font-mono text-xs text-[var(--muted)]">{cost.date}</p><p className="text-right font-mono text-sm">{formatCurrency(cost.amount)}</p><Button variant="ghost" size="icon" onClick={() => setDeleting(cost)} aria-label="Delete cost"><Trash2 /></Button></div>)}</div>}
      </>}

      <DeleteConfirmationModal open={deleting != null} onOpenChange={(open) => { if (!open) setDeleting(null) }} title="Delete account cost?" description="Tracked net proceeds and return metrics will be recalculated." itemDetails={deleting ? <div className="flex items-center justify-between"><span className="text-sm">{categoryLabels[deleting.category]}</span><span className="font-mono text-sm">{formatCurrency(deleting.amount)}</span></div> : undefined} onConfirm={remove} isDeleting={saving} confirmText="Delete cost" />
    </section>
  )
}
