"use client"

import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Firm } from "@/lib/types"
import { getRuleCopy, type RuleCopyKey } from "@/lib/rule-copy"

interface InfoHintProps {
  topic: RuleCopyKey
  firm?: Firm | null
  extra?: string | null
  className?: string
}

/**
 * Small ⓘ that opens the plain-language copy for a rule or concept.
 * Neutral surfaces only — same severity system as the rest of the app:
 * no hue, no glow, no shadow. Callers must stop the parent click
 * themselves only if they wrap this; the trigger already swallows
 * pointer events so a clickable card behind it does not fire.
 */
export function InfoHint({ topic, firm, extra, className }: InfoHintProps) {
  const { name, oneLiner, detail } = getRuleCopy(topic, firm, extra)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${name}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] text-[var(--muted-foreground)] hover:text-[var(--text)]",
            className,
          )}
        >
          <Info className="h-3 w-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-64 rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] p-3 shadow-none"
      >
        <p className="text-xs font-semibold text-[var(--text)]">{name}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{oneLiner}</p>
        {detail && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">{detail}</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
