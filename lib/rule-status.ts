import { DISPLAY_THRESHOLDS } from "./display-thresholds"

export type RuleStatus = "good" | "warning" | "danger"

export function deriveRuleStatus(input: {
  hasDailyLossLimit: boolean
  dailyLossLimit: number
  todayPnl: number
  maxDrawdown: number
  drawdownRemaining: number
}) {
  const dailyLossRemaining = input.dailyLossLimit + Math.min(0, input.todayPnl)
  const dailyLossStatus: RuleStatus = !input.hasDailyLossLimit
    ? "good"
    : input.todayPnl >= -input.dailyLossLimit * (1 - DISPLAY_THRESHOLDS.dailyLossGoodRemainingFraction)
      ? "good"
      : input.todayPnl >= -input.dailyLossLimit ? "warning" : "danger"
  const drawdownPercent = input.maxDrawdown > 0 ? (input.drawdownRemaining / input.maxDrawdown) * 100 : 0
  const drawdownStatus: RuleStatus = drawdownPercent > DISPLAY_THRESHOLDS.drawdownGoodRemainingFraction * 100
    ? "good"
    : drawdownPercent > DISPLAY_THRESHOLDS.drawdownWarningRemainingFraction * 100 ? "warning" : "danger"
  return { dailyLossRemaining, dailyLossStatus, drawdownPercent, drawdownStatus }
}
