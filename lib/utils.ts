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
 * Format PnL with sign and 2 decimal places
 * Examples: +$670.00, -$125.50
 */
export function formatPnL(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value)
  return formatted
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
