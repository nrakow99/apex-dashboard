import { formatInTimeZone } from "date-fns-tz"
import type { EconomicSessionBucket } from "./types"

const NY = "America/New_York"

const LABELS: Record<EconomicSessionBucket, string> = {
  overnight: "Overnight",
  "pre-ny-open": "Pre-NY Open",
  "ny-open": "NY Open",
  "ny-am": "NY AM",
  lunch: "Lunch",
  "power-hour": "Power Hour",
  "after-close": "After Close",
}

/** Minutes from midnight in America/New_York for the given instant. */
function nyMinutesFromMidnight(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 0
  const h = Number(formatInTimeZone(d, NY, "H"))
  const m = Number(formatInTimeZone(d, NY, "m"))
  return h * 60 + m
}

export function getNySessionBucket(iso: string): EconomicSessionBucket {
  const mins = nyMinutesFromMidnight(iso)
  if (mins >= 18 * 60 || mins < 8 * 60) return "overnight"
  if (mins < 9 * 60 + 30) return "pre-ny-open"
  if (mins < 10 * 60) return "ny-open"
  if (mins < 12 * 60) return "ny-am"
  if (mins < 13 * 60) return "lunch"
  if (mins < 15 * 60) return "ny-am"
  if (mins < 16 * 60) return "power-hour"
  if (mins < 18 * 60) return "after-close"
  return "overnight"
}

export function getNySessionDisplayLabel(iso: string): string {
  return LABELS[getNySessionBucket(iso)]
}
