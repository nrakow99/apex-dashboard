"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

const subscribeToHydration = () => () => undefined

export function ThemeToggle({
  showLabel = false,
  className,
}: {
  showLabel?: boolean
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false)

  const isLight = mounted && resolvedTheme === "light"
  const label = !mounted ? "Change appearance" : isLight ? "Use dark mode" : "Use light mode"

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      disabled={!mounted}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 text-xs text-[var(--muted)] transition-colors hover:border-[var(--faint)] hover:text-[var(--text)] disabled:cursor-wait",
        showLabel ? "w-full justify-start" : "w-10 px-0",
        className,
      )}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {showLabel && <span>{label}</span>}
    </button>
  )
}
