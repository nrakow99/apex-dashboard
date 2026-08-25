"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

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

  const update = useCallback((updates: Partial<OnboardingState>) => {
    const current = parse(window.localStorage.getItem(STORAGE_KEY) ?? "")
    write({ ...current, ...updates })
  }, [])

  const recordVisit = useCallback((path: string) => {
    const current = parse(window.localStorage.getItem(STORAGE_KEY) ?? "")
    if (current.visitedPaths.includes(path)) return
    write({ ...current, visitedPaths: [...current.visitedPaths, path] })
  }, [])

  const restart = useCallback(() => write(DEFAULT_STATE), [])

  return { state, update, recordVisit, restart }
}
