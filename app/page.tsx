import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Crosshair,
  FileUp,
  Layers3,
  Route,
  ScanLine,
  ShieldCheck,
  WalletCards,
} from "lucide-react"
import { MarketingFooter, MarketingHeader } from "@/components/marketing-header"

const supportedFirms = ["Apex", "Lucid", "Tradeify", "Topstep", "Alpha"]

const differentiators = [
  { icon: Layers3, eyebrow: "Capital routing", title: "Know which account deserves the next trade", copy: "Compare verified loss-room across firms, protect payout-ready capital, and keep blocked accounts out of rotation." },
  { icon: Crosshair, eyebrow: "Behavioral edge", title: "Measure the behavior that actually pays", copy: "Find supported markets, sessions, setups, and process leaks with the sample size shown beside every conclusion." },
  { icon: WalletCards, eyebrow: "Payout intelligence", title: "Stop finding out at the withdrawal screen", copy: "Track cross-firm requirements, payout cycles, consistency, and withdrawal impact before a request is at risk." },
]

const workflow = [
  { icon: FileUp, step: "01", title: "Bring the account you already trade", copy: "Add the account, import CSV history, scan a visible trade table, or start with the next trade. Screenshot rows stay in review until you approve them." },
  { icon: ShieldCheck, step: "02", title: "Resolve the rules that matter", copy: "PropDash maps the supported firm, program, account stage, and drawdown path through one rule engine. Unsupported configurations fail closed." },
  { icon: Route, step: "03", title: "Trade from a prioritized plan", copy: "Open Today to see the closest floor, the next payout gate, accounts worth protecting, and the strongest evidence from your reviewed history." },
]

const comparisonRows = [
  ["Account scope", "One firm and its own accounts", "Every supported firm in one risk queue"],
  ["Payout view", "Current portal requirements", "Readiness, blockers, history, and withdrawal impact"],
  ["Trade context", "Usually fills and account P&L", "Session, setup, process, review coverage, and imports"],
  ["Daily decision", "What happened inside that firm", "Which account deserves risk—and which should be protected"],
]

const faqs = [
  ["Does PropDash replace my firm dashboard?", "No. Firm portals remain the source to confirm live balances and request payouts. PropDash is the cross-firm decision and compliance layer those portals cannot provide."],
  ["Can I start in the middle of an evaluation or funded account?", "Yes. Add the account at its current stage, then import history by CSV, review a screenshot extraction, or continue from the next trade."],
  ["Does it place trades or provide market signals?", "No. PropDash does not execute orders and historical Edge findings are never presented as a market signal. It helps you manage account selection, process, risk, and payout readiness."],
  ["What happens when a rule or value is unavailable?", "PropDash withholds the number and tells you the configuration needs attention. It does not substitute a generic value or display a guess as fact."],
  ["Which firms are supported?", "The current verified workspace covers Apex, Lucid, Tradeify, Topstep, and Alpha programs. Coverage expands only when the rule path can be represented and tested safely."],
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">{children}</p>
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="max-w-3xl"><Eyebrow>{eyebrow}</Eyebrow><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">{title}</h2><p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">{copy}</p></div>
}

function TodayPreview() {
  return (
    <div className="border border-[var(--hairline)] bg-[var(--surface)] p-3">
      <div className="border border-[var(--hairline)] bg-[var(--ground)]">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3"><div><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Illustrative workspace</p><p className="mt-1 text-sm font-medium">Today · cross-firm command</p></div><span className="font-mono text-[10px] text-[var(--muted)]">5 accounts</span></div>
        <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-3">{[["Payout ready", "2"], ["Needs review", "2"], ["Protected", "2"]].map(([label, value]) => <div key={label} className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">{label}</p><p className="mt-2 font-mono text-2xl">{value}</p></div>)}</div>
        <div className="p-4 sm:p-5"><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Capital routing</p><p className="mt-2 text-base font-medium">Best available buffer: Alpha Standard 50K</p><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">Widest verified proportional loss-room among active accounts that are not payout-ready.</p><div className="mt-5 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]"><div className="flex items-center justify-between py-3 text-xs"><span>Alpha Standard 50K</span><span className="text-[var(--muted)]">Available rotation</span></div><div className="flex items-center justify-between py-3 text-xs"><span>Topstep 50K XFA</span><span className="text-[var(--muted)]">Protect payout</span></div><div className="flex items-center justify-between py-3 text-xs"><span>Apex 50K PA</span><span className="text-[var(--muted)]">Review consistency</span></div></div></div>
      </div>
    </div>
  )
}

