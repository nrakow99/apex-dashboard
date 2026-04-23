"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { EOD_CONSTANTS } from "@/lib/types"

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

  const hours = time.getHours()
  const minutes = time.getMinutes()
  const isTradingDayComplete = hours > EOD_CONSTANTS.CLOSE_HOUR || 
    (hours === EOD_CONSTANTS.CLOSE_HOUR && minutes >= EOD_CONSTANTS.CLOSE_MINUTE)

  // Calculate time until/since close
  const closeTime = new Date(time)
  closeTime.setHours(EOD_CONSTANTS.CLOSE_HOUR, EOD_CONSTANTS.CLOSE_MINUTE, 0, 0)
  
  let timeLabel = ""
  if (isTradingDayComplete) {
    timeLabel = "EOD floor updated"
  } else {
    const diffMs = closeTime.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const h = Math.floor(diffMins / 60)
    const m = diffMins % 60
    timeLabel = h > 0 ? `Floor updates in ${h}h ${m}m` : `Floor updates in ${m}m`
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
    <div className="flex items-center gap-4">
      {/* Live Clock */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-mono text-foreground">{formatTime(time)}</span>
      </div>
      
      {/* EOD Status */}
      <div className={cn(
        "text-xs px-2.5 py-1 rounded-md font-medium",
        isTradingDayComplete 
          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
      )}>
        {timeLabel}
      </div>
    </div>
  )
}
