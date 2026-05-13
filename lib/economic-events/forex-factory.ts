import { createHash } from "node:crypto"
import { formatInTimeZone, toDate } from "date-fns-tz"
import { enrichEconomicEvent } from "./enrich"
import type { EconomicEventsProvider, EconomicEventsProviderDiagnostics } from "./provider"
import type { EconomicEvent, EconomicImpactLevel } from "./types"
import { formatMetricDisplay, inferImpactLevel } from "./utils"
import { isUsdEvent } from "./analytics"

const NY = "America/New_York"
const RAPIDAPI_DEFAULT_URL =
  "https://ultimate-economic-calendar.p.rapidapi.com/economic-events/tradingview"
const RAPIDAPI_DEFAULT_HOST = "ultimate-economic-calendar.p.rapidapi.com"
const RAPIDAPI_COUNTRIES = "US"

type ForexFactoryLikeRow = Record<string, unknown>
type ParsedEventInstant = {
  instant: Date
  hasSpecificTime: boolean
  marketDatetime: string
}

type SkipReason =
  | "missing_date"
  | "invalid_date"
  | "missing_title"
  | "missing_currency"
  | "unknown"

type NormalizationResult =
  | { event: EconomicEvent; reason?: never }
  | { event?: never; reason: SkipReason }

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

