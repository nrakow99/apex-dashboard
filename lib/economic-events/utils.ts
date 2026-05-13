import type {
  EconomicEvent,
  EconomicImpactLevel,
  EconomicEventImpactDisplay,
  CalendarEventDisplay,
  EventsViewFilter,
} from "./types"
import { isUsdEvent } from "./analytics"

const HIGH_US_KEYWORDS =
  /\b(cpi|ppi|pce|nfp|non[- ]farm|payrolls|fomc|fed funds|interest rate decision|unemployment|jobless|gdp|retail sales|ism|pmi)\b/i

export function impactLevelToDisplay(level: EconomicImpactLevel): EconomicEventImpactDisplay {
  if (level === "high") return "High"
  if (level === "medium") return "Medium"
  return "Low"
}

export function inferImpactLevel(
  rawImpact: string | undefined,
  title: string,
  country: string,
  currency?: string | null,
): EconomicImpactLevel {
  const r = rawImpact?.toLowerCase().trim()
  if (r === "high" || r === "h") return "high"
  if (r === "medium" || r === "m") return "medium"
  if (r === "low" || r === "l") return "low"

  const t = title.toLowerCase()
  const us =
    country?.toUpperCase() === "US" ||
    country?.toLowerCase() === "united states" ||
    currency === "USD"

  if (us && HIGH_US_KEYWORDS.test(t)) return "high"
  if (HIGH_US_KEYWORDS.test(t)) return "medium"
  if (us && (t.includes("fed") || t.includes("treasury") || t.includes("housing"))) return "medium"
  return "low"
}

export function formatMetricDisplay(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  const s = String(v).trim()
  return s.length ? s : null
}

/** ISO instant → local wall-clock label for dashboard display. */
export function formatEventTimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

export function filterEconomicEventsForView(
  events: EconomicEvent[],
  filter: EventsViewFilter,
): EconomicEvent[] {
  switch (filter) {
    case "usd":
      return events.filter((e) => e.currency === "USD")
    case "high":
      return events.filter((e) => e.impact === "high")
    case "red-folder":
      return events.filter((e) => isUsdEvent(e) && e.impact === "high" && e.isRedFolder)
    default:
      return events
  }
}

export function toCalendarEventDisplay(ev: EconomicEvent): CalendarEventDisplay {
  const impact = impactLevelToDisplay(ev.impact)
  const us = isUsdEvent(ev)
  const isUsdHigh = us && ev.impact === "high"

  return {
    id: ev.id,
    time: formatEventTimeLocal(ev.datetime),
    name: ev.title,
    impact,
    forecast: formatMetricDisplay(ev.forecast),
    previous: formatMetricDisplay(ev.previous),
    actual: formatMetricDisplay(ev.actual),
    country: ev.country,
    currency: ev.currency ?? null,
    datetime: ev.datetime,
    isUsdHigh,
    severityScore: ev.severityScore,
    sessionLabel: ev.sessionLabel,
    category: ev.category,
    isRedFolder: ev.isRedFolder,
  }
}

export function buildCalendarEventsByDate(events: EconomicEvent[]): Map<string, CalendarEventDisplay[]> {
  const map = new Map<string, CalendarEventDisplay[]>()
  for (const e of events) {
    const row = toCalendarEventDisplay(e)
    const list = map.get(e.date) ?? []
    list.push(row)
    map.set(e.date, list)
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore
      return a.datetime.localeCompare(b.datetime)
    })
  }
  return map
}

export function maxImpactForDay(events: CalendarEventDisplay[]): EconomicEventImpactDisplay | null {
  if (events.length === 0) return null
  if (events.some((e) => e.impact === "High")) return "High"
  if (events.some((e) => e.impact === "Medium")) return "Medium"
  return "Low"
}

/** Primary sort: severity (analytics), then impact band, USD-high macro, time. */
export function sortCalendarEventsDisplay(events: CalendarEventDisplay[]): CalendarEventDisplay[] {
  const rank: Record<EconomicEventImpactDisplay, number> = { High: 0, Medium: 1, Low: 2 }
  return [...events].sort((a, b) => {
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore
    const ir = rank[a.impact] - rank[b.impact]
    if (ir !== 0) return ir
    const us = (x: CalendarEventDisplay) => (x.isUsdHigh ? 0 : 1)
    if (us(a) !== us(b)) return us(a) - us(b)
    return a.datetime.localeCompare(b.datetime)
  })
}

/** @deprecated use sortCalendarEventsDisplay */
export const sortCalendarEventsByImpactThenTime = sortCalendarEventsDisplay
