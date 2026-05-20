import type { Account } from "@/lib/types"

export const MAX_ACCOUNT_QUANTITY = 20

/** Whole-number bundle count; defaults to 1 for legacy rows. */
export function getAccountQuantity(account: Pick<Account, "quantity">): number {
  const raw = account.quantity ?? 1
  if (!Number.isFinite(raw)) return 1
  return Math.max(1, Math.min(MAX_ACCOUNT_QUANTITY, Math.floor(raw)))
}

/** Per-account size for rule engine / firm rule lookup (never scaled). */
export function getRuleAccountSize(account: Pick<Account, "accountSize">): number {
  return account.accountSize
}

/**
 * Per-account starting balance for stats, floors, charts, and rule math.
 * Never multiplied by quantity. Handles legacy rows that stored aggregate starting balance.
 */
export function getRuleStartingBalance(
  account: Pick<Account, "accountSize" | "startingBalance" | "quantity">,
): number {
  const qty = getAccountQuantity(account)
  const size = account.accountSize
  const stored = account.startingBalance
  if (qty > 1 && Math.abs(stored - size * qty) < 0.01) {
    return size
  }
  return stored
}

/** Homepage / portfolio total balance: representative balance × quantity. */
export function getPortfolioBalance(
  representativeBalance: number,
  account: Pick<Account, "quantity">,
): number {
  return representativeBalance * getAccountQuantity(account)
}

/** Portfolio buying-power context from per-account size × quantity (display only). */
export function getPortfolioBuyingPower(
  account: Pick<Account, "accountSize" | "quantity">,
): number {
  return account.accountSize * getAccountQuantity(account)
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

/** e.g. "Tracking one representative 50K account" */
export function formatRepresentativeTrackingHelper(
  account: Pick<Account, "accountSize" | "quantity">,
): string | null {
  const q = getAccountQuantity(account)
  if (q <= 1) return null
  const sizeK =
    account.accountSize >= 1000
      ? `${Math.round(account.accountSize / 1000)}K`
      : String(account.accountSize)
  return `Tracking one representative $${sizeK} account`
}

export function sumAccountQuantities(accounts: Pick<Account, "quantity">[]): number {
  return accounts.reduce((sum, a) => sum + getAccountQuantity(a), 0)
}
