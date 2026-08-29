"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, Check, Compass, FileUp, Play, ScanLine, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useOnboarding } from "@/hooks/use-onboarding"
import { activationProgress, activationStage, goalResultLabel, ONBOARDING_GOALS, type OnboardingGoal, type OnboardingHistoryChoice } from "@/lib/onboarding"
import { buildTodayAccounts } from "@/lib/today-dashboard"
import { buildComplianceItems } from "@/lib/compliance-center"
import { buildRotationDecision } from "@/lib/edge-intelligence"
import { localTodayKey } from "@/lib/date-utils"
import { formatCurrency, cn } from "@/lib/utils"

const pageHelp: Record<string, { title: string; description: string; actions: string[] }> = {
  "/today": { title: "Use Today before the session", description: "This is the decision layer: what to protect, what deserves risk, and what blocks the next payout.", actions: ["Read What matters now", "Resolve the first open action", "Log the result after trading"] },
  "/compliance": { title: "Work from the top down", description: "Hard blockers precede review items and routine payout progress.", actions: ["Stop items first", "Verify watch items", "Leave routine work for last"] },
  "/accounts": { title: "Make the account configuration exact", description: "Firm, program, stage, size, and drawdown path determine which verified rules resolve.", actions: ["Check account identity", "Review Rules & payouts", "Keep unavailable values unavailable"] },
  "/trades": { title: "Bring history in without busywork", description: "CSV, reviewed screenshot extraction, and fast manual logging all feed the same account truth.", actions: ["Choose one import path", "Review uncertain rows", "Add context only when useful"] },
  "/analytics": { title: "Demand evidence from every insight", description: "Edge findings show their sample size and remain historical—not market signals.", actions: ["Check coverage", "Read the sample", "Repeat strengths, remove leaks"] },
  "/payouts": { title: "Verify before requesting", description: "PropDash organizes readiness; the firm portal remains the final live confirmation.", actions: ["Review every requirement", "Model withdrawal impact", "Confirm the portal"] },
  "/settings": { title: "Set assumptions when they become useful", description: "Personal risk defaults improve headroom estimates but never replace firm rules.", actions: ["Set risk defaults", "Verify instruments", "Export a backup"] },
}

