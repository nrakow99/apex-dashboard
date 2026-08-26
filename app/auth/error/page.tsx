import Link from "next/link"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-black px-5 py-12 text-white">
      <ThemeToggle className="absolute right-5 top-5" />
      <section className="w-full max-w-[520px] border border-[var(--hairline)] bg-[var(--surface)] p-6 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center border border-[var(--hairline)] bg-[var(--raised)]"><AlertCircle className="h-4 w-4" /></span>
        <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Authentication</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">The sign-in link could not be completed</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Request a new magic link or sign in with your password. No workspace data was changed.</p>
        {params.error && <p className="mt-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 font-mono text-xs">{params.error}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row"><Link href="/auth/login" className="flex h-10 items-center justify-center rounded-[2px] bg-white px-4 text-sm font-medium text-black">Return to sign in</Link><Link href="/" className="flex h-10 items-center justify-center gap-1.5 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-4 text-sm text-[var(--muted)]"><ArrowLeft className="h-3.5 w-3.5" />Back home</Link></div>
      </section>
    </main>
  )
}
