import { BUILTIN_INSTRUMENTS } from "@/lib/instrument-specs"

/**
 * Canonical roots for trade logging. Contract-month codes expire, so the
 * entry form intentionally uses the verified instrument roots already used
 * by risk profiles instead of presenting stale contracts as current.
 */
export const TRADING_SYMBOLS = BUILTIN_INSTRUMENTS.map(({ symbol }) => symbol)

export type TradingSymbol = (typeof TRADING_SYMBOLS)[number]
