"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { RiskProfileFormFields } from "@/components/risk-profile-fields"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { DataManagementPanel } from "@/components/data-management-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useToast } from "@/hooks/use-toast"
import { useOnboarding } from "@/hooks/use-onboarding"
import { createClient } from "@/lib/supabase/client"
import { deleteUserInstrumentSpec, saveUserSettings, upsertUserInstrumentSpec } from "@/lib/supabase/database"
import { findInstrumentSpec, normalizeSymbol, pointsToTicks } from "@/lib/instrument-specs"
import type { InstrumentSpec } from "@/lib/types"

export default function SettingsPage() {
  const { accounts, trades, payouts, instrumentSpecs, userRiskProfile, loading, error, setInstrumentSpecs, setUserRiskProfile } = useDashboardData()
  const { toast } = useToast()
  const { restart } = useOnboarding()
  const [email, setEmail] = useState<string | null>(null)
  const [scanConfigured, setScanConfigured] = useState<boolean | null>(null)
  const [savingRisk, setSavingRisk] = useState(false)
  const [riskDraft, setRiskDraft] = useState<{ symbol: string; contracts: string; stopPoints: string } | null>(null)
  const [showInstrumentForm, setShowInstrumentForm] = useState(false)
  const [newInstrument, setNewInstrument] = useState({ symbol: "", label: "", tickSize: "", tickValue: "" })
  const [instrumentSaving, setInstrumentSaving] = useState(false)
  const [deletingSpec, setDeletingSpec] = useState<InstrumentSpec | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    void fetch("/api/status").then((response) => response.ok ? response.json() : Promise.reject()).then((status: { screenshotScanConfigured?: boolean }) => setScanConfigured(Boolean(status.screenshotScanConfigured))).catch(() => setScanConfigured(null))
  }, [])

  const customSpecs = useMemo(() => instrumentSpecs.filter((spec) => !spec.isBuiltin).sort((a, b) => a.symbol.localeCompare(b.symbol)), [instrumentSpecs])
  const builtInSpecs = useMemo(() => instrumentSpecs.filter((spec) => spec.isBuiltin).sort((a, b) => a.symbol.localeCompare(b.symbol)), [instrumentSpecs])
  const accountOverrides = accounts.filter((account) => account.riskSymbol && account.riskContracts && account.riskStopTicks).length
  const storedRiskDraft = useMemo(() => {
    if (!userRiskProfile) return { symbol: "", contracts: "", stopPoints: "" }
    const spec = findInstrumentSpec(instrumentSpecs, userRiskProfile.symbol)
    return {
      symbol: userRiskProfile.symbol,
      contracts: String(userRiskProfile.contracts),
      stopPoints: spec ? String(userRiskProfile.riskStopTicks * spec.tickSize) : "",
    }
  }, [userRiskProfile, instrumentSpecs])
  const riskForm = riskDraft ?? storedRiskDraft

  const handleSaveRisk = async () => {
    const spec = findInstrumentSpec(instrumentSpecs, riskForm.symbol)
    const contractCount = Number(riskForm.contracts)
    const stop = Number(riskForm.stopPoints)
    if (!spec || !Number.isInteger(contractCount) || contractCount <= 0 || !Number.isFinite(stop) || stop <= 0) {
      toast({ variant: "destructive", title: "Risk profile is incomplete", description: "Choose an instrument, whole contract count, and positive stop distance." })
      return
    }
    setSavingRisk(true)
    const profile = { symbol: spec.symbol, contracts: contractCount, riskStopTicks: pointsToTicks(stop, spec.tickSize) }
    const result = await saveUserSettings(profile)
    setSavingRisk(false)
    if (result.error) {
      toast({ variant: "destructive", title: "Risk profile was not saved", description: result.error.message })
      return
    }
    setUserRiskProfile(profile)
    setRiskDraft({ ...riskForm, symbol: profile.symbol, contracts: String(profile.contracts) })
    toast({ title: "Default risk profile saved", description: `${profile.symbol} · ${profile.contracts} contract${profile.contracts === 1 ? "" : "s"}` })
  }

  const handleClearRisk = async () => {
    setSavingRisk(true)
    const result = await saveUserSettings(null)
    setSavingRisk(false)
    if (result.error) {
      toast({ variant: "destructive", title: "Risk profile was not cleared", description: result.error.message })
      return
    }
    setUserRiskProfile(null)
    setRiskDraft({ symbol: "", contracts: "", stopPoints: "" })
    toast({ title: "Default risk profile cleared" })
  }

  const handleAddInstrument = async () => {
    const tickSize = Number(newInstrument.tickSize)
    const tickValue = Number(newInstrument.tickValue)
    if (!newInstrument.symbol.trim() || !newInstrument.label.trim() || !(tickSize > 0) || !(tickValue > 0)) {
      toast({ variant: "destructive", title: "Instrument is incomplete", description: "Symbol, label, tick size, and tick value are required." })
      return
    }
    setInstrumentSaving(true)
    const result = await upsertUserInstrumentSpec({ symbol: normalizeSymbol(newInstrument.symbol), label: newInstrument.label.trim(), tickSize, tickValue })
    setInstrumentSaving(false)
    if (result.error || !result.data) {
      toast({ variant: "destructive", title: "Instrument was not saved", description: result.error?.message ?? "No record returned." })
      return
    }
    setInstrumentSpecs((current) => [...current.filter((spec) => spec.isBuiltin || spec.symbol !== result.data!.symbol), result.data!])
    setNewInstrument({ symbol: "", label: "", tickSize: "", tickValue: "" })
    setShowInstrumentForm(false)
    toast({ title: "Instrument saved", description: `${result.data.symbol} · ${result.data.label}` })
  }

  const handleDeleteInstrument = async () => {
    if (!deletingSpec) return
    setIsDeleting(true)
    const result = await deleteUserInstrumentSpec(deletingSpec.symbol)
    setIsDeleting(false)
    if (result.error) {
      toast({ variant: "destructive", title: "Instrument was not removed", description: result.error.message })
      return
    }
    setInstrumentSpecs((current) => current.filter((spec) => spec.isBuiltin || spec.symbol !== deletingSpec.symbol))
    setDeletingSpec(null)
    toast({ title: "Custom instrument removed" })
  }

  return (
    <AppShell eyebrow="Workspace" title="Settings" description="Control risk assumptions, instrument specifications, and connected app capabilities.">
      {error && <div role="alert" className="mb-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">Some settings data could not load: {error}</div>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="border border-[var(--hairline)] bg-[var(--surface)]">
            <div className="border-b border-[var(--hairline)] px-5 py-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Risk model</p><h2 className="mt-1 text-base font-medium">Default trade risk</h2><p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[var(--muted)]">Used to convert drawdown remaining into estimated trades of headroom. Account-level overrides take precedence. No headroom estimate is shown when a complete profile is unavailable.</p></div>
            <div className="p-5">
              {loading ? <p className="text-sm text-[var(--muted)]">Loading risk settings…</p> : <div className="max-w-2xl"><RiskProfileFormFields specs={instrumentSpecs} symbol={riskForm.symbol} contracts={riskForm.contracts} stopPoints={riskForm.stopPoints} onSymbolChange={(value) => setRiskDraft({ ...riskForm, symbol: value })} onContractsChange={(value) => setRiskDraft({ ...riskForm, contracts: value })} onStopPointsChange={(value) => setRiskDraft({ ...riskForm, stopPoints: value })} disabled={savingRisk} /><div className="mt-5 flex justify-end gap-2">{userRiskProfile && <Button variant="ghost" onClick={handleClearRisk} disabled={savingRisk}>Clear default</Button>}<Button onClick={handleSaveRisk} disabled={savingRisk}>{savingRisk && <Loader2 className="animate-spin" />}Save default</Button></div></div>}
            </div>
          </section>

          <section className="border border-[var(--hairline)] bg-[var(--surface)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4"><div><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Contract data</p><h2 className="mt-1 text-base font-medium">Instruments</h2><p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[var(--muted)]">Built-ins use verified exchange specifications. A custom row can add another market or override a built-in symbol for your own calculations.</p></div><Button variant="outline" size="sm" onClick={() => setShowInstrumentForm((value) => !value)}><Plus />Add custom</Button></div>
            {showInstrumentForm && <div className="border-b border-[var(--hairline)] bg-[var(--raised)] p-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Symbol</Label><Input value={newInstrument.symbol} onChange={(event) => setNewInstrument((current) => ({ ...current, symbol: event.target.value }))} placeholder="ZB" className="font-mono" /></div><div className="space-y-2"><Label>Label</Label><Input value={newInstrument.label} onChange={(event) => setNewInstrument((current) => ({ ...current, label: event.target.value }))} placeholder="30-Year T-Bond" /></div><div className="space-y-2"><Label>Tick size, points</Label><Input type="number" step="any" value={newInstrument.tickSize} onChange={(event) => setNewInstrument((current) => ({ ...current, tickSize: event.target.value }))} placeholder="0.03125" className="font-mono" /></div><div className="space-y-2"><Label>Tick value, USD</Label><Input type="number" step="any" value={newInstrument.tickValue} onChange={(event) => setNewInstrument((current) => ({ ...current, tickValue: event.target.value }))} placeholder="31.25" className="font-mono" /></div></div><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowInstrumentForm(false)}>Cancel</Button><Button onClick={handleAddInstrument} disabled={instrumentSaving}>{instrumentSaving && <Loader2 className="animate-spin" />}Save instrument</Button></div></div>}
            <div className="divide-y divide-[var(--hairline)]">
              {customSpecs.length > 0 && <div className="px-5 py-3 text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Custom and overrides</div>}
              {customSpecs.map((spec) => <div key={`custom-${spec.symbol}`} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[90px_1fr_130px_44px]"><span className="font-mono text-xs">{spec.symbol}</span><div><p className="text-xs">{spec.label}</p><p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Custom</p></div><span className="font-mono text-[11px] text-[var(--muted)]">{spec.tickSize} pt · ${spec.tickValue.toFixed(2)}</span><Button variant="ghost" size="icon" onClick={() => setDeletingSpec(spec)} aria-label={`Remove ${spec.symbol}`}><Trash2 /></Button></div>)}
              <div className="px-5 py-3 text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Verified built-ins</div>
              {builtInSpecs.map((spec) => <div key={`built-in-${spec.symbol}`} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[90px_1fr_130px_44px]"><span className="font-mono text-xs">{spec.symbol}</span><div className="min-w-0"><p className="truncate text-xs">{spec.label}</p><p className="mt-1 truncate text-[9px] text-[var(--muted)]">{spec.source ?? "Source unavailable"}</p></div><span className="font-mono text-[11px] text-[var(--muted)]">{spec.tickSize} pt · ${spec.tickValue.toFixed(2)}</span><Check className="h-3.5 w-3.5 text-[var(--muted)]" /></div>)}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-[var(--hairline)] bg-[var(--surface)] p-5"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Profile</p><h2 className="mt-1 text-base font-medium">Signed-in account</h2><p className="mt-4 break-all font-mono text-xs">{email ?? "Unavailable"}</p><p className="mt-2 text-[11px] text-[var(--muted)]">Authentication is managed by your secure Supabase session.</p><Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => { restart(); toast({ title: "Setup guide restarted" }) }}>Restart setup guide</Button></section>

          <section className="border border-[var(--hairline)] bg-[var(--surface)]"><div className="border-b border-[var(--hairline)] px-5 py-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Data</p><h2 className="mt-1 text-base font-medium">Workspace inventory</h2></div><div className="divide-y divide-[var(--hairline)]">{[["Accounts", accounts.length], ["Trade records", trades.length], ["Payouts", payouts.length], ["Account risk overrides", accountOverrides]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between px-5 py-3 text-xs"><span className="text-[var(--muted)]">{label}</span><span className="font-mono">{value}</span></div>)}</div><div className="border-t border-[var(--hairline)] p-4"><Button asChild variant="outline" className="w-full"><Link href="/trades">Manage trade data</Link></Button></div></section>

          <section className="border border-[var(--hairline)] bg-[var(--surface)]"><div className="border-b border-[var(--hairline)] px-5 py-4"><p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Capabilities</p><h2 className="mt-1 text-base font-medium">System status</h2></div><div className="divide-y divide-[var(--hairline)]"><div className="flex items-start justify-between gap-4 px-5 py-3"><div><p className="text-xs">Workspace database</p><p className="mt-1 text-[10px] text-[var(--muted)]">Accounts, trades, settings, payouts</p></div><span className="text-[10px] uppercase tracking-[0.12em]">{error ? "Issue" : loading ? "Checking" : "Connected"}</span></div><div className="flex items-start justify-between gap-4 px-5 py-3"><div><p className="text-xs">Screenshot trade scan</p><p className="mt-1 text-[10px] text-[var(--muted)]">OpenAI vision extraction</p></div><span className="text-[10px] uppercase tracking-[0.12em]">{scanConfigured == null ? "Unavailable" : scanConfigured ? "Configured" : "Not configured"}</span></div><div className="flex items-start justify-between gap-4 px-5 py-3"><div><p className="text-xs">Prop-firm rule engine</p><p className="mt-1 text-[10px] text-[var(--muted)]">Apex, Lucid, Tradeify, Topstep, Alpha</p></div><span className="text-[10px] uppercase tracking-[0.12em]">Active</span></div></div></section>
        </aside>
      </div>

      <div className="mt-6"><DataManagementPanel accounts={accounts} trades={trades} payouts={payouts} /></div>

      <DeleteConfirmationModal open={deletingSpec != null} onOpenChange={(open) => { if (!open) setDeletingSpec(null) }} title="Remove custom instrument?" description="Headroom estimates using this custom specification may become unavailable or fall back to the verified built-in with the same symbol." itemDetails={deletingSpec ? <div className="flex items-center justify-between"><span className="font-mono text-sm">{deletingSpec.symbol}</span><span className="text-sm text-[var(--muted)]">{deletingSpec.label}</span></div> : undefined} onConfirm={handleDeleteInstrument} isDeleting={isDeleting} confirmText="Remove instrument" />
    </AppShell>
  )
}
