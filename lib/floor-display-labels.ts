import type { Account } from "@/lib/types"
import { hasIntradayManualDrawdown } from "@/lib/intraday-manual-drawdown"
import { getAccountRules } from "@/lib/rules"
import { formatCurrency } from "@/lib/utils"

/** Top metric card + rule card + chart: primary floor / threshold title */
export function getFloorDisplayTitle(account: Account): string {
  const rules = getAccountRules(account)
  if (rules.lucidFlexFloor && account.firm === "Lucid" && account.type === "PA") {
    return account.drawdownType === "Intraday" ? "Lucid Flex threshold" : "Lucid Flex floor"
  }
  if (account.drawdownType === "EOD") return "Active EOD Floor"
  if (account.type === "Eval") return "Intraday Threshold"
  return "Intraday Floor"
}

/** Secondary line under top metric floor value (MetricsCard status.label) */
export function getFloorMetricStatusLabel(
  account: Account,
  opts: { isTradingDayComplete: boolean },
): string {
  const rules = getAccountRules(account)
  if (rules.lucidFlexFloor && account.firm === "Lucid" && account.type === "PA") {
    const f = rules.lucidFlexFloor
    return `Locks ${formatCurrency(f.lockedFloor)} after ${formatCurrency(f.lockPeakThreshold)} peak`
  }
  if (account.drawdownType === "EOD") {
    return opts.isTradingDayComplete ? "Updated" : "Updates at 2PM"
  }
  if (hasIntradayManualDrawdown(account)) return "Manually updated from Tradovate"
  if (account.type === "Eval") return "Trails session peak"
  return "Manual / live threshold"
}

/** Projected floor hint — EOD only; intraday never shows EOD projection here */
export function shouldShowEodProjectedFloorSubValue(
  account: Account,
  stats: {
    isTradingDayComplete: boolean
    projectedEodFloor: number
    activeEodFloor: number
  },
): boolean {
  if (account.drawdownType !== "EOD") return false
  const rules = getAccountRules(account)
  if (rules.lucidFlexFloor && account.firm === "Lucid" && account.type === "PA") return false
  return (
    !stats.isTradingDayComplete && stats.projectedEodFloor !== stats.activeEodFloor
  )
}

/** Rule Status panel: first RuleCard title */
export function getRuleEngineFloorCardTitle(account: Account): string {
  return getFloorDisplayTitle(account)
}

/** Rule Status: small caption under the floor row label */
export function getRuleEngineFloorRowHint(account: Account): string {
  const rules = getAccountRules(account)
  if (rules.lucidFlexFloor && account.firm === "Lucid" && account.type === "PA") {
    const f = rules.lucidFlexFloor
    return `Locks at ${formatCurrency(f.lockedFloor)} once peak reaches ${formatCurrency(f.lockPeakThreshold)}`
  }
  if (account.drawdownType === "EOD") return "Updates at 2PM"
  if (hasIntradayManualDrawdown(account)) return "Manually updated from Tradovate"
  if (account.type === "Eval") return "Trails session peak"
  return "Manual / live threshold"
}

/** Rule Status: label next to the floor dollar amount */
export function getRuleEngineFloorRowLabel(account: Account): string {
  const rules = getAccountRules(account)
  if (rules.lucidFlexFloor && account.firm === "Lucid" && account.type === "PA") {
    return account.drawdownType === "Intraday" ? "Flex threshold" : "Flex floor"
  }
  if (account.drawdownType === "EOD") return "Active Floor"
  if (account.type === "Eval") return "Intraday Threshold"
  return "Intraday Floor"
}

/** Performance chart header (balance view) */
export function getPerformanceChartBalanceSubtitle(account: Account): string {
  return getFloorDisplayTitle(account)
}

/** Chart legend + tooltip: floor line name */
export function getChartFloorLineLabel(account: Account): string {
  return getFloorDisplayTitle(account)
}

/** Account Range card: left column header */
export function getAccountRangeFloorTitle(account: Account): string {
  return getFloorDisplayTitle(account)
}
