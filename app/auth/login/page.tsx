"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<"login" | "signup" | "magic">("login")

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      window.location.href = "/today"
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setMessage("Check your email for the confirmation link.")
      setIsLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setMessage("Check your email for the magic link.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen premium-shell flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 rounded-[28px] glass-card">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="36" height="36" rx="10" fill="#0F1115"/>
              <rect x="0.5" y="0.5" width="35" height="35" rx="9.5" stroke="rgba(83,104,120,0.40)" strokeWidth="1"/>
              <rect x="10" y="11" width="16" height="2.5" rx="1.25" fill="#94AAB8" opacity="0.7"/>
              <rect x="10" y="16" width="11" height="2.5" rx="1.25" fill="#34d399" opacity="0.85"/>
              <rect x="10" y="21" width="13" height="2.5" rx="1.25" fill="#536878" opacity="0.55"/>
            </svg>
            <h1 className="text-2xl font-semibold tracking-tight text-[#E5E4E2]">PropDash</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "login" && "Sign in to your account"}
            {mode === "signup" && "Create a new account"}
            {mode === "magic" && "Sign in with magic link"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignUp : handleMagicLink}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="autofill-dark"
              />
            </div>

            {mode !== "magic" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="autofill-dark"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" && "Sign In"}
              {mode === "signup" && "Create Account"}
              {mode === "magic" && "Send Magic Link"}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={() => { setMode("magic"); setError(null); setMessage(null) }}
                className="text-[#94AAB8] hover:text-[#E5E4E2] transition-colors"
              >
                Use magic link instead
              </button>
              <span className="mx-2 text-slate-600">·</span>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setMessage(null) }}
                className="text-[#94AAB8] hover:text-[#E5E4E2] transition-colors"
              >
                Create account
              </button>
            </>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setMessage(null) }}
              className="text-[#94AAB8] hover:text-[#E5E4E2] transition-colors"
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === "magic" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setMessage(null) }}
              className="text-[#94AAB8] hover:text-[#E5E4E2] transition-colors"
            >
              Use password instead
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
