/**
 * Safe local-date helpers for trade calendar dates.
 *
 * Trade dates are stored as YYYY-MM-DD strings representing a calendar day
 * in the user's local timezone. Never use `new Date("YYYY-MM-DD")` on them —
 * that parses as UTC midnight and shifts the day by one in negative-offset
 * timezones (e.g. UTC-7 shows May 19 as May 18).
 */

/**
 * Parse a YYYY-MM-DD trade-date string as local midnight.
 * Handles edge cases: already a Date object, ISO timestamps, or bad input.
 */
export function parseLocalDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr
  // If it has a time component (ISO timestamp), strip it
  const bare = typeof dateStr === "string" ? dateStr.slice(0, 10) : ""
  const parts = bare.split("-").map(Number)
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    const [y, m, d] = parts
    return new Date(y, m - 1, d)
  }
  // Fallback: use the Date constructor and hope for the best
  return new Date(dateStr)
}

/**
 * Format a Date (or local-date string) as a YYYY-MM-DD key using local parts.
 * This is the inverse of parseLocalDate and should be used whenever you need
 * to produce a date key for trade/calendar matching.
 */
export function toLocalDateKey(date: Date | string): string {
  const d = date instanceof Date ? date : parseLocalDate(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Return today's date as a YYYY-MM-DD key in local time.
 * Use instead of `new Date().toISOString().split("T")[0]` which is UTC.
 */
export function localTodayKey(): string {
  return toLocalDateKey(new Date())
}
