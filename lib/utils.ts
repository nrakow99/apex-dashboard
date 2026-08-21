import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency with consistent 2 decimal places
 * Examples: $50,670.00, $1,234.56
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format PnL with an explicit sign and 2 decimal places.
 * Examples: +$670.00, -$125.50, $0.00
 *
 * Built from formatCurrency rather than Intl signDisplay so a loss can
 * never render as an unsigned dollar amount. Red/green are only legal on
 * a signed figure — an unsigned $533.00 must not be colored as a loss.
 */
export function formatPnL(value: number): string {
  const abs = formatCurrency(Math.abs(value))
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return abs
}

/**
 * CSS color value for a signed P&L figure. CLAUDE.md reserves --gain/--loss
 * for signed P&L only, and a value of exactly zero has no sign to report —
 * it must render as neutral --text, never as a "gain" or "loss". A >= 0 (or
 * <= 0) comparison here is the bug: it silently colors $0.00 green/red.
 */
export function pnlColor(value: number): string {
  if (value > 0) return "var(--gain)"
  if (value < 0) return "var(--loss)"
  return "var(--text)"
}

/** Tailwind arbitrary-value class equivalent of pnlColor for text-* callers. */
export function pnlColorClass(value: number): string {
  if (value > 0) return "text-[var(--gain)]"
  if (value < 0) return "text-[var(--loss)]"
  return "text-[var(--text)]"
}

/** Tailwind arbitrary-value class equivalent of pnlColor for bg-* callers (dots, swatches). */
export function pnlBgClass(value: number): string {
  if (value > 0) return "bg-[var(--gain)]"
  if (value < 0) return "bg-[var(--loss)]"
  return "bg-[var(--text)]"
}

/**
 * Format number with commas (no decimals)
 * Examples: 50,670, 1,234
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

/**
 * Format percentage
 * Examples: 65%, 100%
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
