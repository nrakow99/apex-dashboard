/** Canonical list of tradable symbols — update here to sync all dropdowns. */
export const TRADING_SYMBOLS = ["NQM6", "MNQ", "ESM6"] as const

export type TradingSymbol = (typeof TRADING_SYMBOLS)[number]
