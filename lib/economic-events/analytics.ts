import type { EconomicEvent, EconomicEventCategory, EconomicImpactLevel } from "./types"

/** Tier-1 USD macro names for “Red Folder” days (futures desk). */
export const RED_FOLDER_MACRO =
  /\b(cpi|ppi|pce|non[- ]farm|payrolls|\bnfp\b|fomc|federal reserve|fed(?:eral)? interest rate decision|fed rate|interest rate decision|gdp|retail sales|ism|pmi|unemployment(?: rate)?|(?:initial )?jobless(?: claims)?)\b/i

export const USD_EVENT_TERMS =
  /\b(fed|fomc|non[- ]farm|\bnfp\b|unemployment|jobless claims?|cpi|ppi|pce|retail sales|ism|pmi|gdp)\b/i

export function isUsdEvent(ev: Pick<EconomicEvent, "currency" | "country" | "title">): boolean {
  if (ev.currency === "USD") return true

  const country = ev.country.trim().toLowerCase()
  if (country === "us" || country === "united states") return true

  return USD_EVENT_TERMS.test(ev.title)
}

export function isRedFolderEvent(
  ev: Pick<EconomicEvent, "currency" | "country" | "impact" | "title">,
): boolean {
  if (!isUsdEvent(ev)) return false
  if (ev.impact !== "high") return false
  return RED_FOLDER_MACRO.test(ev.title)
}

export function classifyEventCategory(title: string): EconomicEventCategory {
  const t = title.toLowerCase()
  if (/\bcpi|ppi|pce|inflation/.test(t)) return "inflation"
  if (/\bnfp|payrolls|unemployment|jobless|claims/.test(t)) return "employment"
  if (/\bfomc|fed|rate decision|interest rate/.test(t)) return "rates"
  if (/\bgdp|gross domestic/.test(t)) return "growth"
  if (/\bretail sales|consumer spending/.test(t)) return "consumption"
  if (/\bism|pmi|manufacturing|services pmi/.test(t)) return "manufacturing"
  return "other"
}

/** Stable analytics payload for correlating with trades later (no UI). */
export function toAnalyticsShape(ev: EconomicEvent) {
  return {
    id: ev.id,
    datetime: ev.datetime,
    category: ev.category,
    severityScore: ev.severityScore,
    sessionBucket: ev.sessionBucket,
    sessionLabel: ev.sessionLabel,
    impact: ev.impact,
    isRedFolder: ev.isRedFolder,
    currency: ev.currency,
    country: ev.country,
    title: ev.title,
  }
}

export function impactWeightForAnalytics(impact: EconomicImpactLevel): number {
  if (impact === "high") return 3
  if (impact === "medium") return 2
  return 1
}
