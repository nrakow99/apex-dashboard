"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, Check, Circle, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useOnboarding } from "@/hooks/use-onboarding"
import { buildOnboardingSteps, onboardingProgress } from "@/lib/onboarding"
import { cn } from "@/lib/utils"

const pageHelp: Record<string, { title: string; description: string; steps: string[] }> = {
  "/today": { title: "Start every session here", description: "Today turns every account into one prioritized trading plan.", steps: ["Read What matters now", "Resolve Stop or Check items", "Quick log results after the session"] },
  "/compliance": { title: "Work from the top down", description: "The queue separates hard blockers from routine payout progress.", steps: ["Stop items come first", "Check items deserve review", "Routine steps can wait"] },
  "/accounts": { title: "Open an account for the full picture", description: "Cards answer whether an account is stable; detail views explain why.", steps: ["Overview shows balance and next action", "Rules & payouts shows verified limits", "History contains calendar and trades"] },
  "/trades": { title: "Logging can stay simple", description: "Only account, date, symbol, and net P&L are required.", steps: ["Use Quick log for manual results", "Import CSV for broker history", "Add review details when useful"] },
  "/analytics": { title: "Find your evidence-backed edge", description: "PropDash compares behavior across firms while showing the sample behind every conclusion.", steps: ["Read the Edge brief", "Check same-day concentration", "Repeat strengths and remove leaks"] },
  "/payouts": { title: "Verify before requesting", description: "Readiness uses saved history and verified rules, then asks you to confirm the firm portal.", steps: ["Select the funded account", "Review every requirement", "Test the withdrawal impact"] },
  "/settings": { title: "Set assumptions once", description: "Risk defaults power trade-headroom estimates but never replace firm rules.", steps: ["Set a complete risk profile", "Confirm instrument specifications", "Export or back up workspace data"] },
}

export function OnboardingGuide() {
  const pathname = usePathname()
  const { accounts, trades, userRiskProfile, loading } = useDashboardData()
  const { state, loading: onboardingLoading, update, recordVisit } = useOnboarding()
  const [manuallyOpen, setManuallyOpen] = useState(false)

  useEffect(() => {
    recordVisit(pathname)
  }, [pathname, recordVisit])

  const realAccounts = useMemo(
    () => accounts.filter((account) => !account.isDemo),
    [accounts],
  )
  const realAccountIds = useMemo(
    () => new Set(realAccounts.map((account) => account.id)),
    [realAccounts],
  )
  const steps = useMemo(() => buildOnboardingSteps({
    accountCount: realAccounts.length,
    tradeCount: trades.filter((trade) => realAccountIds.has(trade.accountId)).length,
    fundedAccountCount: realAccounts.filter((account) => account.type === "PA").length,
    riskProfile: userRiskProfile,
    visitedPaths: state.visitedPaths,
  }), [realAccountIds, realAccounts, state.visitedPaths, trades, userRiskProfile])
  const progress = onboardingProgress(steps)
  const firstVisit = !loading && !onboardingLoading && !state.started && !state.dismissed
  const open = manuallyOpen || firstVisit
  const context = pageHelp[pathname] ?? pageHelp["/today"]

  const close = () => {
    setManuallyOpen(false)
    update({ started: true })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setManuallyOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-10 items-center gap-2 rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-3 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--raised)] hover:text-white lg:bottom-[76px] lg:left-4 lg:right-auto lg:w-[216px]"
      >
        <Compass className="h-4 w-4" />
        <span>{progress.isComplete ? "Help & shortcuts" : `Setup ${progress.completed}/${progress.total}`}</span>
        <span className="ml-auto font-mono text-[10px] text-[var(--faint)]">{progress.percent}%</span>
      </button>

      <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] sm:max-w-[620px]">
          <DialogHeader>
            <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Getting started</p>
            <DialogTitle className="text-2xl tracking-[-0.035em]">{progress.isComplete ? "Use PropDash with confidence" : "Set up payout intelligence"}</DialogTitle>
            <DialogDescription className="max-w-lg leading-relaxed">
              PropDash protects funded accounts by joining verified firm rules with your real trade and payout history. Complete these steps once, then use Today before every session.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 h-1 bg-[var(--hairline)]" aria-label={`${progress.percent}% complete`}>
            <div className="h-full bg-white transition-[width]" style={{ width: `${progress.percent}%` }} />
          </div>

          <div className="mt-5 border border-[var(--hairline)] bg-[var(--raised)] p-4">
            <p className="text-[9px] uppercase tracking-[0.17em] text-[var(--faint)]">On this page</p>
            <p className="mt-2 text-sm font-medium">{context.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{context.description}</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {context.steps.map((step, index) => <li key={step} className="flex gap-2 text-[11px] leading-relaxed text-[var(--muted)]"><span className="font-mono text-[var(--faint)]">0{index + 1}</span><span>{step}</span></li>)}
            </ol>
          </div>

          <div className="mt-5 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {steps.map((step, index) => (
              <div key={step.id} className="grid gap-3 py-4 sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-center">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-[2px] border", step.complete ? "border-white bg-white text-black" : "border-[var(--hairline)] text-[var(--faint)]") }>
                  {step.complete ? <Check className="h-4 w-4" /> : <span className="font-mono text-[10px]">{index + 1}</span>}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{step.description}</p>
                </div>
                <Button asChild variant={step.complete ? "outline" : "default"} size="sm" onClick={close}>
                  <Link href={step.href}>{step.action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 border border-[var(--hairline)] bg-[var(--raised)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[var(--muted)]">
              <Circle className="mt-0.5 h-3 w-3 shrink-0" />
              <p>The guide never invents rule values. Press <span className="font-mono text-white">⌘K</span> anywhere to jump to a page, action, or account.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { update({ started: true, dismissed: true }); setManuallyOpen(false) }}>Hide for now</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
