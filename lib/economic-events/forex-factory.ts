import { createHash } from "node:crypto"
import { formatInTimeZone, toDate } from "date-fns-tz"
import { enrichEconomicEvent } from "./enrich"
import type { EconomicEventsProvider, EconomicEventsProviderDiagnostics } from "./provider"
import type { EconomicEvent, EconomicImpactLevel } from "./types"
import { formatMetricDisplay, inferImpactLevel } from "./utils"
import { isUsdEvent } from "./analytics"

const NY = "America/New_York"

type ForexFactoryLikeRow = Record<string, unknown>
type ParsedEventInstant = {
  instant: Date
  hasSpecificTime: boolean
  marketDatetime: string
}

function stableId(parts: string): string {
  return createHash("sha256").update(parts).digest("hex").slice(0, 16)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function isRecord(value: unknown): value is ForexFactoryLikeRow {
  return Boolean(asRecord(value))
}

function readString(row: ForexFactoryLikeRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function readMetric(row: ForexFactoryLikeRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = formatMetricDisplay(row[key] as string | number | null | undefined)
    if (value) return value
  }
  return null
}

function readTimestamp(row: ForexFactoryLikeRow): Date | null {
  const raw = row.timestamp ?? row.unix ?? row.epoch
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null
  const ms = raw > 1_000_000_000_000 ? raw : raw * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

function readTimezone(row: ForexFactoryLikeRow): string {
  const raw = readString(row, ["timezone", "timeZone", "tz", "timezoneName", "timezone_name"])
  if (!raw) return NY

  const normalized = raw.trim()
  const lower = normalized.toLowerCase()
  if (normalized === "UTC" || normalized === "Etc/UTC") return "UTC"
  if (normalized.includes("/") && /^[A-Za-z_]+\/[A-Za-z_/-]+$/.test(normalized)) return normalized
  if (["et", "est", "edt", "eastern", "eastern time", "america/new_york"].includes(lower)) return NY
  return NY
}

function readImpact(row: ForexFactoryLikeRow, title: string, country: string, currency: string | null): EconomicImpactLevel {
  const rawImpact = readString(row, ["impact", "importance", "priority", "folder", "severity"])
  return inferImpactLevel(rawImpact ?? undefined, title, country, currency)
}

function normalizeDateString(raw: string | null, from: string): string | null {
  if (!raw) return null
  const s = raw.trim().replace(/,/g, "")
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slash) {
    const [, mm, dd, yyyy] = slash
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy
    return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
  }

  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (dash) {
    const [, mm, dd, yyyy] = dash
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy
    return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
  }

  const year = from.slice(0, 4)
  const withYear = /\b\d{4}\b/.test(s) ? s : `${s} ${year}`
  const parsed = new Date(`${withYear} 12:00:00 UTC`)
  if (Number.isNaN(parsed.getTime())) return null

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`
}

function normalizeTimeString(raw: string | null): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (!s || /tentative|all\s*day|day\s*\d+|holiday/.test(s)) return null

  const match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i)
  if (!match) return null

  let hour = Number(match[1])
  const minute = Number(match[2] ?? "0")
  const meridiem = match[3]?.replace(/\./g, "")

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null
  if (meridiem === "pm" && hour < 12) hour += 12
  if (meridiem === "am" && hour === 12) hour = 0
  if (hour > 23) return null

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
}

function parseEventInstant(row: ForexFactoryLikeRow, from: string): ParsedEventInstant | null {
  const timestamp = readTimestamp(row)
  if (timestamp) {
    return {
      instant: timestamp,
      hasSpecificTime: true,
      marketDatetime: formatInTimeZone(timestamp, NY, "yyyy-MM-dd HH:mm:ss"),
    }
  }

  const timezone = readTimezone(row)

  const datetime = readString(row, ["datetime", "dateTime", "date_time", "iso", "utc"])
  if (datetime) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(datetime)) {
      const d = toDate(`${datetime} 12:00:00`, { timeZone: NY })
      return Number.isNaN(d.getTime())
        ? null
        : { instant: d, hasSpecificTime: false, marketDatetime: `${datetime} 12:00:00` }
    }

    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(datetime)) {
      const d = new Date(datetime)
      return Number.isNaN(d.getTime())
        ? null
        : {
            instant: d,
            hasSpecificTime: true,
            marketDatetime: formatInTimeZone(d, NY, "yyyy-MM-dd HH:mm:ss"),
          }
    }

    const marketDatetime = datetime.replace("T", " ")
    const d = toDate(marketDatetime, { timeZone: timezone })
    if (!Number.isNaN(d.getTime())) {
      return {
        instant: d,
        hasSpecificTime: true,
        marketDatetime: formatInTimeZone(d, NY, "yyyy-MM-dd HH:mm:ss"),
      }
    }
  }

  const date =
    normalizeDateString(readString(row, ["date", "day", "calendarDate", "eventDate", "releaseDate", "release_date"]), from) ??
    from
  const time = normalizeTimeString(readString(row, ["time", "eventTime", "releaseTime", "release_time"]))
  const hasSpecificTime = Boolean(time)
  const marketDatetime = `${date} ${time ?? "12:00:00"}`
  const d = toDate(marketDatetime, { timeZone: timezone })

  return Number.isNaN(d.getTime()) ? null : { instant: d, hasSpecificTime, marketDatetime }
}

function nyDateString(d: Date): string {
  return formatInTimeZone(d, NY, "yyyy-MM-dd")
}

function nyTimeLabel(d: Date): string {
  return formatInTimeZone(d, NY, "HH:mm")
}

function rowsFromResponse(json: unknown): ForexFactoryLikeRow[] {
  if (Array.isArray(json)) return json.filter(isRecord)

  const root = asRecord(json)
  if (!root) return []

  // Provider-specific response mapping lives here. Adjust these keys first after
  // inspecting the chosen ForexFactory-style API payload.
  const candidates = [
    root.events,
    root.data,
    root.items,
    root.calendar,
    root.economicCalendar,
    root.economic_calendar,
    root.results,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord)
    const nested = asRecord(candidate)
    if (nested) {
      for (const key of ["events", "items", "calendar", "economicCalendar", "economic_calendar"]) {
        const value = nested[key]
        if (Array.isArray(value)) return value.filter(isRecord)
      }
    }
  }

  return []
}

function normalizeRow(row: ForexFactoryLikeRow, index: number, from: string): EconomicEvent | null {
  // Field aliases are intentionally centralized so the provider can be adapted
  // quickly once the exact third-party response shape is known.
  const title = readString(row, ["title", "event", "name", "description"]) ?? "Economic release"
  const rawCurrency = readString(row, ["currency", "ccy", "symbol"])?.toUpperCase() ?? null
  const country = readString(row, ["country", "countryCode", "country_code"]) ?? (rawCurrency === "USD" ? "US" : rawCurrency ?? "ZZ")
  const currency = rawCurrency ?? (isUsdEvent({ currency: rawCurrency, country, title }) ? "USD" : null)
  const parsed = parseEventInstant(row, from)
  if (!parsed) return null

  const { instant, hasSpecificTime, marketDatetime } = parsed
  const date = nyDateString(instant)
  const time = nyTimeLabel(instant)
  const impact = readImpact(row, title, country, currency)
  const rawId = readString(row, ["id", "eventId", "event_id", "calendarId", "calendar_id"])
  const id = rawId
    ? `forex_factory-${rawId}`
    : `forex_factory-${stableId(`${date}|${time}|${title}|${country}|${currency ?? ""}|${index}`)}`

  return enrichEconomicEvent({
    id,
    date,
    time: hasSpecificTime ? time : null,
    datetime: instant.toISOString(),
    marketDatetime,
    country,
    currency,
    title,
    impact,
    forecast: readMetric(row, ["forecast", "consensus", "estimate", "expected"]),
    previous: readMetric(row, ["previous", "prev", "prior"]),
    actual: readMetric(row, ["actual", "result"]),
    source: "forex_factory",
  })
}

function buildUrl(baseUrl: string, from: string, to: string): string {
  const url = new URL(baseUrl)
  if (!url.searchParams.has("from") && !url.searchParams.has("start")) url.searchParams.set("from", from)
  if (!url.searchParams.has("to") && !url.searchParams.has("end")) url.searchParams.set("to", to)
  return url.toString()
}

export function createForexFactoryEconomicEventsProvider(
  apiKey?: string,
  apiUrl?: string,
  defaultRevalidateSeconds = 600,
): EconomicEventsProvider {
  const key = apiKey ?? process.env.FOREX_FACTORY_API_KEY
  const baseUrl = apiUrl ?? process.env.FOREX_FACTORY_API_URL
  let diagnostics: EconomicEventsProviderDiagnostics = {
    rawCount: null,
    normalizedCount: null,
    statusCode: null,
  }

  return {
    getDiagnostics() {
      return diagnostics
    },
    async fetchEvents(from: string, to: string, revalidateSeconds?: number): Promise<EconomicEvent[]> {
      diagnostics = {
        rawCount: null,
        normalizedCount: null,
        statusCode: null,
      }

      if (!baseUrl?.trim()) {
        throw new Error("FOREX_FACTORY_API_URL is not configured")
      }

      const headers: Record<string, string> = { Accept: "application/json" }
      if (key?.trim()) {
        headers["X-API-Key"] = key.trim()
        headers.Authorization = `Bearer ${key.trim()}`
      }

      const res = await fetch(buildUrl(baseUrl.trim(), from, to), {
        headers,
        next: { revalidate: revalidateSeconds ?? defaultRevalidateSeconds },
      })
      diagnostics.statusCode = res.status

      if (!res.ok) throw new Error(`ForexFactory-style provider failed: ${res.status}`)

      const json = (await res.json()) as unknown
      const rows = rowsFromResponse(json)
      diagnostics.rawCount = rows.length
      const out: EconomicEvent[] = []
      let i = 0
      for (const row of rows) {
        const ev = normalizeRow(row, i, from)
        if (ev && ev.date >= from && ev.date <= to) out.push(ev)
        i += 1
      }
      diagnostics.normalizedCount = out.length
      console.info("[economic-events] forex_factory", {
        rawEvents: rows.length,
        normalizedEvents: out.length,
        usdRedFolderEvents: out.filter((e) => e.currency === "USD" && e.impact === "high" && e.isRedFolder).length,
      })
      return out
    },
  }
}
