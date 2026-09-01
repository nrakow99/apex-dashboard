import { getRuleStartingBalance } from "./account-quantity"
import { getAccountRules, resolveTradeifyProgram } from "./rules"
import type { Account, DailyPnL } from "./types"

export function buildCalendarRuleState(account: Account, dailyData: readonly DailyPnL[]) {
  const rules = getAccountRules(account)
  const tradeifyProgram = resolveTradeifyProgram(account)
  const isTradeifyFlex = account.firm === "Tradeify" && tradeifyProgram === "select_flex"
  const isTradeifyEval = account.firm === "Tradeify" && (tradeifyProgram === "select_eval" || account.type === "Eval")
  const showQualifyingStars = account.type !== "Eval" && (
    (account.firm === "Apex" && rules.hasPayouts && rules.minProfitDays > 0 && rules.minDailyProfit > 0) ||
    (account.firm === "Lucid" && account.type === "PA" && rules.hasPayouts && rules.minProfitDays > 0) ||
    isTradeifyFlex
  )
  const minQualifyingProfit = isTradeifyFlex ? rules.winningDayThreshold : rules.minDailyProfit
  const consistencyWarnDates = new Set<string>()

  if (isTradeifyEval && rules.consistencyPercent > 0) {
    const fraction = rules.consistencyPercent / 100
    let cumulative = 0
    for (const day of [...dailyData].sort((a, b) => a.date.localeCompare(b.date))) {
      cumulative += day.pnl
      if (cumulative > 0 && day.pnl > 0 && day.pnl > cumulative * fraction) consistencyWarnDates.add(day.date)
    }
  }

  return {
    rules,
    tradeifyProgram,
    isTradeifyFlex,
    isTradeifyEval,
    showQualifyingStars,
    minQualifyingProfit,
    consistencyWarnDates,
    bufferLine: account.firm === "Tradeify" && tradeifyProgram === "select_daily"
      ? getRuleStartingBalance(account) + rules.bufferAmount
      : 0,
  }
}