function LiveProductPreview() {
  return (
    <figure className="border border-[var(--hairline)] bg-[var(--surface)] p-2 sm:p-3">
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-3 py-2.5">
        <div>
          <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Working product</p>
          <p className="mt-1 text-xs font-medium">Today · demo workspace</p>
        </div>
        <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Actual interface</span>
      </div>
      <Image
        src="/product-today-live.png"
        alt="The working PropDash Today dashboard showing a demo workspace, payout readiness, session posture, portfolio metrics, and capital routing"
        width={830}
        height={840}
        className="h-auto w-full"
        priority={false}
      />
      <figcaption className="border-t border-[var(--hairline)] px-3 py-2 text-[10px] leading-relaxed text-[var(--faint)]">
        Captured from the working application with clearly labeled demo data. No outcome or metric is presented as a customer result.
      </figcaption>
    </figure>
  )
}

function EdgePreview() {
  return (
    <div className="border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-4"><div><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Illustrative product preview</p><p className="mt-1 text-sm font-medium">Edge brief</p></div><span className="border border-[var(--hairline)] bg-[var(--raised)] px-2 py-1 font-mono text-[9px] text-[var(--muted)]">90 days</span></div>
      <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-3"><div className="bg-[var(--surface)] p-4 sm:col-span-2"><p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Evidence-backed strength</p><p className="mt-3 text-lg font-medium">Repeat opening-range setups</p><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">Supported by 12 reviewed records. Sample size remains visible beside the finding.</p></div><div className="bg-[var(--surface)] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Coverage</p><p className="mt-3 font-mono text-2xl">86%</p><p className="mt-2 text-xs text-[var(--muted)]">Session or setup captured</p></div></div>
      <div className="mt-px grid gap-px bg-[var(--hairline)] sm:grid-cols-2"><div className="bg-[var(--raised)] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Process tax</p><p className="mt-2 text-sm font-medium">Failed-breakdown chasing</p><p className="mt-1 text-xs text-[var(--muted)]">Measured only from tagged records</p></div><div className="bg-[var(--raised)] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Concentration</p><p className="mt-2 text-sm font-medium">NQ · 2 accounts</p><p className="mt-1 text-xs text-[var(--muted)]">Same-day activity, not assumed overlap</p></div></div>
    </div>
  )
}

