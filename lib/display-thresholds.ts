/** Product presentation policy only; never used as a prop-firm rule. */
export const DISPLAY_THRESHOLDS = {
  payoutReadyRoomFraction: 0.55,
  stableRoomFraction: 0.45,
  nearPayoutDollars: 350,
  nearProfitTargetFraction: 0.15,
  passingPacePercent: 65,
  metricPositiveRoomFraction: 0.5,
  reviewCoverageWarningPercent: 70,
  protectFirstRoomFraction: 0.25,
  dailyLossGoodRemainingFraction: 0.2,
  drawdownGoodRemainingFraction: 0.5,
  drawdownWarningRemainingFraction: 0.2,
} as const
