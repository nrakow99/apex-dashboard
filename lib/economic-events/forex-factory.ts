import { createHash } from "node:crypto"
import { formatInTimeZone, toDate } from "date-fns-tz"
import { enrichEconomicEvent } from "./enrich"
import type { EconomicEventsProvider, EconomicEventsProviderDiagnostics } from "./provider"
import type { EconomicEvent, EconomicImpactLevel } from "./types"
import { formatMetricDisplay } from "./utils"

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

type RapidApiEnvelope = {
  result?: unknown
  status?: string
}

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

function pad2(inputNumber: number): string {
  return String(inputNumber).padStart(2, "0")
}

function localDateString(dateValue: Date): string {
  return `${dateValue.getFullYear()}-${pad2(dateValue.getMonth() + 1)}-${pad2(dateValue.getDate())}`
}

function addDays(dateValue: Date, days: number): Date {
  const next = new Date(dateValue)
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
  for (const fieldName of keys) {
    const value = row[fieldName]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function mapImportance(importance: unknown): EconomicImpactLevel {
  const numericImportance =
    typeof importance === "number"
      ? importance
      : typeof importance === "string"
        ? Number(importance)
        : Number.NaN

  if (!Number.isFinite(numericImportance)) return "low"
  if (numericImportance >= 2) return "high"
  if (numericImportance === 1) return "medium"
  return "low"
}

function parseIsoInstant(raw: string): ParsedEventInstant | null {
  const parsedDate = new Date(raw)
  if (Number.isNaN(parsedDate.getTime())) return null

  return {
    instant: parsedDate,
    hasSpecificTime: true,
    marketDatetime: formatInTimeZone(parsedDate, NY, "yyyy-MM-dd HH:mm:ss"),
  }
}

function parseEventInstantFromDate(dateValue: unknown, from: string): ParsedEventInstant {
  const datetime =
    typeof dateValue === "string"
      ? dateValue.trim()
      : typeof dateValue === "number" && Number.isFinite(dateValue)
        ? new Date(dateValue).toISOString()
        : null

  if (datetime) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(datetime) || /[zZ]$|[+-]\d{2}:?\d{2}$/.test(datetime)) {
      const parsed = parseIsoInstant(datetime)
      if (parsed) return parsed
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(datetime)) {
      const dateOnlyInstant = toDate(`${datetime} 12:00:00`, { timeZone: NY })
      return {
        instant: dateOnlyInstant,
        hasSpecificTime: false,
        marketDatetime: `${datetime} 12:00:00`,
      }
    }

    const zonedInstant = toDate(datetime.replace("T", " "), { timeZone: NY })
    if (!Number.isNaN(zonedInstant.getTime())) {
      return {
        instant: zonedInstant,
        hasSpecificTime: true,
        marketDatetime: formatInTimeZone(zonedInstant, NY, "yyyy-MM-dd HH:mm:ss"),
      }
    }
  }

  const fallbackInstant = toDate(`${from} 12:00:00`, { timeZone: NY })
  return {
    instant: fallbackInstant,
    hasSpecificTime: false,
    marketDatetime: `${from} 12:00:00`,
  }
}

function nyDateString(dateValue: Date): string {
  return formatInTimeZone(dateValue, NY, "yyyy-MM-dd")
}

function nyTimeLabel(dateValue: Date): string {
  return formatInTimeZone(dateValue, NY, "HH:mm")
}

function rapidApiRowsFromResponse(json: unknown): ForexFactoryLikeRow[] {
  const response = json as RapidApiEnvelope
  if (!Array.isArray(response.result)) {
    throw new Error("RapidAPI result array missing")
  }
  return response.result.filter(isRecord)
}

function readRapidApiString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function normalizeRow(row: ForexFactoryLikeRow, index: number, from: string): EconomicEvent {
  const title = readRapidApiString(row.indicator) ?? readRapidApiString(row.title) ?? ""
  const country = readRapidApiString(row.country) ?? "US"
  const currency = readRapidApiString(row.currency)?.toUpperCase() ?? null
  const { instant, hasSpecificTime, marketDatetime } = parseEventInstantFromDate(row.date, from)
  const date = nyDateString(instant)
  const time = nyTimeLabel(instant)
  const impact = mapImportance(row.importance)
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
    forecast: formatMetricDisplay(row.forecast as string | number | null | undefined),
    previous: formatMetricDisplay(row.previous as string | number | null | undefined),
    actual: formatMetricDisplay(row.actual as string | number | null | undefined),
    source: "forex_factory",
  })
}

function buildUrl(baseUrl: string, from: string, to: string): URL {
  const url = new URL(baseUrl)
  url.search = ""
  url.searchParams.set("from", from)
  url.searchParams.set("to", to)
  url.searchParams.set("countries", RAPIDAPI_COUNTRIES)
  return url
}

const PROVIDER_RUNTIME_RECOVERED = true

