"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings, Loader2, Plus, Trash2 } from "lucide-react"
import type { InstrumentSpec, RiskProfile } from "@/lib/types"
import { RiskProfileFormFields } from "@/components/risk-profile-fields"
import { findInstrumentSpec, normalizeSymbol, pointsToTicks } from "@/lib/instrument-specs"

interface SettingsModalProps {
  specs: InstrumentSpec[]
  userDefault: RiskProfile | null
  onSaveDefault: (profile: RiskProfile | null) => Promise<void>
  onAddInstrument: (spec: { symbol: string; label: string; tickSize: number; tickValue: number }) => Promise<void>
  onDeleteInstrument: (symbol: string) => Promise<void>
  isSaving?: boolean
}

export function SettingsModal({
  specs,
  userDefault,
  onSaveDefault,
  onAddInstrument,
  onDeleteInstrument,
  isSaving = false,
}: SettingsModalProps) {
  const [open, setOpen] = useState(false)

  const [symbol, setSymbol] = useState("")
  const [contracts, setContracts] = useState("")
  const [stopPoints, setStopPoints] = useState("")

  const [showAddInstrument, setShowAddInstrument] = useState(false)
  const [newSymbol, setNewSymbol] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [newTickSize, setNewTickSize] = useState("")
  const [newTickValue, setNewTickValue] = useState("")

  useEffect(() => {
    if (!open) return
    if (userDefault) {
      const spec = findInstrumentSpec(specs, userDefault.symbol)
      setSymbol(userDefault.symbol)
      setContracts(String(userDefault.contracts))
      setStopPoints(spec ? String(userDefault.riskStopTicks * spec.tickSize) : "")
    } else {
      setSymbol("")
      setContracts("")
      setStopPoints("")
    }
  }, [open, userDefault, specs])

  const handleSaveDefault = async () => {
    const spec = findInstrumentSpec(specs, symbol)
    const contractsNum = parseFloat(contracts)
    const stopPointsNum = parseFloat(stopPoints)
    if (!spec || !Number.isFinite(contractsNum) || contractsNum <= 0 || !Number.isFinite(stopPointsNum) || stopPointsNum <= 0) {
      return
    }
    await onSaveDefault({
      symbol: spec.symbol,
      contracts: Math.floor(contractsNum),
      riskStopTicks: pointsToTicks(stopPointsNum, spec.tickSize),
    })
  }

  const handleClearDefault = async () => {
    await onSaveDefault(null)
  }

  const handleAddInstrument = async () => {
    const tickSizeNum = parseFloat(newTickSize)
    const tickValueNum = parseFloat(newTickValue)
    if (!newSymbol.trim() || !newLabel.trim() || !(tickSizeNum > 0) || !(tickValueNum > 0)) return
    await onAddInstrument({
      symbol: normalizeSymbol(newSymbol),
      label: newLabel.trim(),
      tickSize: tickSizeNum,
      tickValue: tickValueNum,
    })
    setNewSymbol("")
    setNewLabel("")
    setNewTickSize("")
    setNewTickValue("")
    setShowAddInstrument(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Settings"
          className="h-9 w-9 shrink-0 border border-white/10 bg-slate-900/55 hover:bg-slate-800/80"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Default Risk Profile</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Used to show &ldquo;headroom in trades&rdquo; next to drawdown remaining, on every account that
                doesn&apos;t have its own override. Set this once; override it per account only when needed.
              </p>
            </div>

            <RiskProfileFormFields
              specs={specs}
              symbol={symbol}
              contracts={contracts}
              stopPoints={stopPoints}
              onSymbolChange={setSymbol}
              onContractsChange={setContracts}
              onStopPointsChange={setStopPoints}
              disabled={isSaving}
            />

            <div className="flex justify-end gap-2">
              {userDefault && (
                <Button type="button" variant="ghost" size="sm" onClick={handleClearDefault} disabled={isSaving}>
                  Clear
                </Button>
              )}
              <Button type="button" size="sm" onClick={handleSaveDefault} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Save Default
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--hairline)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Instruments</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tick size (points) and tick value ($) per symbol. Built-ins are sourced from exchange contract
                  specs; add your own to extend the table or override one you believe is wrong.
                </p>
              </div>
            </div>

            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {[...specs]
                .sort((a, b) => a.symbol.localeCompare(b.symbol))
                .map((s) => (
                  <div
                    key={`${s.symbol}-${s.isBuiltin}`}
                    className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-semibold">{s.symbol}</span>
                      <span className="text-muted-foreground ml-2 truncate">{s.label}</span>
                      {!s.isBuiltin && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">custom</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-muted-foreground">
                        {s.tickSize} pt / ${s.tickValue.toFixed(2)}
                      </span>
                      {!s.isBuiltin && (
                        <button
                          type="button"
                          onClick={() => onDeleteInstrument(s.symbol)}
                          className="text-muted-foreground hover:text-[var(--text)]"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {showAddInstrument ? (
              <div className="space-y-2 p-3 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Symbol</Label>
                    <Input
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value)}
                      placeholder="e.g. ZB"
                      className="bg-background h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Label</Label>
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. 30-Year T-Bond"
                      className="bg-background h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Tick size (points)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newTickSize}
                      onChange={(e) => setNewTickSize(e.target.value)}
                      placeholder="e.g. 0.03125"
                      className="bg-background h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Tick value ($)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newTickValue}
                      onChange={(e) => setNewTickValue(e.target.value)}
                      placeholder="e.g. 31.25"
                      className="bg-background h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddInstrument(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleAddInstrument}>
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowAddInstrument(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Instrument
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
