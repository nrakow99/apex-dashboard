import { formatInTimeZone } from "date-fns-tz"

const NY = "America/New_York"

export function nyTodayDateString(now = new Date()): string {
  return formatInTimeZone(now, NY, "yyyy-MM-dd")
}

/** Finnhub `fetch` revalidate (seconds): today overlap → 5m; history → 24h; future-only → 1h. */
export function resolveFetchRevalidateSeconds(from: string, to: string, now = new Date()): number {
  const t = nyTodayDateString(now)
  const overlapsToday = from <= t && to >= t
  if (overlapsToday) return 300
  if (to < t) return 86400
  return 3600
}

export function resolveHttpCacheControl(from: string, to: string, now = new Date()): string {
  const s = resolveFetchRevalidateSeconds(from, to, now)
  return `public, s-maxage=${s}, stale-while-revalidate=${Math.min(s * 2, 86400)}`
}
