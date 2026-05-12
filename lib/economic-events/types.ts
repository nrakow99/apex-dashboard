export type EconomicImpactLevel = "high" | "medium" | "low"

export type EconomicEventSource = "finnhub" | "trading-economics" | "fmp"

/** Normalized event returned by `/api/economic-events` and providers. */
export type EconomicEvent = {
  id: string
  /** Calendar grouping date (America/New_York civil date). */
  date: string
  /** Display time in NY, HH:mm or null (all-day / unknown). */
  time: string | null
  /** Instant as ISO 8601 (UTC). */
  datetime: string
  country: string
  currency?: string | null
  title: string
  impact: EconomicImpactLevel
  forecast?: string | number | null
  previous?: string | number | null
  actual?: string | number | null
  source: EconomicEventSource
}

/** Existing calendar UI / badges use title-case impact. */
export type EconomicEventImpactDisplay = "High" | "Medium" | "Low"

export type CalendarEventDisplay = {
  id: string
  /** User-facing time label (browser local). */
  time: string
  name: string
  impact: EconomicEventImpactDisplay
  forecast: string | null
  previous: string | null
  actual: string | null
  country: string
  currency?: string | null
  datetime: string
  /** Extra emphasis for US macro + high impact. */
  isUsdHigh?: boolean
}
