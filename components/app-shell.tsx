"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Layers3, LogOut, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface AppShellProps {
  eyebrow?: string
  title: string
  description?: string
  leading?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

const navigation = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/", label: "Accounts", icon: Layers3 },
]

export function AppShell({ eyebrow, title, description, leading, actions, children }: AppShellProps) {
  const pathname = usePathname()

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  return (
    <div className="min-h-screen bg-[var(--ground)] text-[var(--text)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-[var(--hairline)] bg-[#080809] lg:flex lg:flex-col">
        <div className="flex h-[86px] items-center gap-3 border-b border-[var(--hairline)] px-7">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#2B2B2E] bg-[#151517]">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">PropDash</p>
            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Payout intelligence</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6" aria-label="Primary navigation">
          <p className="mb-2 px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">Workspace</p>
          <div className="space-y-1">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group flex h-11 items-center gap-3 rounded-[9px] px-3 text-sm transition-colors",
                    active ? "bg-[#18181A] font-medium text-white" : "text-[var(--muted)] hover:bg-[#111113] hover:text-white",
                  )}
                >
                  <Icon className={cn("h-[17px] w-[17px]", active ? "text-white" : "text-[var(--faint)] group-hover:text-white")} />
                  {label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" aria-hidden />}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="border-t border-[var(--hairline)] p-4">
          <button onClick={signOut} className="flex h-11 w-full items-center gap-3 rounded-[9px] px-3 text-sm text-[var(--muted)] transition-colors hover:bg-[#111113] hover:text-white">
            <LogOut className="h-[17px] w-[17px]" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <div className="border-b border-[var(--hairline)] bg-black lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <span className="text-sm font-semibold">PropDash</span>
            <div className="flex items-center gap-1">
              {navigation.map(({ href, label }) => (
                <Link key={href} href={href} className={cn("rounded-[7px] px-3 py-2 text-xs", pathname === href ? "bg-[#18181A] text-white" : "text-[var(--muted)]")}>{label}</Link>
              ))}
            </div>
          </div>
        </div>

        <header className="border-b border-[var(--hairline)]">
          <div className="mx-auto flex min-h-[112px] max-w-[1560px] flex-col justify-center gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-0">
            <div className="flex min-w-0 items-center gap-3">
              {leading}
              <div className="min-w-0">
              {eyebrow && <p className="text-[9px] font-medium uppercase tracking-[0.19em] text-[var(--muted)]">{eyebrow}</p>}
              <h1 className="mt-1 truncate text-[28px] font-semibold tracking-[-0.045em] sm:text-[34px]">{title}</h1>
              {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
              </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </header>

        <main className="mx-auto max-w-[1560px] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
