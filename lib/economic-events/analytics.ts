import type { EconomicEvent, EconomicEventCategory, EconomicImpactLevel } from "./types"

/** Tier-1 USD macro names for “Red Folder” days (futures desk). */
export const RED_FOLDER_MACRO =
  /\b(core cpi|cpi|core ppi|ppi|core pce|pce|non[- ]farm payrolls?|nonfarm payrolls?|\bnfp\b|fomc|federal reserve|fed chair|fed funds rate|fed(?:eral)? interest rate decision|fed rate|interest rate decision|gdp|core retail sales|retail sales|average hourly earnings|unemployment(?: rate)?|initial jobless claims|jobless claims|ism manufacturing pmi|ism services pmi|ism non[- ]manufacturing pmi)\b/i

export const USD_EVENT_TERMS =
  /\b(fed|fomc|non[- ]farm|\bnfp\b|unemployment|jobless claims?|cpi|ppi|pce|retail sales|average hourly earnings|ism|pmi|gdp)\b/i

export function isUsdEvent(ev: Pick<EconomicEvent, "currency" | "country" | "title">): boolean {
  const currency = ev.currency?.trim().toUpperCase()
  if (currency) return currency === "USD"

  const country = ev.country.trim().toLowerCase()
  if (country === "us" || country === "usa" || country === "united states" || country === "united states of america") {
    return true
  }
  if (country && country !== "zz" && country !== "global") return false

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
