"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen, Crosshair, Layers3, LayoutDashboard, LogOut, Plus, Settings, ShieldAlert, ShieldCheck, WalletCards } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { OnboardingGuide } from "@/components/onboarding-guide"
import { CommandMenu } from "@/components/command-menu"
import { ThemeToggle } from "@/components/theme-toggle"

interface AppShellProps {
  eyebrow?: string
  title: string
  description?: string
  leading?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

const navigation = [
  { section: "Command", items: [
    { href: "/today", label: "Today", icon: LayoutDashboard },
    { href: "/compliance", label: "Compliance", icon: ShieldAlert },
    { href: "/accounts", label: "Accounts", icon: Layers3 },
  ] },
  { section: "Review", items: [
    { href: "/trades", label: "Trades", icon: BookOpen },
    { href: "/analytics", label: "Edge", icon: Crosshair },
  ] },
  { section: "Capital", items: [
    { href: "/payouts", label: "Payouts", icon: WalletCards },
  ] },
  { section: "System", items: [
    { href: "/settings", label: "Settings", icon: Settings },
  ] },
]

const mobileNavigation = navigation.flatMap((group) => group.items)

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({ eyebrow, title, description, leading, actions, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/auth/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[var(--ground)] text-[var(--text)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-[var(--hairline)] bg-[var(--surface)] lg:flex lg:flex-col">
        <div className="flex h-[86px] items-center gap-3 border-b border-[var(--hairline)] px-7">
          <span className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">PropDash</p>
            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Payout intelligence</p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <CommandMenu />
          <Link href="/today?log=1" className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[2px] bg-white px-3 text-xs font-medium text-black transition-colors hover:bg-white/90">
            <Plus className="h-3.5 w-3.5" /> Quick log
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Primary navigation">
          {navigation.map((group, groupIndex) => (
            <div key={group.section} className={cn(groupIndex > 0 && "mt-5")}>
              <p className="mb-2 px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">{group.section}</p>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActivePath(pathname, href)
                  return (
                    <Link key={href} href={href} className={cn("group flex h-10 items-center gap-3 rounded-[2px] px-3 text-sm transition-colors", active ? "bg-[var(--raised)] font-medium text-white" : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-white")}>
                      <Icon className={cn("h-[17px] w-[17px]", active ? "text-white" : "text-[var(--faint)] group-hover:text-white")} />
                      {label}
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-[2px] bg-white" aria-hidden />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--hairline)] p-4">
          <ThemeToggle showLabel className="mb-1 border-transparent bg-transparent" />
          <button onClick={signOut} className="flex h-11 w-full items-center gap-3 rounded-[2px] px-3 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--raised)] hover:text-white">
            <LogOut className="h-[17px] w-[17px]" />
            Sign out
          </button>
        </div>
      </aside>

      <OnboardingGuide />

      <div className="lg:pl-[248px]">
        <div className="border-b border-[var(--hairline)] bg-black lg:hidden">
          <div className="flex h-12 items-center gap-2 px-4">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-semibold">PropDash</span>
            <span className="ml-auto text-[8px] uppercase tracking-[0.16em] text-[var(--muted)]">Payout intelligence</span>
            <ThemeToggle className="h-8 w-8" />
          </div>
          <div className="flex h-12 items-center gap-1 overflow-x-auto border-t border-[var(--hairline)] px-2" aria-label="Mobile navigation">
            {mobileNavigation.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href)
              return <Link key={href} href={href} className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-[2px] px-3 text-xs", active ? "bg-[var(--raised)] text-white" : "text-[var(--muted)]")}><Icon className="h-3.5 w-3.5" />{label}</Link>
            })}
          </div>
        </div>

        <header className="border-b border-[var(--hairline)]">
          <div className="mx-auto flex min-h-[112px] max-w-[1560px] flex-col justify-center gap-5 px-5 py-5 sm:px-8 lg:px-10 xl:flex-row xl:items-center xl:justify-between xl:py-0">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {leading}
              <div className="min-w-0">
              {eyebrow && <p className="text-[9px] font-medium uppercase tracking-[0.19em] text-[var(--muted)]">{eyebrow}</p>}
              <h1 className="mt-1 truncate text-[28px] font-semibold tracking-[-0.045em] sm:text-[34px]">{title}</h1>
              {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
              </div>
            </div>
            {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 xl:w-auto xl:justify-end">{actions}</div>}
          </div>
        </header>

        <main className="mx-auto max-w-[1560px] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
