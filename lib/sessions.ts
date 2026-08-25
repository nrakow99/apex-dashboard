/** Trading session definitions for NY session traders. */

// ── Stable session identifiers (stored in TradeMeta.session) ─────────────────

export type SessionId = "ny_am" | "ny_lunch" | "ny_pm"

export const SESSION_OPTIONS: { id: SessionId; label: string }[] = [
  { id: "ny_am",    label: "NY AM" },
  { id: "ny_lunch", label: "NY Lunch" },
  { id: "ny_pm",    label: "NY PM" },
]

export const SESSION_LABELS: Record<SessionId, string> = {
  ny_am:    "NY AM",
  ny_lunch: "NY Lunch",
  ny_pm:    "NY PM",
}

// ── Backward-compat: derive SessionId from an old "HH:MM" time string ─────────

export function sessionFromTime(time: string): SessionId | null {
  const [hStr, mStr] = time.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr ?? "0", 10)
  if (isNaN(h) || isNaN(m)) return null
  const totalMin = h * 60 + m
  if (totalMin >= 390 && totalMin < 540) return "ny_am"
  if (totalMin >= 540 && totalMin < 600) return "ny_lunch"
  if (totalMin >= 600 && totalMin < 780) return "ny_pm"
  return null
}

/**
 * Resolve the session from a TradeMeta-shaped object.
 * Prefers the new `session` field; falls back to deriving from the old `time` field.
 */
export function resolveSession(meta: {
  session?: SessionId | null
  time?: string | null
}): SessionId | null {
  if (meta.session) return meta.session
  if (meta.time) return sessionFromTime(meta.time)
  return null
}
