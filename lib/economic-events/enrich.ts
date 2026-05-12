import type { EconomicEvent } from "./types"
import { classifyEventCategory, isRedFolderEvent } from "./analytics"
import { computeEconomicSeverityScore } from "./scoring"
import { getNySessionBucket, getNySessionDisplayLabel } from "./sessions"

export type EconomicEventCore = Omit<
  EconomicEvent,
  "severityScore" | "category" | "sessionBucket" | "sessionLabel" | "isRedFolder"
>

export function enrichEconomicEvent(base: EconomicEventCore): EconomicEvent {
  const category = classifyEventCategory(base.title)
  const severityScore = computeEconomicSeverityScore(base.title, base.impact)
  const sessionBucket = getNySessionBucket(base.datetime)
  const sessionLabel = getNySessionDisplayLabel(base.datetime)
  const isRedFolder = isRedFolderEvent(base)

  return {
    ...base,
    category,
    severityScore,
    sessionBucket,
    sessionLabel,
    isRedFolder,
  }
}
