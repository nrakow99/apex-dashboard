"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { fetchOnboardingSettings, saveOnboardingSettings } from "@/lib/supabase/database"
import type { ActivationState } from "@/lib/onboarding"

export type OnboardingState = ActivationState

const DEFAULT_STATE: OnboardingState = { started: false, dismissed: false, activated: false, goal: null, historyChoice: null, visitedPaths: [] }
let currentState = DEFAULT_STATE
let hydrated = false
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot() {
  return `${hydrated ? "1" : "0"}:${JSON.stringify(currentState)}`
}

function parseSnapshot(value: string): { state: OnboardingState; loading: boolean } {
  const separator = value.indexOf(":")
  return {
    loading: value.slice(0, separator) !== "1",
    state: JSON.parse(value.slice(separator + 1)) as OnboardingState,
  }
}

function hydrateFromSupabase(): Promise<void> {
  if (hydrated) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = fetchOnboardingSettings().then((result) => {
    currentState = result.error || !result.data ? DEFAULT_STATE : result.data
    hydrated = true
    emit()
  }).finally(() => { loadPromise = null })
  return loadPromise
}

async function persist(updater: (current: OnboardingState) => OnboardingState) {
  await hydrateFromSupabase()
  currentState = updater(currentState)
  emit()
  await saveOnboardingSettings(currentState)
}

export function useOnboarding() {
  const serialized = useSyncExternalStore(subscribe, snapshot, () => `0:${JSON.stringify(DEFAULT_STATE)}`)
  const { state, loading } = parseSnapshot(serialized)

  useEffect(() => { void hydrateFromSupabase() }, [])

  const update = useCallback((updates: Partial<OnboardingState>) => {
    void persist((current) => ({ ...current, ...updates }))
  }, [])

  const recordVisit = useCallback((path: string) => {
    void persist((current) => current.visitedPaths.includes(path)
      ? current
      : { ...current, visitedPaths: [...current.visitedPaths, path] })
  }, [])

  const restart = useCallback(() => {
    void persist(() => DEFAULT_STATE)
  }, [])

  return { state, loading, update, recordVisit, restart }
}
