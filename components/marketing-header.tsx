import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export async function MarketingHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (
    <header className="border-b border-[var(--hairline)] bg-black">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]"><ShieldCheck className="h-4 w-4" /></span>
          <span className="font-semibold tracking-[-0.02em]">PropDash</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-xs text-[var(--muted)] sm:flex" aria-label="Marketing navigation">
          <Link href="/#edge" className="hover:text-white">Why PropDash</Link>
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {user ? <Link href="/today" className="flex h-9 items-center rounded-[2px] bg-white px-4 text-xs font-medium text-black hover:bg-white/90">Open dashboard</Link> : <><Link href="/auth/login" className="flex h-9 items-center px-3 text-xs text-[var(--muted)] hover:text-white">Sign in</Link><Link href="/auth/login?mode=signup" className="flex h-9 items-center rounded-[2px] bg-white px-4 text-xs font-medium text-black hover:bg-white/90">Start free</Link></>}
        </div>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-black">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-8 text-[11px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>PropDash · Cross-firm payout intelligence</p>
        <div className="flex gap-5"><Link href="/pricing" className="hover:text-white">Pricing</Link><Link href="/auth/login" className="hover:text-white">Sign in</Link></div>
      </div>
    </footer>
  )
}
