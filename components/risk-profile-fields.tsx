"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { InstrumentSpec } from "@/lib/types"
import { findInstrumentSpec, pointsToTicks, ticksToPoints } from "@/lib/instrument-specs"

interface RiskProfileFormFieldsProps {
  specs: readonly InstrumentSpec[]
  symbol: string
  /** Raw form strings, not numbers — parent owns parsing/validation on save. */
  contracts: string
  stopPoints: string
  onSymbolChange: (symbol: string) => void
  onContractsChange: (value: string) => void
  onStopPointsChange: (value: string) => void
  disabled?: boolean
}

/**
 * Shared symbol / contracts / stop-points fields, used by both the Settings
 * modal (user-level default) and the per-account override section. Points
 * are what the trader types (the natural unit per instrument — 0.25 for
 * ES, 1 for GC, etc.); ticks are what actually gets stored and computed on
 * (lib/headroom.ts). This component echoes the rounded tick count back so a
 * rounding artifact — a point value that isn't a whole number of ticks —
 * is visible rather than silently swallowed.
 */
export function RiskProfileFormFields({
  specs,
  symbol,
  contracts,
  stopPoints,
  onSymbolChange,
  onContractsChange,
  onStopPointsChange,
  disabled,
}: RiskProfileFormFieldsProps) {
  const spec = findInstrumentSpec(specs, symbol)
  const stopPointsNum = parseFloat(stopPoints)
  const hasValidStop = spec != null && Number.isFinite(stopPointsNum) && stopPointsNum > 0
  const ticks = hasValidStop ? pointsToTicks(stopPointsNum, spec!.tickSize) : null
  const echoedPoints = ticks != null ? ticksToPoints(ticks, spec!.tickSize) : null
  const roundedAway = echoedPoints != null && Math.abs(echoedPoints - stopPointsNum) > 1e-9

  const contractsNum = parseFloat(contracts)
  const riskPerTrade =
    spec != null && ticks != null && Number.isFinite(contractsNum) && contractsNum > 0
      ? contractsNum * ticks * spec.tickValue
      : null

  const sortedSpecs = [...specs].sort((a, b) => a.symbol.localeCompare(b.symbol))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Instrument</Label>
          <Select value={symbol || undefined} onValueChange={onSymbolChange} disabled={disabled}>
            <SelectTrigger className="bg-background h-9">
              <SelectValue placeholder="Select symbol" />
            </SelectTrigger>
            <SelectContent>
              {sortedSpecs.map((s) => (
                <SelectItem key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.label}
                  {!s.isBuiltin ? " (custom)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contracts</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={contracts}
            onChange={(e) => onContractsChange(e.target.value)}
            className="bg-background font-mono h-9"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Stop, in points</Label>
        <Input
          type="number"
          min={0}
          step="any"
          value={stopPoints}
          onChange={(e) => onStopPointsChange(e.target.value)}
          className="bg-background font-mono h-9"
          disabled={disabled}
          placeholder={spec ? `e.g. ${spec.tickSize * 4}` : "Select an instrument first"}
        />
        {spec && ticks != null && (
          <p className="text-[11px] text-muted-foreground">
            = {ticks} tick{ticks === 1 ? "" : "s"}
            {roundedAway && echoedPoints != null && ` (rounded to ${echoedPoints} pts)`}
          </p>
        )}
      </div>

      {riskPerTrade != null && (
        <p className="text-[11px] text-muted-foreground">
          Risk per trade:{" "}
          <span className="font-mono text-[var(--text)]">
            ${riskPerTrade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
      )}
    </div>
  )
}