export function createForexFactoryEconomicEventsProvider(
  apiKey?: string,
  apiUrl?: string,
  defaultRevalidateSeconds = 600,
): EconomicEventsProvider {
  const rapidApiKey = apiKey ?? process.env.FOREX_FACTORY_API_KEY
  const configuredUrl = apiUrl ?? process.env.FOREX_FACTORY_API_URL
  const configuredHost = process.env.FOREX_FACTORY_API_HOST
  let diagnostics: EconomicEventsProviderDiagnostics = {
    debugBuildId: DEBUG_BUILD_ID,
    providerFilePath: PROVIDER_FILE_PATH,
    providerRuntimeRecovered: PROVIDER_RUNTIME_RECOVERED,
    rawCount: null,
    rawRapidApiCount: null,
    normalizedCount: null,
    firstNormalizedEvent: null,
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
        providerRuntimeRecovered: PROVIDER_RUNTIME_RECOVERED,
        from,
        to,
      })

      diagnostics = {
        debugBuildId: DEBUG_BUILD_ID,
        providerFilePath: PROVIDER_FILE_PATH,
        rawCount: null,
        rawRapidApiCount: null,
        normalizedCount: null,
        firstNormalizedEvent: null,
        statusCode: null,
        requestHost: null,
        requestPath: null,
        requestCountries: null,
        requestQuery: null,
        authHeaderPresent: null,
        rapidApiKeyLength: rapidApiKey?.trim().length ?? 0,
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
      const trimmedRapidApiKey = rapidApiKey?.trim()
      diagnostics.resolvedRequestUrl = requestUrl.toString()
      diagnostics.requestHost = requestHost
      diagnostics.requestPath = requestUrl.pathname
      diagnostics.requestCountries = requestUrl.searchParams.get("countries")
      diagnostics.requestQuery = requestUrl.searchParams.toString()
      diagnostics.authHeaderPresent = Boolean(trimmedRapidApiKey)
      diagnostics.rapidApiKeyLength = trimmedRapidApiKey?.length ?? 0
      const requestCacheKey = cacheKey(from, to, diagnostics.requestCountries)
      const now = Date.now()
      const cached = responseCache.get(requestCacheKey)

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

      const inFlight = inFlightRequests.get(requestCacheKey)
      if (inFlight) {
        const events = await inFlight
        const updatedCache = responseCache.get(requestCacheKey)
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

      const lastFetchAt = lastRapidApiFetchAt.get(requestCacheKey)
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
        "x-rapidapi-key": trimmedRapidApiKey ?? "",
      }

      const fetchPromise = (async () => {
      lastRapidApiFetchAt.set(requestCacheKey, Date.now())
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
        diagnostics.statusCode = 429
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
        return []
      }

      if (!res.ok) {
        diagnostics.errorBody = (await res.text()).slice(0, 300)
        throw new Error(`ForexFactory-style provider failed: ${res.status}`)
      }

      const json = (await res.json()) as unknown
      const response = json as RapidApiEnvelope
      diagnostics.rawType = rawTypeOf(json)
      diagnostics.topLevelKeys = topLevelKeysOf(json)
      diagnostics.rawLength = Array.isArray(response.result) ? response.result.length : rawLengthOf(json)
      diagnostics.sampleItem = compactDebugValue(
        Array.isArray(response.result) ? response.result[0] ?? null : firstArrayItemFrom(json),
      )

      console.info("[economic-events] forex_factory raw", {
        rawType: diagnostics.rawType,
        topLevelKeys: diagnostics.topLevelKeys,
        rawLength: diagnostics.rawLength,
        sampleItem: diagnostics.sampleItem,
        requestQuery: diagnostics.requestQuery,
      })

      const rawEvents = rapidApiRowsFromResponse(json)
      diagnostics.rawRapidApiCount = rawEvents.length
      diagnostics.rawCount = rawEvents.length

      const normalizedBeforeFiltering: EconomicEvent[] = rawEvents.map((row, index) =>
        normalizeRow(row, index, from),
      )
      const out = normalizedBeforeFiltering.filter((event) => event.date >= from && event.date <= to)

      diagnostics.normalizedCountBeforeFiltering = normalizedBeforeFiltering.length
      diagnostics.normalizedUsdCount = normalizedBeforeFiltering.filter((event) => event.currency === "USD").length
      diagnostics.normalizedHighImpactCount = normalizedBeforeFiltering.filter((event) => event.impact === "high").length
      diagnostics.normalizedRedFolderCount = normalizedBeforeFiltering.filter((event) => event.isRedFolder).length
      diagnostics.normalizedEventTitlesSample = normalizedBeforeFiltering.slice(0, 20).map((event) => event.title)
      diagnostics.highImpactTitlesSample = normalizedBeforeFiltering
        .filter((event) => event.impact === "high")
        .slice(0, 20)
        .map((event) => event.title)
      diagnostics.redFolderTitlesSample = normalizedBeforeFiltering
        .filter((event) => event.isRedFolder)
        .slice(0, 20)
        .map((event) => event.title)
      diagnostics.normalizedCount = out.length
      diagnostics.firstNormalizedEvent = compactDebugValue(normalizedBeforeFiltering[0] ?? null)
      diagnostics.normalizedEventSample = diagnostics.firstNormalizedEvent
      diagnostics.cacheHit = false
      diagnostics.cacheAgeSeconds = 0
      diagnostics.providerRateLimited = false
      responseCache.set(requestCacheKey, {
        events: out,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        diagnostics: { ...diagnostics },
      })
      console.info("[economic-events] forex_factory", {
        rawRapidApiCount: diagnostics.rawRapidApiCount,
        normalizedCount: diagnostics.normalizedCount,
        firstNormalizedEvent: diagnostics.firstNormalizedEvent,
        usdRedFolderEvents: out.filter((event) => event.currency === "USD" && event.impact === "high" && event.isRedFolder).length,
      })
      return out
      })()

      inFlightRequests.set(requestCacheKey, fetchPromise)
      try {
        return await fetchPromise
      } finally {
        inFlightRequests.delete(requestCacheKey)
      }
    },
  }
}
