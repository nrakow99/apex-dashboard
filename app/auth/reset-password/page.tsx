"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    router.replace("/today")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-12 text-white">
      <section className="w-full max-w-[440px] border border-[var(--hairline)] bg-[var(--surface)] p-6 sm:p-8">
        <ShieldCheck className="h-5 w-5" />
        <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Secure workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Choose a new password</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Use at least six characters. Your existing workspace remains unchanged.</p>
        {error && <div role="alert" className="mt-5 border-l-2 border-white bg-[var(--raised)] px-4 py-3 text-sm">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div>
          <Button type="submit" className="h-11 w-full" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Save password</Button>
        </form>
      </section>
    </main>
  )
}