export function OnboardingGuide() {
  const pathname = usePathname()
  const { accounts, trades, payouts, instrumentSpecs, userRiskProfile, loading } = useDashboardData()
  const { state, loading: onboardingLoading, update, recordVisit } = useOnboarding()
  const [manuallyOpen, setManuallyOpen] = useState(false)
  const [snoozed, setSnoozed] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<OnboardingGoal | null>(null)
  const [selectedHistory, setSelectedHistory] = useState<OnboardingHistoryChoice | null>(null)
  const effectiveGoal = selectedGoal ?? state.goal
  const effectiveHistory = selectedHistory ?? state.historyChoice

  useEffect(() => { recordVisit(pathname) }, [pathname, recordVisit])

  const realAccounts = useMemo(() => accounts.filter((account) => !account.isDemo), [accounts])
  const realAccountIds = useMemo(() => new Set(realAccounts.map((account) => account.id)), [realAccounts])
  const realTrades = useMemo(() => trades.filter((trade) => realAccountIds.has(trade.accountId)), [realAccountIds, trades])
  const realPayouts = useMemo(() => payouts.filter((payout) => realAccountIds.has(payout.accountId)), [payouts, realAccountIds])
  const stage = activationStage(state, { realAccountCount: realAccounts.length, realTradeCount: realTrades.length })
  const progress = activationProgress(stage)
  const waitingInWorkspace = (stage === "account" && pathname === "/accounts") || (stage === "history" && pathname === "/trades")
  const shouldAutoOpen = !loading && !onboardingLoading && !state.dismissed && stage !== "complete" && !waitingInWorkspace
  const open = manuallyOpen || (shouldAutoOpen && !snoozed)
  const context = pageHelp[pathname] ?? pageHelp["/today"]

  const result = useMemo(() => {
    if (realAccounts.length === 0) return null
    const rows = buildTodayAccounts(realAccounts, realTrades, realPayouts, localTodayKey())
    const items = buildComplianceItems({ accounts: realAccounts, trades: realTrades, payouts: realPayouts, instrumentSpecs, userRiskProfile })
    const priority = items.find((item) => item.kind === "blocker") ?? items.find((item) => item.kind === "watch") ?? items.find((item) => item.kind === "ready") ?? items[0]
    const rotation = buildRotationDecision(rows, items)
    const nearestFloor = rows.filter((row) => row.drawdownRemaining != null && !row.breached).sort((a, b) => a.drawdownRemaining! - b.drawdownRemaining!)[0]
    const readyCount = rows.filter((row) => row.payoutReady).length
    const evalAccount = rows.find((row) => row.account.type === "Eval")

    if (state.goal === "manage-multiple") return { title: rotation.title, description: rotation.description, href: rotation.accountId ? `/accounts?account=${rotation.accountId}` : "/today", action: rotation.accountId ? "Review routed account" : "Open Today" }
    if (state.goal === "reach-payout") return readyCount > 0
      ? { title: `${readyCount} funded account${readyCount === 1 ? " is" : "s are"} ready to verify`, description: "Every currently stored requirement is met. Confirm live values in the firm portal before requesting.", href: "/payouts", action: "Review payout readiness" }
      : { title: priority?.title ?? "Your payout path is now visible", description: priority ? `${priority.accountName ? `${priority.accountName} · ` : ""}${priority.description}` : "Open Today after each result to keep the next verified requirement visible.", href: priority?.href ?? "/payouts", action: priority?.action ?? "Open payouts" }
    if (state.goal === "pass-eval" && evalAccount) return { title: `${evalAccount.account.name} is ready for a daily plan`, description: "PropDash will keep its verified floor, target, and open compliance action together as results are added.", href: `/accounts?account=${evalAccount.account.id}`, action: "Review evaluation" }
    if (nearestFloor) return { title: `Protect ${nearestFloor.account.name} first`, description: `${formatCurrency(nearestFloor.drawdownRemaining!)} of verified account loss-room remains. Review its limits before assigning more risk.`, href: `/accounts?account=${nearestFloor.account.id}`, action: "Review protected account" }
    return { title: priority?.title ?? "Your daily command center is ready", description: priority?.description ?? "Open Today to see the first trustworthy action from your connected account.", href: priority?.href ?? "/today", action: priority?.action ?? "Open Today" }
  }, [instrumentSpecs, realAccounts, realPayouts, realTrades, state.goal, userRiskProfile])

  const completeActivation = () => {
    update({ activated: true, started: true, dismissed: false })
    setManuallyOpen(false)
  }

  const chooseHistoryDestination = () => {
    if (!effectiveHistory) return "/trades"
    update({ historyChoice: effectiveHistory })
    if (effectiveHistory === "start-now") return "/today"
    return `/trades?onboarding=${effectiveHistory}`
  }

  return (
    <>
      <button type="button" onClick={() => { setSnoozed(false); setManuallyOpen(true); if (stage !== "complete") update({ dismissed: false }) }} className="fixed bottom-4 right-4 z-30 flex h-10 items-center gap-2 rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-3 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] lg:bottom-[76px] lg:left-4 lg:right-auto lg:w-[216px]">
        <Compass className="h-4 w-4" />
        <span>{stage === "complete" ? "Help & shortcuts" : `Build my plan · ${progress.current}/${progress.total}`}</span>
        {stage !== "complete" && <span className="ml-auto font-mono text-[10px] text-[var(--faint)]">{progress.percent}%</span>}
      </button>

      <Dialog open={open} onOpenChange={(next) => { if (!next) { setManuallyOpen(false); setSnoozed(true); if (stage !== "complete") update({ dismissed: true }) } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-0 sm:max-w-[640px] [&>button]:right-4 [&>button]:top-4">
          {stage === "complete" ? <div className="p-6 sm:p-8"><DialogHeader><p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">On this page</p><DialogTitle className="text-2xl tracking-[-0.035em]">{context.title}</DialogTitle><DialogDescription className="leading-relaxed">{context.description}</DialogDescription></DialogHeader><ol className="mt-7 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">{context.actions.map((action, index) => <li key={action} className="flex items-center gap-4 py-4 text-sm"><span className="font-mono text-[10px] text-[var(--faint)]">0{index + 1}</span><span>{action}</span></li>)}</ol><div className="mt-6 flex justify-end"><Button onClick={() => setManuallyOpen(false)}>Got it</Button></div></div> : <div key={stage} className="animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="border-b border-[var(--hairline)] px-6 py-4 sm:px-8"><div className="flex items-center justify-between"><p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Your first decision</p><span className="font-mono text-[10px] text-[var(--faint)]">{progress.current}/{progress.total}</span></div><div className="mt-3 h-px bg-[var(--hairline)]"><div className="h-px bg-[var(--text)] transition-[width] duration-300" style={{ width: `${progress.percent}%` }} /></div></div>

            {stage === "value" && <div className="p-6 sm:p-8"><DialogHeader><span className="mb-2 flex h-10 w-10 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><Sparkles className="h-4 w-4" /></span><DialogTitle className="text-3xl leading-tight tracking-[-0.045em]">Know the next move before you risk the account.</DialogTitle><DialogDescription className="max-w-xl text-sm leading-relaxed">PropDash combines verified firm rules with your actual history to tell you what should be traded, protected, or prepared for payout.</DialogDescription></DialogHeader><div className="mt-7 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3">{[["Trade", "Route risk to the strongest verified buffer."], ["Protect", "Keep vulnerable or payout-ready capital out of rotation."], ["Payout", "See the next verified requirement before the request screen."]].map(([title, copy]) => <div key={title} className="bg-[var(--raised)] p-4"><p className="text-sm font-medium">{title}</p><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{copy}</p></div>)}</div><Button className="mt-7 w-full" onClick={() => update({ started: true })}>Build my command center<ArrowRight className="ml-2 h-4 w-4" /></Button><button type="button" className="mt-4 w-full text-center text-xs text-[var(--faint)] hover:text-[var(--muted)]" onClick={() => update({ dismissed: true })}>Explore the demo first</button></div>}

            {stage === "goal" && <div className="p-6 sm:p-8"><DialogHeader><DialogTitle className="text-2xl tracking-[-0.035em]">What should PropDash help you do first?</DialogTitle><DialogDescription>Your answer changes the result we prioritize. It does not change or infer any firm rule.</DialogDescription></DialogHeader><div className="mt-6 grid gap-2">{ONBOARDING_GOALS.map((goal) => <button key={goal.id} type="button" onClick={() => setSelectedGoal(goal.id)} className={cn("grid grid-cols-[minmax(0,1fr)_24px] gap-4 rounded-[2px] border p-4 text-left transition-colors", effectiveGoal === goal.id ? "border-[var(--text)] bg-[var(--raised)]" : "border-[var(--hairline)] hover:bg-[var(--raised)]")}><span><span className="block text-sm font-medium">{goal.title}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{goal.description}</span></span><span className={cn("flex h-6 w-6 items-center justify-center border border-[var(--hairline)]", effectiveGoal === goal.id && "bg-[var(--text)] text-[var(--ground)]")}>{effectiveGoal === goal.id && <Check className="h-3.5 w-3.5" />}</span></button>)}</div><Button className="mt-6 w-full" disabled={!effectiveGoal} onClick={() => effectiveGoal && update({ goal: effectiveGoal })}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button></div>}

            {stage === "account" && <div className="p-6 sm:p-8"><DialogHeader><span className="mb-2 flex h-10 w-10 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><ShieldCheck className="h-4 w-4" /></span><DialogTitle className="text-2xl tracking-[-0.035em]">Connect the account that matters now.</DialogTitle><DialogDescription className="leading-relaxed">Add its exact firm, program, stage, size, and drawdown path. PropDash will refuse to show rule-dependent values if that configuration cannot be resolved safely.</DialogDescription></DialogHeader><div className="mt-6 border border-[var(--hairline)] bg-[var(--raised)] p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Why this effort is worth it</p><p className="mt-2 text-sm">One accurate account unlocks its loss-room, compliance queue, payout path, and daily next action.</p></div><Button asChild className="mt-6 w-full" onClick={() => setManuallyOpen(false)}><Link href="/accounts?onboarding=account">Add my real account<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>}

            {stage === "history" && <div className="p-6 sm:p-8"><DialogHeader><DialogTitle className="text-2xl tracking-[-0.035em]">Where should your history begin?</DialogTitle><DialogDescription>Choose the least-effort path that matches what you already have. You can change it later.</DialogDescription></DialogHeader><div className="mt-6 grid gap-2 sm:grid-cols-3">{[{ id: "csv" as const, icon: FileUp, title: "Import CSV", copy: "Best for complete broker history." }, { id: "screenshot" as const, icon: ScanLine, title: "Scan screenshot", copy: "Review extracted table rows first." }, { id: "start-now" as const, icon: Play, title: "Start today", copy: "Skip history and log forward." }].map(({ id, icon: Icon, title, copy }) => <button key={id} type="button" onClick={() => setSelectedHistory(id)} className={cn("rounded-[2px] border p-4 text-left transition-colors", effectiveHistory === id ? "border-[var(--text)] bg-[var(--raised)]" : "border-[var(--hairline)] hover:bg-[var(--raised)]")}><Icon className="h-4 w-4" /><span className="mt-4 block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{copy}</span></button>)}</div><Button asChild className="mt-6 w-full" aria-disabled={!effectiveHistory} onClick={(event) => { if (!effectiveHistory) { event.preventDefault(); return }; chooseHistoryDestination(); setManuallyOpen(false) }}><Link href={effectiveHistory === "start-now" ? "/today" : `/trades?onboarding=${effectiveHistory}`}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>}

            {stage === "result" && <div className="p-6 sm:p-8"><DialogHeader><p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">{goalResultLabel(state.goal)}</p><DialogTitle className="text-3xl leading-tight tracking-[-0.045em]">{result?.title ?? "Your first daily decision is ready"}</DialogTitle><DialogDescription className="max-w-xl text-sm leading-relaxed">{result?.description ?? "Open Today to review the first trustworthy action from your connected account."}</DialogDescription></DialogHeader><div className="mt-7 border border-[var(--hairline)] bg-[var(--raised)] p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">What was created</p><div className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><span>Verified account context</span><span>Prioritized next action</span><span>Unavailable-safe workspace</span></div></div><Button asChild className="mt-7 w-full" onClick={completeActivation}><Link href={result?.href ?? "/today"}>{result?.action ?? "Open my Today plan"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>}
          </div>}
        </DialogContent>
      </Dialog>
    </>
  )
}
