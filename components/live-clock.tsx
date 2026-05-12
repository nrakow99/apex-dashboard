"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"

export function LiveClock() {
  const [time, setTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTime(new Date())

    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!mounted || !time) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/30 border border-border/50">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-mono text-muted-foreground">--:--:--</span>
      </div>
    )
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-sm font-mono text-foreground">{formatTime(time)}</span>
    </div>
  )
}
