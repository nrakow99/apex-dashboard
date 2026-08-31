"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

export function ReviewTabs() {
  const searchParams = useSearchParams()
  const active = searchParams.get("tab") === "edge" ? "edge" : "history"
  return <nav className="mb-6 grid grid-cols-2 gap-px border border-[var(--hairline)] bg-[var(--hairline)]" aria-label="Review workspace">
    <Link href="/review" className={cn("bg-[var(--surface)] px-4 py-3 text-center text-xs transition-colors", active === "history" ? "bg-white font-medium text-black" : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-white")}>History &amp; imports</Link>
    <Link href="/review?tab=edge" className={cn("bg-[var(--surface)] px-4 py-3 text-center text-xs transition-colors", active === "edge" ? "bg-white font-medium text-black" : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-white")}>Edge &amp; behavior</Link>
  </nav>
}
