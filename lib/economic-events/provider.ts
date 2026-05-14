import type { EconomicEvent } from "./types"
import { createFinnhubEconomicEventsProvider } from "./finnhub"
import { createForexFactoryEconomicEventsProvider } from "./forex-factory"

/** Swap implementations in the API route or a small factory (Finnhub, Trading Economics, FMP). */
export interface EconomicEventsProvider {
  fetchEvents(from: string, to: string, revalidateSeconds?: number): Promise<EconomicEvent[]>
  getDiagnostics?(): EconomicEventsProviderDiagnostics
}

export type EconomicCalendarProviderName = "finnhub" | "forex_factory"

export type EconomicEventsProviderDiagnostics = {
  rawCount?: number | null
  normalizedCount?: number | null
  statusCode?: number | null
  requestHost?: string | null
  requestPath?: string | null
  requestCountries?: string | null
  requestQuery?: string | null
  authHeaderPresent?: boolean | null
  rapidApiKeyLength?: number | null
  rawType?: string | null
  topLevelKeys?: string[] | null
  rawLength?: number | null
  sampleItem?: unknown
  normalizedEventSample?: unknown
  normalizedCountBeforeFiltering?: number | null
  normalizedUsdCount?: number | null
  normalizedHighImpactCount?: number | null
  normalizedRedFolderCount?: number | null
  normalizedEventTitlesSample?: string[] | null
  highImpactTitlesSample?: string[] | null
  redFolderTitlesSample?: string[] | null
  skippedMissingDate?: number | null
  skippedInvalidDate?: number | null
  skippedMissingTitle?: number | null
  skippedMissingCurrency?: number | null
  skippedUnknownReason?: number | null
  skippedEventSamples?: unknown[] | null
  normalizationLoopIterations?: number | null
  normalizationLoopSuccessfulReturns?: number | null
  normalizationLoopNullReturns?: number | null
  cacheHit?: boolean | null
  cacheAgeSeconds?: number | null
  providerRateLimited?: boolean | null
  fetchErrorName?: string | null
  fetchErrorMessage?: string | null
  fetchErrorStackFirstLine?: string | null
  resolvedRequestUrl?: string | null
  errorBody?: string | null
}

export type SelectedEconomicEventsProvider = {
  name: EconomicCalendarProviderName
  provider: EconomicEventsProvider
  fallbackName?: EconomicCalendarProviderName
  fallbackProvider?: EconomicEventsProvider
}

function normalizeProviderName(value: string | undefined): EconomicCalendarProviderName | null {
  const normalized = value?.trim().toLowerCase().replace(/-/g, "_")
  if (normalized === "forex_factory") return "forex_factory"
  if (normalized === "finnhub") return "finnhub"
  return null
}

export function getSelectedEconomicEventsProvider(
  defaultRevalidateSeconds = 600,
): SelectedEconomicEventsProvider {
  const finnhub = createFinnhubEconomicEventsProvider(undefined, defaultRevalidateSeconds)
  const selected =
    normalizeProviderName(process.env.ECONOMIC_CALENDAR_PROVIDER) ?? "forex_factory"

  if (selected === "forex_factory") {
    return {
      name: "forex_factory",
      provider: createForexFactoryEconomicEventsProvider(
        undefined,
        undefined,
        defaultRevalidateSeconds,
      ),
      fallbackName: "finnhub",
      fallbackProvider: finnhub,
    }
  }

  return {
    name: "finnhub",
    provider: finnhub,
  }
}