function rawTypeOf(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function topLevelKeysOf(value: unknown): string[] | null {
  const record = asRecord(value)
  return record ? Object.keys(record).slice(0, 50) : null
}

function firstArrayItemFrom(value: unknown): unknown {
  if (Array.isArray(value)) return value[0] ?? null

  const record = asRecord(value)
  if (!record) return null

  for (const item of Object.values(record)) {
    if (Array.isArray(item)) return item[0] ?? null
  }

  for (const item of Object.values(record)) {
    const nested = asRecord(item)
    if (!nested) continue
    for (const nestedItem of Object.values(nested)) {
      if (Array.isArray(nestedItem)) return nestedItem[0] ?? null
    }
  }

  return null
}

function rawLengthOf(value: unknown): number | null {
  if (Array.isArray(value)) return value.length

  const record = asRecord(value)
  if (!record) return null

  for (const item of Object.values(record)) {
    if (Array.isArray(item)) return item.length
  }

  for (const item of Object.values(record)) {
    const nested = asRecord(item)
    if (!nested) continue
    for (const nestedItem of Object.values(nested)) {
      if (Array.isArray(nestedItem)) return nestedItem.length
    }
  }

  return null
}

function compactDebugValue(value: unknown): unknown {
  if (value === null || value === undefined) return null

  const json = JSON.stringify(value)
  if (!json) return null
  if (json.length <= 4000) return value

  return {
    truncated: true,
    preview: json.slice(0, 4000),
  }
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

function readRequiredString(row: ForexFactoryLikeRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
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
  const importance = row.importance
  const numericImportance =
    typeof importance === "number"
      ? importance
      : typeof importance === "string"
        ? Number(importance)
        : Number.NaN

  if (Number.isFinite(numericImportance)) {
    if (numericImportance >= 2) return "high"
    if (numericImportance === 1) return "medium"
    return "low"
  }

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

function parseIsoInstant(raw: string): ParsedEventInstant | null {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null

  return {
    instant: d,
    hasSpecificTime: true,
    marketDatetime: formatInTimeZone(d, NY, "yyyy-MM-dd HH:mm:ss"),
  }
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

  const providerDate = readString(row, ["date"])
  if (providerDate && /^\d{4}-\d{2}-\d{2}T/.test(providerDate)) {
    const parsed = parseIsoInstant(providerDate)
    if (parsed) return parsed
  }

  const datetime = readString(row, ["datetime", "dateTime", "date_time", "iso", "utc", "date"])
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

function normalizeRow(row: ForexFactoryLikeRow, index: number, from: string): NormalizationResult {
  // Field aliases are intentionally centralized so the provider can be adapted
  // quickly once the exact third-party response shape is known.
  const title = readRequiredString(row, ["indicator", "title"])
  if (!title) return { reason: "missing_title" }

  const rawDate = readString(row, ["date", "datetime", "dateTime", "date_time", "iso", "utc", "timestamp", "unix", "epoch"])
  if (!rawDate) return { reason: "missing_date" }

  const rawCurrency = readString(row, ["currency", "ccy", "symbol"])?.toUpperCase() ?? null
  const country = readString(row, ["country", "countryCode", "country_code"]) ?? (rawCurrency === "USD" ? "US" : rawCurrency ?? "ZZ")
  const currency = rawCurrency ?? (isUsdEvent({ currency: rawCurrency, country, title }) ? "USD" : null)
  const parsed = parseEventInstant(row, from)
  if (!parsed) return { reason: "invalid_date" }

  const { instant, hasSpecificTime, marketDatetime } = parsed
  const date = nyDateString(instant)
  const time = nyTimeLabel(instant)
  const impact = readImpact(row, title, country, currency)
  const rawId = readString(row, ["id", "eventId", "event_id", "calendarId", "calendar_id"])
  const id = rawId
    ? `forex_factory-${rawId}`
    : `forex_factory-${stableId(`${date}|${time}|${title}|${country}|${currency ?? ""}|${index}`)}`

  try {
    return {
      event: enrichEconomicEvent({
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
      }),
    }
  } catch {
    return { reason: "unknown" }
  }
}

function buildUrl(baseUrl: string, from: string, to: string): URL {
  const url = new URL(baseUrl)
  url.search = ""
  url.searchParams.set("from", from)
  url.searchParams.set("to", to)
  url.searchParams.set("countries", RAPIDAPI_COUNTRIES)
  return url
}

export function createForexFactoryEconomicEventsProvider(
  apiKey?: string,
  apiUrl?: string,
  defaultRevalidateSeconds = 600,
): EconomicEventsProvider {
  const key = apiKey ?? process.env.FOREX_FACTORY_API_KEY
  const baseUrl = apiUrl ?? process.env.FOREX_FACTORY_API_URL ?? RAPIDAPI_DEFAULT_URL
  const configuredHost = process.env.FOREX_FACTORY_API_HOST
  let diagnostics: EconomicEventsProviderDiagnostics = {
    rawCount: null,
    normalizedCount: null,
    statusCode: null,
    requestHost: null,
    requestPath: null,
    requestCountries: null,
    requestQuery: null,
    authHeaderPresent: null,
    rapidApiKeyLength: null,
    rawType: null,
    topLevelKeys: null,
    rawLength: null,
    sampleItem: null,
    normalizedEventSample: null,
    normalizedCountBeforeFiltering: null,
    normalizedUsdCount: null,
    normalizedHighImpactCount: null,
    normalizedRedFolderCount: null,
    normalizedEventTitlesSample: null,
    highImpactTitlesSample: null,
    redFolderTitlesSample: null,
    skippedMissingDate: null,
    skippedInvalidDate: null,
    skippedMissingTitle: null,
    skippedMissingCurrency: null,
    skippedUnknownReason: null,
    skippedEventSamples: null,
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
        requestHost: null,
        requestPath: null,
        requestCountries: null,
        requestQuery: null,
        authHeaderPresent: null,
        rapidApiKeyLength: key?.trim().length ?? 0,
        rawType: null,
        topLevelKeys: null,
        rawLength: null,
        sampleItem: null,
        normalizedEventSample: null,
        normalizedCountBeforeFiltering: null,
        normalizedUsdCount: null,
        normalizedHighImpactCount: null,
        normalizedRedFolderCount: null,
        normalizedEventTitlesSample: null,
        highImpactTitlesSample: null,
        redFolderTitlesSample: null,
        skippedMissingDate: 0,
        skippedInvalidDate: 0,
        skippedMissingTitle: 0,
        skippedMissingCurrency: 0,
        skippedUnknownReason: 0,
        skippedEventSamples: [],
      }

      if (!baseUrl?.trim()) {
        throw new Error("FOREX_FACTORY_API_URL is not configured")
      }

      const requestUrl = buildUrl(baseUrl.trim(), from, to)
      const requestHost = configuredHost?.trim() || requestUrl.host
      const trimmedKey = key?.trim()
      diagnostics.requestHost = requestHost
      diagnostics.requestPath = requestUrl.pathname
      diagnostics.requestCountries = requestUrl.searchParams.get("countries")
      diagnostics.requestQuery = requestUrl.searchParams.toString()
      diagnostics.authHeaderPresent = Boolean(trimmedKey)
      diagnostics.rapidApiKeyLength = trimmedKey?.length ?? 0

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-rapidapi-host": requestHost,
        "x-rapidapi-key": trimmedKey ?? "",
      }

      const res = await fetch(requestUrl.toString(), {
        headers,
        next: { revalidate: revalidateSeconds ?? defaultRevalidateSeconds },
      })
      diagnostics.statusCode = res.status

      if (!res.ok) throw new Error(`ForexFactory-style provider failed: ${res.status}`)

      const json = (await res.json()) as unknown
      diagnostics.rawType = rawTypeOf(json)
      diagnostics.topLevelKeys = topLevelKeysOf(json)
      diagnostics.rawLength = rawLengthOf(json)
      diagnostics.sampleItem = compactDebugValue(firstArrayItemFrom(json))

      console.info("[economic-events] forex_factory raw", {
        rawType: diagnostics.rawType,
        topLevelKeys: diagnostics.topLevelKeys,
        rawLength: diagnostics.rawLength,
        sampleItem: diagnostics.sampleItem,
        requestQuery: diagnostics.requestQuery,
      })

      const rows = rowsFromResponse(json)
      diagnostics.rawCount = rows.length
      const normalizedBeforeFiltering: EconomicEvent[] = []
      const out: EconomicEvent[] = []
      const skippedEventSamples: unknown[] = []
      let i = 0
      for (const row of rows) {
        const result = normalizeRow(row, i, from)
        if (result.event) {
          normalizedBeforeFiltering.push(result.event)
          if (result.event.date >= from && result.event.date <= to) out.push(result.event)
        } else {
          if (result.reason === "missing_date") {
            diagnostics.skippedMissingDate = (diagnostics.skippedMissingDate ?? 0) + 1
          } else if (result.reason === "invalid_date") {
            diagnostics.skippedInvalidDate = (diagnostics.skippedInvalidDate ?? 0) + 1
          } else if (result.reason === "missing_title") {
            diagnostics.skippedMissingTitle = (diagnostics.skippedMissingTitle ?? 0) + 1
          } else if (result.reason === "missing_currency") {
            diagnostics.skippedMissingCurrency = (diagnostics.skippedMissingCurrency ?? 0) + 1
          } else {
            diagnostics.skippedUnknownReason = (diagnostics.skippedUnknownReason ?? 0) + 1
          }

          if (skippedEventSamples.length < 10) {
            skippedEventSamples.push(
              compactDebugValue({
                reason: result.reason,
                row,
              }),
            )
          }
        }
        i += 1
      }
      diagnostics.skippedEventSamples = skippedEventSamples
      diagnostics.normalizedCountBeforeFiltering = normalizedBeforeFiltering.length
      diagnostics.normalizedUsdCount = normalizedBeforeFiltering.filter((e) => e.currency === "USD").length
      diagnostics.normalizedHighImpactCount = normalizedBeforeFiltering.filter((e) => e.impact === "high").length
      diagnostics.normalizedRedFolderCount = normalizedBeforeFiltering.filter((e) => e.isRedFolder).length
      diagnostics.normalizedEventTitlesSample = normalizedBeforeFiltering.slice(0, 20).map((e) => e.title)
      diagnostics.highImpactTitlesSample = normalizedBeforeFiltering
        .filter((e) => e.impact === "high")
        .slice(0, 20)
        .map((e) => e.title)
      diagnostics.redFolderTitlesSample = normalizedBeforeFiltering
        .filter((e) => e.isRedFolder)
        .slice(0, 20)
        .map((e) => e.title)
      diagnostics.normalizedCount = out.length
      diagnostics.normalizedEventSample = compactDebugValue(out[0] ?? null)
      console.info("[economic-events] forex_factory", {
        rawEvents: rows.length,
        normalizedEventsBeforeFiltering: diagnostics.normalizedCountBeforeFiltering,
        normalizedEvents: out.length,
        normalizedUsdEvents: diagnostics.normalizedUsdCount,
        normalizedHighImpactEvents: diagnostics.normalizedHighImpactCount,
        normalizedRedFolderEvents: diagnostics.normalizedRedFolderCount,
        normalizedEventTitlesSample: diagnostics.normalizedEventTitlesSample,
        highImpactTitlesSample: diagnostics.highImpactTitlesSample,
        redFolderTitlesSample: diagnostics.redFolderTitlesSample,
        skippedMissingDate: diagnostics.skippedMissingDate,
        skippedInvalidDate: diagnostics.skippedInvalidDate,
        skippedMissingTitle: diagnostics.skippedMissingTitle,
        skippedMissingCurrency: diagnostics.skippedMissingCurrency,
        skippedUnknownReason: diagnostics.skippedUnknownReason,
        skippedEventSamples: diagnostics.skippedEventSamples,
        normalizedEventSample: diagnostics.normalizedEventSample,
        usdRedFolderEvents: out.filter((e) => e.currency === "USD" && e.impact === "high" && e.isRedFolder).length,
      })
      return out
    },
  }
}