function PayoutPreview() {
  const requirements = [["Winning-day requirement", "Met"], ["Consistency requirement", "Review"], ["Minimum payout", "Met"], ["Firm portal confirmation", "Required"]]
  return (
    <div className="border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] pb-4"><div><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Illustrative product preview</p><p className="mt-1 text-sm font-medium">Withdrawal readiness</p></div><span className="border border-[var(--hairline)] bg-[var(--raised)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Live rules</span></div>
      <div className="divide-y divide-[var(--hairline)]">{requirements.map(([label, status]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3"><span className="text-xs">{label}</span><span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{status}</span></div>)}</div>
      <div className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2"><div className="bg-[var(--raised)] p-4"><p className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">Next action</p><p className="mt-2 text-sm font-medium">Review consistency</p></div><div className="bg-[var(--raised)] p-4"><p className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">Before request</p><p className="mt-2 text-sm font-medium">Confirm firm portal</p></div></div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />
      <main>
        <section className="border-b border-[var(--hairline)]"><div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1.02fr)_minmax(440px,.98fr)] lg:items-center lg:py-28"><div><Eyebrow>The operating system for funded traders</Eyebrow><h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl">Your prop firms show accounts. PropDash shows the next move.</h1><p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">One cross-firm command center for protecting funded accounts, routing risk, importing existing history, and reaching payouts without avoidable denials.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/auth/login?mode=signup" className="flex h-11 items-center justify-center gap-2 rounded-[2px] bg-white px-5 text-sm font-medium text-black hover:bg-white/90">Start free<ArrowRight className="h-4 w-4" /></Link><Link href="#product" className="flex h-11 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-5 text-sm text-[var(--muted)] hover:border-[var(--faint)] hover:text-white">See how it works</Link></div><p className="mt-4 text-[11px] text-[var(--faint)]">Start with two accounts · CSV importing included · no credit card required</p></div><TodayPreview /></div></section>

        <section className="border-b border-[var(--hairline)]"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 py-7 sm:px-8 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[9px] uppercase tracking-[0.17em] text-[var(--faint)]">Verified coverage today</p><p className="mt-1 text-xs text-[var(--muted)]">Built for traders managing capital across firms—not a single-firm replacement.</p></div><div className="grid grid-cols-3 gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:flex">{supportedFirms.map((firm) => <span key={firm} className="bg-[var(--surface)] px-4 py-2 text-center text-xs sm:min-w-24">{firm}</span>)}</div></div></section>

        <section id="edge" className="border-b border-[var(--hairline)]"><div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-24"><SectionIntro eyebrow="The reason to add PropDash" title="The data is not the edge. The decision layer is." copy="Firm dashboards are essential, but they stop at their own account. PropDash joins every firm with your behavior and payout state, then turns it into a prioritized operating plan." /><div className="mt-10 overflow-hidden border border-[var(--hairline)]"><div className="grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[var(--hairline)] bg-[var(--raised)] px-4 py-3 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] sm:grid-cols-[180px_1fr_1fr]"><span>Question</span><span>Firm dashboard</span><span>PropDash adds</span></div>{comparisonRows.map(([question, firm, propdash]) => <div key={question} className="grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)] gap-px border-b border-[var(--hairline)] bg-[var(--hairline)] last:border-0 sm:grid-cols-[180px_1fr_1fr]"><div className="bg-[var(--surface)] p-4 text-xs font-medium">{question}</div><div className="bg-[var(--surface)] p-4 text-xs leading-relaxed text-[var(--muted)]">{firm}</div><div className="bg-[var(--surface)] p-4 text-xs leading-relaxed">{propdash}</div></div>)}</div><div className="mt-8 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] lg:grid-cols-3">{differentiators.map(({ icon: Icon, eyebrow, title, copy }) => <article key={title} className="bg-[var(--surface)] p-6 sm:p-7"><span className="flex h-9 w-9 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><Icon className="h-4 w-4" /></span><p className="mt-6 text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">{eyebrow}</p><h3 className="mt-2 text-lg font-medium leading-snug">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{copy}</p></article>)}</div></div></section>

        <section id="product" className="border-b border-[var(--hairline)]"><div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-24"><SectionIntro eyebrow="One daily operating layer" title="From scattered account data to one defensible next move." copy="Each workspace answers a different decision. Together they protect the account before, during, and after the trading day." /><div className="mt-12 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]"><div className="grid gap-10 py-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center"><div><span className="flex h-9 w-9 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><Route className="h-4 w-4" /></span><p className="mt-6 text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Today</p><h3 className="mt-2 text-2xl font-medium tracking-[-0.035em]">Start with the account decision, not another chart.</h3><p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">See payout-ready accounts, urgent checks, verified floor room, session boundaries, and the best available account for rotation before logging the next trade.</p></div><LiveProductPreview /></div><div className="grid gap-10 py-12 lg:grid-cols-[1.2fr_.8fr] lg:items-center"><EdgePreview /><div><span className="flex h-9 w-9 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><Crosshair className="h-4 w-4" /></span><p className="mt-6 text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Edge</p><h3 className="mt-2 text-2xl font-medium tracking-[-0.035em]">Know what is repeatable—and what is quietly costing you.</h3><p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">Rank performance by market, session, setup, and process. Every conclusion carries its record count, and insufficient evidence stays insufficient.</p></div></div><div className="grid gap-10 py-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><span className="flex h-9 w-9 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><WalletCards className="h-4 w-4" /></span><p className="mt-6 text-[9px] uppercase tracking-[0.16em] text-[var(--faint)]">Payouts</p><h3 className="mt-2 text-2xl font-medium tracking-[-0.035em]">Treat the withdrawal like a process, not a surprise.</h3><p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">Review verified requirements, model the post-request account, preserve payout history, and keep portal confirmation explicit before recording a withdrawal.</p></div><PayoutPreview /></div></div></div></section>

        <section id="workflow" className="border-b border-[var(--hairline)]"><div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-24"><SectionIntro eyebrow="Start from where you are" title="An active account should take minutes to onboard—not weeks to recreate." copy="PropDash is designed for traders already inside an evaluation, funded account, or multi-firm portfolio." /><div className="mt-10 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] lg:grid-cols-3">{workflow.map(({ icon: Icon, step, title, copy }) => <article key={step} className="bg-[var(--surface)] p-6 sm:p-7"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><Icon className="h-4 w-4" /></span><span className="font-mono text-[10px] text-[var(--faint)]">{step}</span></div><h3 className="mt-7 text-lg font-medium">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{copy}</p></article>)}</div><div className="mt-6 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3"><div className="flex items-center gap-3 bg-[var(--raised)] p-4 text-xs"><FileUp className="h-4 w-4 text-[var(--muted)]" />CSV history</div><div className="flex items-center gap-3 bg-[var(--raised)] p-4 text-xs"><ScanLine className="h-4 w-4 text-[var(--muted)]" />Reviewed screenshot extraction</div><div className="flex items-center gap-3 bg-[var(--raised)] p-4 text-xs"><BookOpenCheck className="h-4 w-4 text-[var(--muted)]" />Fast manual log</div></div></div></section>

        <section id="trust" className="border-b border-[var(--hairline)]"><div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:items-start"><SectionIntro eyebrow="Built to earn trust" title="Confident when verified. Silent when unavailable." copy="A polished interface is worthless if it makes a dangerous number look certain. PropDash is deliberately conservative wherever the source or configuration is incomplete." /><div className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2">{["Rules resolve through one verified engine", "Uncertain screenshot rows require review", "Unavailable values never masquerade as real", "Firm portal confirmation remains explicit", "Historical evidence is not a market signal", "Exports preserve missing fields as blank"].map((item) => <div key={item} className="flex gap-3 bg-[var(--surface)] p-5 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" /><span>{item}</span></div>)}</div></div></section>

        <section className="border-b border-[var(--hairline)]"><div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[.8fr_1.2fr]"><div><Eyebrow>Simple access</Eyebrow><h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em]">Prove the workflow free. Upgrade when the portfolio grows.</h2><p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">Starter includes the daily command center, verified rule tracking, CSV history, and Edge across two accounts.</p><Link href="/pricing" className="mt-6 inline-flex items-center gap-2 text-sm font-medium">Compare every plan<ArrowRight className="h-4 w-4" /></Link></div><div className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2"><div className="bg-[var(--surface)] p-6"><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">Starter</p><p className="mt-4 font-mono text-4xl">$0</p><p className="mt-2 text-xs text-[var(--muted)]">2 accounts · CSV included</p></div><div className="bg-[var(--surface)] p-6"><p className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">Pro</p><p className="mt-4 font-mono text-4xl">$29</p><p className="mt-2 text-xs text-[var(--muted)]">10 accounts · deeper importing</p></div></div></div></section>

        <section className="border-b border-[var(--hairline)]"><div className="mx-auto max-w-[980px] px-5 py-20 sm:px-8 sm:py-24"><SectionIntro eyebrow="Questions before you trust it" title="Clear answers, before you connect an account." copy="PropDash complements the systems you already use and stays explicit about where its responsibility ends." /><div className="mt-10 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">{faqs.map(([question, answer]) => <details key={question} className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-sm font-medium"><span>{question}</span><span className="font-mono text-[var(--faint)] group-open:hidden">+</span><span className="hidden font-mono text-[var(--faint)] group-open:inline">−</span></summary><p className="max-w-3xl pb-5 pr-10 text-sm leading-relaxed text-[var(--muted)]">{answer}</p></details>)}</div></div></section>

        <section><div className="mx-auto max-w-[900px] px-5 py-20 text-center sm:px-8 sm:py-24"><ShieldCheck className="mx-auto h-6 w-6" /><h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Protect the account. Prove the edge. Request the payout.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">Start with real history from the account you already trade. PropDash handles the operating layer your firm dashboard cannot see.</p><Link href="/auth/login?mode=signup" className="mx-auto mt-7 flex h-11 w-fit items-center gap-2 rounded-[2px] bg-white px-5 text-sm font-medium text-black">Start free<ArrowRight className="h-4 w-4" /></Link></div></section>
      </main>
      <MarketingFooter />
    </div>
  )
}
