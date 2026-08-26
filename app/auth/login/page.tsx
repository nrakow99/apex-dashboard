"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "login" | "signup" | "magic" | "reset"

export default function LoginPage() {
  return <Suspense fallback={null}><LoginContent /></Suspense>
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(() => searchParams.get("mode") === "signup" ? "signup" : "login")
  const supabase = createClient()

  const resetFeedback = () => { setError(null); setMessage(null) }
  const switchMode = (next: Mode) => { setMode(next); resetFeedback() }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    resetFeedback()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setIsLoading(false)
      return
    }
    router.replace("/today")
    router.refresh()
  }

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    resetFeedback()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` },
    })
    setIsLoading(false)
    if (signUpError) setError(signUpError.message)
    else setMessage("Check your email to confirm the account, then return here to sign in.")
  }

  const handleMagicLink = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    resetFeedback()
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` },
    })
    setIsLoading(false)
    if (magicError) setError(magicError.message)
    else setMessage("Check your email for a secure sign-in link.")
  }

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    resetFeedback()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })
    setIsLoading(false)
    if (resetError) setError(resetError.message)
    else setMessage("Check your email for a password-reset link.")
  }

  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Build your command center" : mode === "magic" ? "Email a sign-in link" : "Reset your password"
  const description = mode === "login" ? "Open your cross-firm workspace." : mode === "signup" ? "Start free with two tracked accounts." : mode === "magic" ? "No password required." : "We will send a secure reset link."

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,.9fr)_minmax(480px,.7fr)]">
        <section className="hidden border-r border-[var(--hairline)] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <Link href="/" className="flex w-fit items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]"><ShieldCheck className="h-4 w-4" /></span><span className="font-semibold">PropDash</span></Link>
          <div className="max-w-xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">The funded-trader operating system</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.05em] xl:text-5xl">Trade the account with the best reason—not the loudest impulse.</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--muted)]">PropDash joins verified payout rules, real history, and cross-firm risk into one daily decision layer.</p>
            <div className="mt-8 space-y-3">{["Protect payout-ready accounts", "Route capital by verified loss-room", "Measure behavior across every firm"].map((item) => <div key={item} className="flex items-center gap-3 border-t border-[var(--hairline)] pt-3 text-sm"><Check className="h-4 w-4 text-[var(--muted)]" />{item}</div>)}</div>
          </div>
          <p className="text-[10px] text-[var(--faint)]">Unavailable values are withheld. Historical evidence is never presented as a market signal.</p>
        </section>

        <main className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[440px]">
            <div className="mb-10 flex items-center justify-between lg:hidden"><Link href="/" className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" />PropDash</Link><Link href="/" className="flex items-center gap-1 text-xs text-[var(--muted)]"><ArrowLeft className="h-3.5 w-3.5" />Home</Link></div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Secure workspace</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">{title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>

            {error && <div role="alert" className="mt-6 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">{error}</div>}
            {message && <div role="status" className="mt-6 border border-[var(--hairline)] bg-[var(--raised)] px-4 py-3 text-sm leading-relaxed">{message}</div>}

            <form className="mt-7" onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignUp : mode === "magic" ? handleMagicLink : handlePasswordReset}>
              <div className="space-y-5">
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                {(mode === "login" || mode === "signup") && <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Password</Label>{mode === "login" && <button type="button" onClick={() => switchMode("reset")} className="text-[10px] text-[var(--muted)] hover:text-white">Forgot password?</button>}</div><Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></div>}
                <Button type="submit" className="h-11 w-full" disabled={isLoading}>{isLoading && <Loader2 className="animate-spin" />}{mode === "login" ? "Sign in" : mode === "signup" ? "Create free account" : mode === "magic" ? "Send secure link" : "Send reset link"}</Button>
              </div>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--muted)]">
              {mode === "login" && <><button type="button" onClick={() => switchMode("magic")} className="hover:text-white">Use magic link</button><span className="text-[var(--faint)]">·</span><button type="button" onClick={() => switchMode("signup")} className="hover:text-white">Create an account</button></>}
              {mode !== "login" && <button type="button" onClick={() => switchMode("login")} className="hover:text-white">Return to sign in</button>}
            </div>
            <p className="mt-8 border-t border-[var(--hairline)] pt-5 text-[10px] leading-relaxed text-[var(--faint)]">By continuing, you acknowledge that PropDash is a tracking and decision-support product, not a broker or source of trade signals.</p>
          </div>
        </main>
      </div>
    </div>
  )
}
