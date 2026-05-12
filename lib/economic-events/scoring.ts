import type { EconomicImpactLevel, EconomicSeverityScore } from "./types"

/**
 * Centralized macro severity (0–100) for sorting and future analytics.
 * Impact colors stay on `impact`; score fine-tunes ordering within a day.
 */
export function computeEconomicSeverityScore(
  title: string,
  impact: EconomicImpactLevel,
): EconomicSeverityScore {
  const t = title.toLowerCase()

  let base = 22
  if (/\bfomc\b|fed funds|fed rate|interest rate decision/.test(t)) base = 100
  else if (/\bcpi\b|consumer price/.test(t)) base = 100
  else if (/\bnfp\b|non[- ]farm|nonfarm payrolls/.test(t)) base = 95
  else if (/\bppi\b|producer price/.test(t)) base = 80
  else if (/\bgdp\b/.test(t)) base = 75
  else if (/\bretail sales\b/.test(t)) base = 70
  else if (/\bpce\b|personal consumption/.test(t)) base = 85
  else if (/\bism\b|pmi\b/.test(t)) base = 65
  else if (/\bjobless|initial claims|unemployment\b/.test(t)) base = 55
  else if (impact === "high") base = 48
  else if (impact === "medium") base = 32
  else base = 18

  const bump =
    impact === "high" ? 1 : impact === "medium" ? 0.92 : 0.78
  return Math.min(100, Math.max(0, Math.round(base * bump)))
}
