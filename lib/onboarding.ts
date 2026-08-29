export type OnboardingGoal = "protect-funded" | "reach-payout" | "manage-multiple" | "pass-eval"
export type OnboardingHistoryChoice = "csv" | "screenshot" | "start-now"
export type ActivationStage = "value" | "goal" | "account" | "history" | "result" | "complete"

export interface ActivationState {
  started: boolean
  dismissed: boolean
  activated: boolean
  goal: OnboardingGoal | null
  historyChoice: OnboardingHistoryChoice | null
  visitedPaths: string[]
}

export interface ActivationInputs {
  realAccountCount: number
  realTradeCount: number
}

export const ONBOARDING_GOALS: Array<{
  id: OnboardingGoal
  title: string
  description: string
  resultLabel: string
}> = [
  { id: "protect-funded", title: "Protect funded accounts", description: "Keep loss-room visible and avoid trading capital that should be protected.", resultLabel: "Account protection" },
  { id: "reach-payout", title: "Reach the next payout", description: "See the verified blocker between each funded account and its next request.", resultLabel: "Payout readiness" },
  { id: "manage-multiple", title: "Manage multiple firms", description: "Route risk across accounts instead of treating every firm as a separate workspace.", resultLabel: "Capital routing" },
  { id: "pass-eval", title: "Finish an evaluation", description: "Track the target and floor without inventing requirements that do not apply.", resultLabel: "Evaluation progress" },
]

export function activationStage(state: ActivationState, input: ActivationInputs): ActivationStage {
  if (state.activated) return "complete"
  if (!state.started) return "value"
  if (!state.goal) return "goal"
  if (input.realAccountCount === 0) return "account"
  if (input.realTradeCount === 0 && !state.historyChoice) return "history"
  return "result"
}

export function activationProgress(stage: ActivationStage): { current: number; total: number; percent: number } {
  const index: Record<ActivationStage, number> = { value: 0, goal: 1, account: 2, history: 3, result: 4, complete: 4 }
  const current = index[stage]
  return { current, total: 4, percent: Math.round((current / 4) * 100) }
}

export function goalResultLabel(goal: OnboardingGoal | null): string {
  return ONBOARDING_GOALS.find((item) => item.id === goal)?.resultLabel ?? "Daily decision"
}
