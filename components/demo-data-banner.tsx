import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Account } from "@/lib/types"

export function DemoDataBanner({ accounts }: { accounts: readonly Account[] }) {
  const demoCount = accounts.filter((account) => account.name.startsWith("DEMO ·")).length
  if (demoCount === 0) return null
  const realCount = accounts.length - demoCount
  return (
    <div className="mb-5 flex flex-col gap-3 border-l-2 border-white bg-[var(--raised)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium">Demo workspace</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
          {demoCount} example account{demoCount === 1 ? " is" : "s are"} included so you can explore the product. {realCount > 0 ? `${realCount} real account${realCount === 1 ? " is" : "s are"} kept separate.` : "Add a real account before relying on this workspace for decisions."}
        </p>
      </div>
      <Link href="/accounts" className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--muted)] hover:text-white">Manage accounts<ArrowUpRight className="h-3.5 w-3.5" /></Link>
    </div>
  )
}
