"use client"

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { fetchOnboardingSettings, saveOnboardingSettings } from "@/lib/supabase/database"

const STORAGE_KEY = "propdash:onboarding:v1"
const CHANGE_EVENT = "propdash:onboarding-change"

export interface OnboardingState {
  started: boolean
  dismissed: boolean
  visitedPaths: string[]
}

const DEFAULT_STATE: OnboardingState = { started: false, dismissed: false, visitedPaths: [] }

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

function snapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? ""
}

function parse(raw: string): OnboardingState {
  if (!raw) return DEFAULT_STATE
  try {
    const value = JSON.parse(raw) as Partial<OnboardingState>
    return {
      started: Boolean(value.started),
      dismissed: Boolean(value.dismissed),
      visitedPaths: Array.isArray(value.visitedPaths)
        ? [...new Set(value.visitedPaths.filter((path): path is string => typeof path === "string"))]
        : [],
    }
  } catch {
    return DEFAULT_STATE
  }
}

function write(next: OnboardingState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useOnboarding() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "")
  const state = useMemo(() => parse(raw), [raw])

  useEffect(() => {
    let active = true
    void fetchOnboardingSettings().then(async (result) => {
      if (!active || result.error) return
      const local = parse(window.localStorage.getItem(STORAGE_KEY) ?? "")
      const remote = result.data
      const merged = remote
        ? {
            started: local.started || remote.started,
            dismissed: local.dismissed || remote.dismissed,
            visitedPaths: [...new Set([...local.visitedPaths, ...remote.visitedPaths])],
          }
        : local
      write(merged)
      await saveOnboardingSettings(merged)
    })
    return () => { active = false }
  }, [])

  const update = useCallback((updates: Partial<OnboardingState>) => {
    const current = parse(window.localStorage.getItem(STORAGE_KEY) ?? "")
    const next = { ...current, ...updates }
    write(next)
    void saveOnboardingSettings(next)
  }, [])

  const recordVisit = useCallback((path: string) => {
    const current = parse(window.localStorage.getItem(STORAGE_KEY) ?? "")
    if (current.visitedPaths.includes(path)) return
    const next = { ...current, visitedPaths: [...current.visitedPaths, path] }
    write(next)
    void saveOnboardingSettings(next)
  }, [])

  const restart = useCallback(() => {
    write(DEFAULT_STATE)
    void saveOnboardingSettings(DEFAULT_STATE)
  }, [])

  return { state, update, recordVisit, restart }
}
