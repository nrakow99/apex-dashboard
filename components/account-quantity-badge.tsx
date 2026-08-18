import { Badge } from "@/components/ui/badge"
import { formatAccountQuantityBadge, getAccountQuantity } from "@/lib/account-quantity"
import type { Account } from "@/lib/types"

export function AccountQuantityBadge({
  account,
  className,
}: {
  account: Pick<Account, "quantity">
  className?: string
}) {
  const label = formatAccountQuantityBadge(getAccountQuantity(account))
  if (!label) return null
  return (
    <Badge
      variant="outline"
      className={
        className ??
        "text-[10px] font-medium border-[var(--hairline)] text-[var(--muted-foreground)] bg-[var(--raised)] shrink-0"
      }
    >
      {label}
    </Badge>
  )
}
