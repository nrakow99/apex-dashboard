/** Relative label for upcoming releases; past events return empty string. */
export function formatEventCountdown(iso: string, now: Date): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const diff = t - now.getTime()
  if (diff <= 0) return ""

  const dayMs = 86400000
  const hourMs = 3600000
  const minMs = 60000

  if (diff < minMs) return "soon"

  const days = Math.floor(diff / dayMs)
  if (days >= 2) return `in ${days}d`
  if (days === 1) return "tomorrow"

  const hours = Math.floor(diff / hourMs)
  const mins = Math.floor((diff % hourMs) / minMs)
  if (hours >= 1) return `in ${hours}h ${mins}m`
  return `in ${mins}m`
}
