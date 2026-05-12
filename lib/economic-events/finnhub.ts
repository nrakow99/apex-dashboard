import { formatInTimeZone, toDate } from "date-fns-tz"
import { createHash } from "node:crypto"
import type { EconomicEventsProvider } from "./provider"
import type { EconomicEvent } from "./types"
import { formatMetricDisplay, inferImpactLevel } from "./utils"

const FINNHUB_BASE = "https://finnhub.io/api/v1"

type FinnhubCalendarRow = {
  actual?: number | string | null
  estimate?: number | string | null
  prev?: number | string | null
  previous?: number | string | null
  time?: string
  country?: string
  event?: string
  impact?: string
  currency?: string
  unit?: string
}

type FinnhubCalendarResponse = {
  economicCalendar?: FinnhubCalendarRow[]
  /** Some proxies/docs use snake_case */
  economic_calendar?: FinnhubCalendarRow[]
}

const NY = "America/New_York"

function stableId(parts: string): string {
  return createHash("sha256").update(parts).digest("hex").slice(0, 16)
}

/** Parse Finnhub time into UTC instant; fallback noon NY on date-only. */
function parseEventInstant(row: FinnhubCalendarRow): Date | null {
  const t = row.time?.trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}T/.test(t) || t.endsWith("Z")) {
    const d = new Date(t)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = toDate(`${t} 12:00:00`, { timeZone: NY })
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(t)) {
    const d = toDate(t, { timeZone: NY })
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function nyDateString(d: Date): string {
  return formatInTimeZone(d, NY, "yyyy-MM-dd")
}

function nyTimeLabel(d: Date): string {
  return formatInTimeZone(d, NY, "HH:mm")
}

function normalizeRow(row: FinnhubCalendarRow, index: number, from: string): EconomicEvent | null {
  const title = (row.event ?? "").trim() || "Economic release"
  const country = (row.country ?? "").trim() || "ZZ"
  const currency = row.currency?.trim() || null

  let instant = parseEventInstant(row)
  if (!instant) {
    const day =
      row.time && /^\d{4}-\d{2}-\d{2}/.test(row.time) ? row.time.slice(0, 10) : from
    instant = toDate(`${day} 12:00:00`, { timeZone: NY })
  }
  if (Number.isNaN(instant.getTime())) return null

  const date = nyDateString(instant)
  const time = nyTimeLabel(instant)
  const impact = inferImpactLevel(row.impact, title, country, currency)

  const id = `finnhub-${stableId(`${date}|${time}|${title}|${country}|${index}`)}`

  return {
    id,
    date,
    time: /^\d{4}-\d{2}-\d{2}$/.test((row.time ?? "").trim()) ? null : time,
    datetime: instant.toISOString(),
    country,
    currency,
    title,
    impact,
    forecast: formatMetricDisplay(row.estimate ?? null),
    previous: formatMetricDisplay(row.prev ?? row.previous ?? null),
    actual: formatMetricDisplay(row.actual ?? null),
    source: "finnhub",
  }
}

export function createFinnhubEconomicEventsProvider(apiKey?: string): EconomicEventsProvider {
  const key = apiKey ?? process.env.FINNHUB_API_KEY

  return {
    async fetchEvents(from: string, to: string): Promise<EconomicEvent[]> {
      if (!key?.trim()) return []

      const url = new URL(`${FINNHUB_BASE}/calendar/economic`)
      url.searchParams.set("from", from)
      url.searchParams.set("to", to)
      url.searchParams.set("token", key.trim())

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 600 },
      })

      if (!res.ok) return []

      const json = (await res.json()) as FinnhubCalendarResponse
      const rows = json.economicCalendar ?? json.economic_calendar ?? []
      const out: EconomicEvent[] = []
      let i = 0
      for (const row of rows) {
        const ev = normalizeRow(row, i, from)
        if (ev) {
          if (ev.date >= from && ev.date <= to) out.push(ev)
        }
        i += 1
      }
      return out
    },
  }
}
