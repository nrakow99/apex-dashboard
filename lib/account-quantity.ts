import type { Account } from "@/lib/types"
import type { AccountRules } from "@/lib/rules"

export const MAX_ACCOUNT_QUANTITY = 20

/** Whole-number bundle count; defaults to 1 for legacy rows. */
export function getAccountQuantity(account: Pick<Account, "quantity">): number {
  const raw = account.quantity ?? 1
  if (!Number.isFinite(raw)) return 1
  return Math.max(1, Math.min(MAX_ACCOUNT_QUANTITY, Math.floor(raw)))
}

/** Aggregate starting balance (per-account size × quantity). */
export function getAccountStartingBalance(
  account: Pick<Account, "accountSize" | "quantity">,
): number {
  return account.accountSize * getAccountQuantity(account)
}

/** Per-account max drawdown stored on the account, scaled for the bundle. */
export function getAccountMaxDrawdown(account: Pick<Account, "maxDrawdown" | "quantity">): number {
  return account.maxDrawdown * getAccountQuantity(account)
}

/** Per-account profit target (stored or from rules), scaled for the bundle. */
export function getAccountProfitTarget(
  account: Pick<Account, "profitTarget" | "quantity">,
  perAccountTarget?: number | null,
): number | undefined {
  const per = account.profitTarget ?? perAccountTarget
  if (per == null || per <= 0) return undefined
  return per * getAccountQuantity(account)
}

/** Per-account daily loss limit, scaled for the bundle. */
export function getAccountDailyLossLimit(
  account: Pick<Account, "dailyLossLimit" | "quantity">,
): number {
  return (account.dailyLossLimit ?? 0) * getAccountQuantity(account)
}

/** Scale payout / balance thresholds that apply to the grouped bundle. */
export function scaleAccountRulesForQuantity(rules: AccountRules, quantity: number): AccountRules {
  if (quantity <= 1) return rules
  return {
    ...rules,
    safetyNet: rules.safetyNet * quantity,
    minBalanceToRequest: rules.minBalanceToRequest * quantity,
    payoutCaps: rules.payoutCaps.map((c) => c * quantity),
    payoutAbsoluteCap: rules.payoutAbsoluteCap * quantity,
  }
}

export function formatAccountQuantityBadge(quantity: number): string | null {
  if (quantity <= 1) return null
  return `${quantity}x Accounts`
}

/** e.g. "2x $50K accounts" */
export function formatAccountBundleHelper(
  account: Pick<Account, "accountSize" | "quantity">,
): string | null {
  const q = getAccountQuantity(account)
  if (q <= 1) return null
  const sizeK =
    account.accountSize >= 1000
      ? `${Math.round(account.accountSize / 1000)}K`
      : String(account.accountSize)
  return `${q}x $${sizeK} accounts`
}

/** e.g. "$3,000 target/account · $6,000 total" */
export function formatScaledRuleHelper(
  perAccountAmount: number,
  quantity: number,
  label: string,
): string | null {
  if (quantity <= 1) return null
  const total = perAccountAmount * quantity
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return `$${fmt(perAccountAmount)} ${label}/account · $${fmt(total)} total`
}

export function sumAccountQuantities(accounts: Pick<Account, "quantity">[]): number {
  return accounts.reduce((sum, a) => sum + getAccountQuantity(a), 0)
}
