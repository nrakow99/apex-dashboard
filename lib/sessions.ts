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

// ── Pill badge styles for display ─────────────────────────────────────────────

export const SESSION_BADGE_STYLES: Record<SessionId, string> = {
  ny_am:    "bg-[rgba(83,104,120,0.14)] text-[#94AAB8] border-[rgba(83,104,120,0.24)]",
  ny_lunch: "bg-amber-500/[0.09] text-amber-400/75 border-amber-500/20",
  ny_pm:    "bg-[rgba(83,104,120,0.09)] text-[#7A96A4] border-[rgba(83,104,120,0.16)]",
}

// ── Selector pill styles (inactive / active) for the form ────────────────────

export const SESSION_SELECTOR_STYLES: Record<
  SessionId,
  { inactive: string; active: string }
> = {
  ny_am:    {
    inactive: "border-[rgba(83,104,120,0.20)] text-[#E5E4E2]/35 hover:text-[#E5E4E2]/55 hover:border-[rgba(83,104,120,0.32)]",
    active:   "bg-[rgba(83,104,120,0.18)] border-[rgba(83,104,120,0.38)] text-[#94AAB8]",
  },
  ny_lunch: {
    inactive: "border-amber-500/18 text-[#E5E4E2]/35 hover:text-amber-400/55 hover:border-amber-500/28",
    active:   "bg-amber-500/[0.10] border-amber-500/28 text-amber-400/85",
  },
  ny_pm:    {
    inactive: "border-[rgba(83,104,120,0.16)] text-[#E5E4E2]/30 hover:text-[#E5E4E2]/50 hover:border-[rgba(83,104,120,0.28)]",
    active:   "bg-[rgba(83,104,120,0.13)] border-[rgba(83,104,120,0.30)] text-[#7A96A4]",
  },
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
