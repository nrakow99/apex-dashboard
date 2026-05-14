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
const DEBUG_BUILD_ID = "fetch-debug-v3"
const PROVIDER_FILE_PATH = "lib/economic-events/forex-factory.ts"
const FIVE_MINUTES_MS = 5 * 60 * 1000
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

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

type CacheEntry = {
  events: EconomicEvent[]
  fetchedAt: number
  expiresAt: number
  diagnostics: EconomicEventsProviderDiagnostics
}

const responseCache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<EconomicEvent[]>>()
const lastRapidApiFetchAt = new Map<string, number>()

function stableId(parts: string): string {
  return createHash("sha256").update(parts).digest("hex").slice(0, 16)
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function cacheTtlMs(from: string, to: string, now = new Date()): number {
  const today = localDateString(now)
  const weekEnd = localDateString(addDays(now, 7))
  const overlapsTodayOrWeek = from <= weekEnd && to >= today
  return overlapsTodayOrWeek ? SIX_HOURS_MS : TWENTY_FOUR_HOURS_MS
}

function cacheKey(from: string, to: string, countries: string | null): string {
  return `${from}|${to}|${countries ?? ""}`
}

function cacheAgeSeconds(entry: CacheEntry, now = Date.now()): number {
  return Math.max(0, Math.floor((now - entry.fetchedAt) / 1000))
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
  const configuredUrl = apiUrl ?? process.env.FOREX_FACTORY_API_URL
  const configuredHost = process.env.FOREX_FACTORY_API_HOST
  let diagnostics: EconomicEventsProviderDiagnostics = {
    debugBuildId: DEBUG_BUILD_ID,
    providerFilePath: PROVIDER_FILE_PATH,
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
    normalizationLoopIterations: null,
    normalizationLoopSuccessfulReturns: null,
    normalizationLoopNullReturns: null,
    cacheHit: null,
    cacheAgeSeconds: null,
    providerRateLimited: null,
    fetchErrorName: null,
    fetchErrorMessage: null,
    fetchErrorStackFirstLine: null,
    resolvedRequestUrl: null,
    errorBody: null,
  }

  return {
    getDiagnostics() {
      return diagnostics
    },
    async fetchEvents(from: string, to: string, revalidateSeconds?: number): Promise<EconomicEvent[]> {
      console.info("FOREX_FACTORY_PROVIDER_EXECUTED", {
        debugBuildId: DEBUG_BUILD_ID,
        providerFilePath: PROVIDER_FILE_PATH,
        from,
        to,
      })

      diagnostics = {
        debugBuildId: DEBUG_BUILD_ID,
        providerFilePath: PROVIDER_FILE_PATH,
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
        normalizationLoopIterations: 0,
        normalizationLoopSuccessfulReturns: 0,
        normalizationLoopNullReturns: 0,
        cacheHit: false,
        cacheAgeSeconds: null,
        providerRateLimited: false,
        fetchErrorName: null,
        fetchErrorMessage: null,
        fetchErrorStackFirstLine: null,
        resolvedRequestUrl: null,
        errorBody: null,
      }

      void configuredUrl
      const requestUrl = buildUrl(RAPIDAPI_DEFAULT_URL, from, to)
      const requestHost = configuredHost?.trim() || requestUrl.host
      const trimmedKey = key?.trim()
      diagnostics.resolvedRequestUrl = requestUrl.toString()
      diagnostics.requestHost = requestHost
      diagnostics.requestPath = requestUrl.pathname
      diagnostics.requestCountries = requestUrl.searchParams.get("countries")
      diagnostics.requestQuery = requestUrl.searchParams.toString()
      diagnostics.authHeaderPresent = Boolean(trimmedKey)
      diagnostics.rapidApiKeyLength = trimmedKey?.length ?? 0
      const key = cacheKey(from, to, diagnostics.requestCountries)
      const now = Date.now()
      const cached = responseCache.get(key)

      if (cached && cached.expiresAt > now) {
        diagnostics = {
          ...diagnostics,
          ...cached.diagnostics,
          cacheHit: true,
          cacheAgeSeconds: cacheAgeSeconds(cached, now),
          providerRateLimited: false,
        }
        return cached.events
      }

      const inFlight = inFlightRequests.get(key)
      if (inFlight) {
        const events = await inFlight
        const updatedCache = responseCache.get(key)
        if (updatedCache) {
          diagnostics = {
            ...diagnostics,
            ...updatedCache.diagnostics,
            cacheHit: true,
            cacheAgeSeconds: cacheAgeSeconds(updatedCache),
            providerRateLimited: false,
          }
        }
        return events
      }

      const lastFetchAt = lastRapidApiFetchAt.get(key)
      if (lastFetchAt && now - lastFetchAt < FIVE_MINUTES_MS) {
        if (cached) {
          diagnostics = {
            ...diagnostics,
            ...cached.diagnostics,
            cacheHit: true,
            cacheAgeSeconds: cacheAgeSeconds(cached, now),
            providerRateLimited: false,
          }
          return cached.events
        }

        diagnostics.cacheHit = false
        diagnostics.cacheAgeSeconds = null
        diagnostics.providerRateLimited = false
        return []
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-rapidapi-host": requestHost,
        "x-rapidapi-key": trimmedKey ?? "",
      }

      const fetchPromise = (async () => {
      lastRapidApiFetchAt.set(key, Date.now())
      const ttlMs = cacheTtlMs(from, to)
      let res: Response
      try {
        console.info("FOREX_FACTORY_FETCH_START", {
          debugBuildId: DEBUG_BUILD_ID,
          providerFilePath: PROVIDER_FILE_PATH,
          resolvedRequestUrl: diagnostics.resolvedRequestUrl,
          requestHost,
          requestPath: diagnostics.requestPath,
          requestCountries: diagnostics.requestCountries,
        })
        res = await fetch(requestUrl.toString(), {
          headers,
          next: { revalidate: Math.ceil(ttlMs / 1000) },
        })
      } catch (error) {
        diagnostics.fetchErrorName = error instanceof Error ? error.name : typeof error
        diagnostics.fetchErrorMessage = error instanceof Error ? error.message : String(error)
        diagnostics.fetchErrorStackFirstLine =
          error instanceof Error ? (error.stack?.split("\n")[0] ?? null) : null
        throw new Error("fetch_threw")
      }
      diagnostics.statusCode = res.status

      if (res.status === 429) {
        diagnostics.providerRateLimited = true
        if (cached) {
          diagnostics = {
            ...diagnostics,
            ...cached.diagnostics,
            statusCode: 429,
            cacheHit: true,
            cacheAgeSeconds: cacheAgeSeconds(cached),
            providerRateLimited: true,
          }
          return cached.events
        }
      }

      if (!res.ok) {
        diagnostics.errorBody = (await res.text()).slice(0, 300)
        throw new Error(`ForexFactory-style provider failed: ${res.status}`)
      }

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
        diagnostics.normalizationLoopIterations = (diagnostics.normalizationLoopIterations ?? 0) + 1
        const result = normalizeRow(row, i, from)
        if ("event" in result && result.event) {
          diagnostics.normalizationLoopSuccessfulReturns =
            (diagnostics.normalizationLoopSuccessfulReturns ?? 0) + 1
          normalizedBeforeFiltering.push(result.event)
          diagnostics.normalizedEventSample ??= compactDebugValue(result.event)
          if (result.event.date >= from && result.event.date <= to) out.push(result.event)
        } else {
          diagnostics.normalizationLoopNullReturns =
            (diagnostics.normalizationLoopNullReturns ?? 0) + 1
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
      diagnostics.normalizedEventSample ??= compactDebugValue(normalizedBeforeFiltering[0] ?? null)
      diagnostics.cacheHit = false
      diagnostics.cacheAgeSeconds = 0
      diagnostics.providerRateLimited = false
      responseCache.set(key, {
        events: out,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        diagnostics: { ...diagnostics },
      })
      console.info("[economic-events] forex_factory", {
        rawEvents: rows.length,
        normalizationLoopIterations: diagnostics.normalizationLoopIterations,
        normalizationLoopSuccessfulReturns: diagnostics.normalizationLoopSuccessfulReturns,
        normalizationLoopNullReturns: diagnostics.normalizationLoopNullReturns,
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
      })()

      inFlightRequests.set(key, fetchPromise)
      try {
        return await fetchPromise
      } finally {
        inFlightRequests.delete(key)
      }
    },
  }
}
