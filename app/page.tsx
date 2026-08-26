import Link from "next/link"
import { ArrowRight, Check, Crosshair, Layers3, ShieldCheck, WalletCards } from "lucide-react"
import { MarketingFooter, MarketingHeader } from "@/components/marketing-header"

const differentiators = [
  {
    icon: Layers3,
    eyebrow: "Capital routing",
    title: "Know which account deserves the next trade",
    copy: "Compare verified loss-room across firms, protect payout-ready capital, and keep blocked accounts out of rotation.",
  },
  {
    icon: Crosshair,
    eyebrow: "Behavioral edge",
    title: "Measure the behavior that actually pays",
    copy: "Find supported markets, sessions, setups, and process leaks with the sample size shown beside every conclusion.",
  },
  {
    icon: WalletCards,
    eyebrow: "Payout intelligence",
    title: "Stop finding out at the withdrawal screen",
    copy: "Track cross-firm requirements, payout cycles, consistency, and withdrawal impact before a request is at risk.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />
      <main>
        <section className="border-b border-[var(--hairline)]">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,.95fr)] lg:items-center lg:py-28">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">The operating system for funded traders</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl">Your prop firms show accounts. PropDash shows the next move.</h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">One cross-firm command center for protecting funded accounts, routing risk, importing existing history, and reaching payouts without avoidable denials.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth/login?mode=signup" className="flex h-11 items-center justify-center gap-2 rounded-[2px] bg-white px-5 text-sm font-medium text-black hover:bg-white/90">Start free<ArrowRight className="h-4 w-4" /></Link>
                <Link href="/pricing" className="flex h-11 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-5 text-sm text-[var(--muted)] hover:border-[var(--faint)] hover:text-white">See plans</Link>
              </div>
              <p className="mt-4 text-[11px] text-[var(--faint)]">Start with two accounts · CSV importing included · no credit card required</p>
            </div>

            <div className="border border-[var(--hairline)] bg-[var(--surface)] p-3">
              <div className="border border-[var(--hairline)] bg-black">
                <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3"><div><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Today</p><p className="mt-1 text-sm font-medium">Cross-firm command center</p></div><span className="font-mono text-[10px] text-[var(--muted)]">5 accounts</span></div>
                <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-3"><div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">Payout ready</p><p className="mt-2 font-mono text-2xl">2</p></div><div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">Protected</p><p className="mt-2 font-mono text-2xl">2</p></div><div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">Urgent</p><p className="mt-2 font-mono text-2xl">0</p></div></div>
                <div className="p-4"><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Capital routing</p><p className="mt-2 text-base font-medium">Best available buffer: Alpha Standard 50K</p><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">Widest verified proportional loss-room among active accounts that are not payout-ready.</p><div className="mt-4 h-px bg-[var(--hairline)]" /><div className="mt-4 grid gap-2"><div className="flex items-center justify-between bg-[var(--raised)] px-3 py-3 text-xs"><span>Apex 50K PA</span><span className="font-mono">$1,775 room</span></div><div className="flex items-center justify-between bg-[var(--raised)] px-3 py-3 text-xs"><span>Topstep 50K XFA</span><span className="text-[var(--muted)]">Protect payout</span></div></div></div>
              </div>
            </div>
          </div>
        </section>

        <section id="edge" className="border-b border-[var(--hairline)]">
          <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8">
            <div className="max-w-3xl"><p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">The reason to switch</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">The data is not the edge. The decision layer is.</h2><p className="mt-4 text-base leading-relaxed text-[var(--muted)]">Firm dashboards stop at their own account. PropDash joins every firm with your behavior and payout state, then turns it into a prioritized operating plan.</p></div>
            <div className="mt-10 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] lg:grid-cols-3">
              {differentiators.map(({ icon: Icon, eyebrow, title, copy }) => <article key={title} className="bg-[var(--surface)] p-6 sm:p-7"><span className="flex h-9 w-9 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><Icon className="h-4 w-4" /></span><p className="mt-6 text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">{eyebrow}</p><h3 className="mt-2 text-lg font-medium leading-snug">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{copy}</p></article>)}
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--hairline)]">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div><p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Built to earn trust</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em]">Confident when verified. Silent when unavailable.</h2></div>
            <div className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2">
              {["Rules resolve through one verified engine", "Uncertain screenshot rows require review", "Unavailable values never masquerade as real", "Apex, Lucid, Tradeify, Topstep, and Alpha"].map((item) => <div key={item} className="flex gap-3 bg-[var(--surface)] p-5 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" /><span>{item}</span></div>)}
            </div>
          </div>
        </section>

        <section><div className="mx-auto max-w-[900px] px-5 py-20 text-center sm:px-8"><ShieldCheck className="mx-auto h-6 w-6" /><h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Protect the account. Prove the edge. Request the payout.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">Start with real history from the account you already trade. PropDash handles the operating layer your firm dashboard cannot see.</p><Link href="/auth/login?mode=signup" className="mx-auto mt-7 flex h-11 w-fit items-center gap-2 rounded-[2px] bg-white px-5 text-sm font-medium text-black">Start free<ArrowRight className="h-4 w-4" /></Link></div></section>
      </main>
      <MarketingFooter />
    </div>
  )
}
