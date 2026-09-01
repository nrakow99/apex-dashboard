import type { AccountType, AlphaTier, Firm, TradeifyProgram } from "./types"

export class UnsupportedAccountConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsupportedAccountConfigurationError"
  }
}

export const STANDARD_ACCOUNT_SIZES = [25000, 50000, 100000, 150000] as const
const TOPSTEP_ACCOUNT_SIZES = [50000, 100000, 150000] as const
const ALPHA_ZERO_ACCOUNT_SIZES = [25000, 50000, 100000] as const
const ALPHA_MID_ACCOUNT_SIZES = [50000, 100000, 150000] as const

export function supportedAccountSizes(firm: Firm, alphaTier?: AlphaTier | null): readonly number[] {
  if (firm === "Topstep") return TOPSTEP_ACCOUNT_SIZES
  if (firm === "Alpha") return alphaTier === "zero" ? ALPHA_ZERO_ACCOUNT_SIZES : ALPHA_MID_ACCOUNT_SIZES
  return STANDARD_ACCOUNT_SIZES
}

export function isSupportedAccountSize(firm: Firm, accountSize: number, alphaTier?: AlphaTier | null): boolean {
  return supportedAccountSizes(firm, alphaTier).includes(accountSize)
}

export function inferLegacyTradeifyProgram(input: {
  type: AccountType
  dailyLossLimit?: number | null
}): TradeifyProgram | null {
  if (input.type === "Live") return null
  if (input.type === "Eval") return "select_eval"
  return (input.dailyLossLimit ?? 0) > 0 ? "select_daily" : "select_flex"
}

export function initialTradeifyProgram(input: {
  type: AccountType
  program?: TradeifyProgram | null
  dailyLossLimit?: number | null
}): TradeifyProgram | null {
  if (input.type === "Live") return null
  return input.program ?? inferLegacyTradeifyProgram(input)
}

export function assertSupportedAccountConfiguration(input: {
  firm: Firm
  type: AccountType
  accountSize: number
  program?: TradeifyProgram | null
  dailyLossLimit?: number | null
  alphaTier?: AlphaTier | null
}): void {
  if (input.type === "Live") {
    throw new UnsupportedAccountConfigurationError(`${input.firm} Live accounts do not have a verified rule configuration.`)
  }
  if (input.firm === "Alpha" && !input.alphaTier) {
    throw new UnsupportedAccountConfigurationError("Alpha Futures accounts require alphaTier (zero | standard | advanced) — no safe default exists across tiers.")
  }
  if (!isSupportedAccountSize(input.firm, input.accountSize, input.alphaTier)) {
    throw new UnsupportedAccountConfigurationError(`Unsupported ${input.firm} account size ${input.accountSize}.`)
  }
  if (input.firm === "Tradeify") {
    const program = input.program ?? inferLegacyTradeifyProgram(input)
    const valid = input.type === "Eval"
      ? program === "select_eval"
      : program === "select_flex" || program === "select_daily"
    if (!valid) throw new UnsupportedAccountConfigurationError(`Tradeify ${input.type} does not match the selected program.`)
  }
}
