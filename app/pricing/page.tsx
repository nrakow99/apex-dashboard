import Link from "next/link"
import { Check } from "lucide-react"
import { MarketingFooter, MarketingHeader } from "@/components/marketing-header"
import { formatAccountLimit, SUBSCRIPTION_PLANS } from "@/lib/subscriptions"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />
      <main>
        <section className="border-b border-[var(--hairline)]"><div className="mx-auto max-w-[900px] px-5 py-16 text-center sm:px-8 sm:py-20"><p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Simple monthly access</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Start small. Upgrade when the edge pays for itself.</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)]">No annual lock-in. CSV importing stays free. Screenshot allowances count images reviewed each month.</p></div></section>
        <section><div className="mx-auto grid max-w-[1280px] gap-px bg-[var(--hairline)] px-5 py-16 sm:px-8 lg:grid-cols-3 lg:bg-transparent lg:gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => <article key={plan.tier} className={`flex flex-col border bg-[var(--surface)] p-6 sm:p-7 ${plan.highlighted ? "border-white" : "border-[var(--hairline)]"}`}>
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">{plan.name}</h2>{plan.highlighted && <span className="border border-[var(--hairline)] bg-white px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-black">Best value</span>}</div>
            <p className="mt-3 min-h-10 text-sm leading-relaxed text-[var(--muted)]">{plan.description}</p>
            <p className="mt-7"><span className="font-mono text-4xl font-medium">${plan.priceMonthly}</span><span className="ml-2 text-xs text-[var(--muted)]">/ month</span></p>
            <div className="mt-6 grid grid-cols-2 gap-px border border-[var(--hairline)] bg-[var(--hairline)]"><div className="bg-[var(--raised)] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--faint)]">Accounts</p><p className="mt-1 font-mono text-sm">{formatAccountLimit(plan.accountLimit)}</p></div><div className="bg-[var(--raised)] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[var(--faint)]">Scan images</p><p className="mt-1 font-mono text-sm">{plan.screenshotMonthlyLimit} / mo</p></div></div>
            <ul className="mt-6 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2.5 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" /><span>{feature}</span></li>)}</ul>
            <Link href="/auth/login?mode=signup" className={`mt-8 flex h-11 items-center justify-center rounded-[2px] text-sm font-medium ${plan.highlighted ? "bg-white text-black" : "border border-[var(--hairline)] bg-[var(--raised)] text-white hover:border-[var(--faint)]"}`}>{plan.priceMonthly === 0 ? "Start free" : "Start free, upgrade later"}</Link>
          </article>)}
        </div></section>
        <section className="border-t border-[var(--hairline)]"><div className="mx-auto max-w-[900px] px-5 py-14 text-center sm:px-8"><p className="text-sm font-medium">Billing is being finalized during the founding beta.</p><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">You can create an account and use the Starter workflow now. Paid checkout will activate only after subscription handling and customer support paths are fully tested.</p></div></section>
      </main>
      <MarketingFooter />
    </div>
  )
}
