"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Command, Layers3, LayoutDashboard, Search, Settings, WalletCards } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { cn } from "@/lib/utils"

const destinations = [
  { href: "/today", label: "Today", description: "Daily risk and next actions", icon: LayoutDashboard },
  { href: "/today?log=1", label: "Quick log a trade", description: "Account, symbol, and net P&L", icon: Command },
  { href: "/accounts", label: "Accounts", description: "Balances, floors, and account details", icon: Layers3 },
  { href: "/payouts", label: "Payouts", description: "Readiness, scenarios, and ledger", icon: WalletCards },
  { href: "/review", label: "Review", description: "Trade history, imports, behavior, and Edge", icon: BookOpen },
  { href: "/settings", label: "Settings", description: "Risk defaults, data, and workspace", icon: Settings },
]

export function CommandMenu() {
  const { accounts } = useDashboardData()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const normalized = query.trim().toLowerCase()
  const matches = useMemo(() => destinations.filter((item) =>
    !normalized || `${item.label} ${item.description}`.toLowerCase().includes(normalized),
  ), [normalized])
  const accountMatches = useMemo(() => accounts.filter((account) =>
    !normalized || `${account.name} ${account.firm} ${account.type}`.toLowerCase().includes(normalized),
  ).slice(0, 8), [accounts, normalized])

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex h-10 w-full items-center gap-2 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 text-left text-xs text-[var(--muted)] transition-colors hover:border-[var(--faint)] hover:text-white">
      <Search className="h-3.5 w-3.5" />
      <span>Search or jump</span>
      <span className="ml-auto border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[9px]">⌘K</span>
    </button>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden rounded-[2px] border-[var(--hairline)] bg-[var(--surface)] p-0 sm:max-w-[620px]">
        <DialogTitle className="sr-only">Search PropDash</DialogTitle>
        <DialogDescription className="sr-only">Jump to a page, action, or account.</DialogDescription>
        <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4">
          <Search className="h-4 w-4 text-[var(--muted)]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, actions, or accounts" className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--faint)]" />
          <span className="font-mono text-[9px] text-[var(--faint)]">ESC</span>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-2">
          {matches.length > 0 && <div>
            <p className="px-2 pb-2 pt-1 text-[9px] uppercase tracking-[0.17em] text-[var(--faint)]">Go or do</p>
            {matches.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-[2px] px-3 py-2.5 transition-colors hover:bg-[var(--raised)] focus:bg-[var(--raised)] focus:outline-none">
              <span className="flex h-8 w-8 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><Icon className="h-4 w-4" /></span>
              <span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--muted)]">{description}</span></span>
            </Link>)}
          </div>}
          {accountMatches.length > 0 && <div className={cn(matches.length > 0 && "mt-3 border-t border-[var(--hairline)] pt-2")}>
            <p className="px-2 pb-2 pt-1 text-[9px] uppercase tracking-[0.17em] text-[var(--faint)]">Accounts</p>
            {accountMatches.map((account) => <Link key={account.id} href={`/accounts?account=${account.id}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-4 rounded-[2px] px-3 py-2.5 transition-colors hover:bg-[var(--raised)] focus:bg-[var(--raised)] focus:outline-none">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{account.name}</span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{account.firm} · {account.type}</span></span>
              <span className="text-[10px] text-[var(--faint)]">Open</span>
            </Link>)}
          </div>}
          {matches.length === 0 && accountMatches.length === 0 && <div className="px-4 py-12 text-center"><p className="text-sm">No match found</p><p className="mt-1 text-xs text-[var(--muted)]">Try an account name, firm, or action.</p></div>}
        </div>
      </DialogContent>
    </Dialog>
  </>
}
