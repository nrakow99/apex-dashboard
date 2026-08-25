"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchDailySessionPlan, saveDailySessionPlan } from "@/lib/supabase/database"
import type { DailySessionPlan } from "@/lib/types"
import { cn } from "@/lib/utils"

const EMPTY_PLAN = (date: string): DailySessionPlan => ({
  date,
  reviewedRiskQueue: false,
  confirmedFirmPortal: false,
  checkedNewsEvents: false,
  personalLossLimit: null,
  maxTrades: null,
  notes: "",
})

const checks: Array<{ key: keyof Pick<DailySessionPlan, "reviewedRiskQueue" | "confirmedFirmPortal" | "checkedNewsEvents">; label: string; detail: string }> = [
  { key: "reviewedRiskQueue", label: "Risk queue reviewed", detail: "Floor room and account status checked" },
  { key: "confirmedFirmPortal", label: "Firm portal confirmed", detail: "Live values checked at the source" },
  { key: "checkedNewsEvents", label: "News window checked", detail: "Scheduled volatility reviewed" },
]

export function DailySessionPlanCard({ date }: { date: string }) {
  const [plan, setPlan] = useState<DailySessionPlan>(() => EMPTY_PLAN(date))
  const [lossLimit, setLossLimit] = useState("")
  const [maxTrades, setMaxTrades] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [available, setAvailable] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchDailySessionPlan(date).then((result) => {
      if (!active) return
      if (result.error) {
        setAvailable(false)
        setMessage("Session planning is unavailable until the database update is applied.")
      } else {
        const next = result.data ?? EMPTY_PLAN(date)
        setAvailable(true)
        setPlan(next)
        setLossLimit(next.personalLossLimit == null ? "" : String(next.personalLossLimit))
        setMaxTrades(next.maxTrades == null ? "" : String(next.maxTrades))
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [date])

  const save = async () => {
    const parsedLimit = lossLimit.trim() === "" ? null : Number(lossLimit)
    const parsedTrades = maxTrades.trim() === "" ? null : Number(maxTrades)
    if (parsedLimit != null && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      setMessage("Personal loss limit must be a positive amount or left blank.")
      return
    }
    if (parsedTrades != null && (!Number.isInteger(parsedTrades) || parsedTrades <= 0 || parsedTrades > 100)) {
      setMessage("Max trades must be a whole number from 1 to 100 or left blank.")
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await saveDailySessionPlan({
      ...plan,
      personalLossLimit: parsedLimit,
      maxTrades: parsedTrades,
    })
    setSaving(false)
    if (result.error || !result.data) {
      setMessage(result.error?.message ?? "The session plan was not saved.")
      return
    }
    setPlan(result.data)
    setMessage("Session plan saved across devices.")
  }

  return (
    <section className="mb-8 border border-[var(--hairline)] bg-[var(--surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--hairline)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">Pre-trade plan</p>
          <h2 className="mt-1 text-base font-medium">Set the boundaries before the session</h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Personal controls only. These do not replace or modify firm rules.</p>
        </div>
        <Button size="sm" onClick={save} disabled={loading || saving || !available}>
          {saving && <Loader2 className="animate-spin" />}
          Save plan
        </Button>
      </div>

      {loading ? <p className="px-5 py-8 text-sm text-[var(--muted)]">Loading today’s plan…</p> : !available ? (
        <p className="px-5 py-6 text-sm text-[var(--muted)]">{message}</p>
      ) : <>
        <div className="grid gap-px bg-[var(--hairline)] lg:grid-cols-3">
          {checks.map((item) => {
            const checked = plan[item.key]
            return <button key={item.key} type="button" onClick={() => { setPlan((current) => ({ ...current, [item.key]: !checked })); setMessage(null) }} className="flex items-start gap-3 bg-[var(--surface)] p-4 text-left transition-colors hover:bg-[var(--raised)]">
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border", checked ? "border-white bg-white text-black" : "border-[var(--faint)] text-transparent")}><Check className="h-3.5 w-3.5" /></span>
              <span><span className="block text-xs font-medium">{item.label}</span><span className="mt-1 block text-[10px] text-[var(--muted)]">{item.detail}</span></span>
            </button>
          })}
        </div>
        <div className="grid gap-4 border-t border-[var(--hairline)] p-5 md:grid-cols-[180px_150px_minmax(0,1fr)]">
          <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Personal loss limit</span><Input type="number" min="0" step="any" value={lossLimit} onChange={(event) => { setLossLimit(event.target.value); setMessage(null) }} placeholder="Optional" className="font-mono" /></label>
          <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Max trades</span><Input type="number" min="1" max="100" step="1" value={maxTrades} onChange={(event) => { setMaxTrades(event.target.value); setMessage(null) }} placeholder="Optional" className="font-mono" /></label>
          <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Session note</span><Textarea value={plan.notes} onChange={(event) => { setPlan((current) => ({ ...current, notes: event.target.value })); setMessage(null) }} placeholder="What invalidates today’s plan?" className="min-h-10 resize-none" /></label>
        </div>
        {message && <p role="status" className="border-t border-[var(--hairline)] px-5 py-3 text-xs text-[var(--muted)]">{message}</p>}
      </>}
    </section>
  )
}
