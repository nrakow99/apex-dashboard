"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { EconomicEvent } from "@/lib/economic-events/types"

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export function monthBounds(d: Date): { from: string; to: string } {
  const y = d.getFullYear()
  const m = d.getMonth()
  const from = `${y}-${pad2(m + 1)}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${pad2(m + 1)}-${pad2(lastDay)}`
  return { from, to }
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/**
 * Prefetches visible month ±1 into a ref-backed cache; merged list dedupes by event id.
 * Navigating across months hits cache when those ranges were prefetched earlier.
 */
export function useEconomicCalendarPrefetch(visibleMonth: Date) {
  const cacheRef = useRef<Map<string, EconomicEvent[]>>(new Map())
  const pendingRef = useRef<Set<string>>(new Set())
  const [mergeVersion, setMergeVersion] = useState(0)
  const [loading, setLoading] = useState(false)

  const bump = useCallback(() => setMergeVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    const y = visibleMonth.getFullYear()
    const m = visibleMonth.getMonth()
    const windows = [
      new Date(y, m - 1, 1),
      new Date(y, m, 1),
      new Date(y, m + 1, 1),
    ]

    const promises: Promise<void>[] = []

    for (const d of windows) {
      const key = monthKey(d)
      if (cacheRef.current.has(key)) continue
      if (pendingRef.current.has(key)) continue

      pendingRef.current.add(key)
      const { from, to } = monthBounds(d)

      promises.push(
        fetch(`/api/economic-events?from=${from}&to=${to}`)
          .then((r) => r.json())
          .then((body: { events?: EconomicEvent[] }) => {
            if (cancelled) return
            cacheRef.current.set(key, body.events ?? [])
          })
          .catch(() => {
            if (cancelled) return
            cacheRef.current.set(key, [])
          })
          .finally(() => {
            pendingRef.current.delete(key)
          }),
      )
    }

    if (promises.length === 0) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    Promise.all(promises).then(() => {
      if (!cancelled) {
        bump()
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [visibleMonth, bump])

  const mergedEvents = useMemo(() => {
    const y = visibleMonth.getFullYear()
    const m = visibleMonth.getMonth()
    const keys = [
      monthKey(new Date(y, m - 1, 1)),
      monthKey(new Date(y, m, 1)),
      monthKey(new Date(y, m + 1, 1)),
    ]
    const byId = new Map<string, EconomicEvent>()
    for (const k of keys) {
      for (const e of cacheRef.current.get(k) ?? []) {
        byId.set(e.id, e)
      }
    }
    return [...byId.values()]
  }, [visibleMonth, mergeVersion])

  return { mergedEvents, loading }
}
