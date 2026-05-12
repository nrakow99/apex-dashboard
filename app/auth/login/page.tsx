"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2, TrendingUp } from "lucide-react"

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
      window.location.href = "/"
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
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-2 shadow-[0_0_35px_-18px_rgba(34,211,238,0.95)]">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Apex Tracker</h1>
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
                className="bg-slate-950/50"
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
                  className="bg-slate-950/50"
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
                className="text-primary hover:underline"
              >
                Use magic link instead
              </button>
              <span className="mx-2">·</span>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setMessage(null) }}
                className="text-primary hover:underline"
              >
                Create account
              </button>
            </>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setMessage(null) }}
              className="text-primary hover:underline"
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === "magic" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setMessage(null) }}
              className="text-primary hover:underline"
            >
              Use password instead
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
