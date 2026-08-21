import { describe, it, expect } from "vitest"
import { pnlColor, pnlColorClass, pnlBgClass, formatPnL } from "./utils"

// Regression coverage for the "$0.00 renders green" bug: every signed-P&L
// color helper used a >= 0 (or <= 0) comparison, which treats "no sign at
// all" the same as "positive" and colors a brand-new, zero-trade account's
// $0.00 Net PnL as a gain. CLAUDE.md reserves --gain/--loss for an actual
// sign — zero has none, so it must render neutral everywhere this is
// checked: account cards, the accounts-overview strip, payout cycle profit,
// and the performance chart's tooltip/dot.

describe("pnlColor / pnlColorClass / pnlBgClass — exactly-zero P&L is neutral, never colored as a gain or loss", () => {
  it("positive renders as a gain", () => {
    expect(pnlColor(0.01)).toBe("var(--gain)")
    expect(pnlColorClass(1234.56)).toBe("text-[var(--gain)]")
    expect(pnlBgClass(1)).toBe("bg-[var(--gain)]")
  })

  it("negative renders as a loss", () => {
    expect(pnlColor(-0.01)).toBe("var(--loss)")
    expect(pnlColorClass(-1234.56)).toBe("text-[var(--loss)]")
    expect(pnlBgClass(-1)).toBe("bg-[var(--loss)]")
  })

  it("exactly zero renders neutral --text, not --gain (the reported bug)", () => {
    expect(pnlColor(0)).toBe("var(--text)")
    expect(pnlColorClass(0)).toBe("text-[var(--text)]")
    expect(pnlBgClass(0)).toBe("bg-[var(--text)]")
  })

  it("negative zero (a real float artifact of summed trade PnL) is still treated as zero, not negative", () => {
    expect(pnlColor(-0)).toBe("var(--text)")
    expect(pnlColorClass(-0)).toBe("text-[var(--text)]")
  })
})

describe("formatPnL — zero gets no sign, so it never visually reads as a gain", () => {
  it("does not prefix a '+' onto $0.00", () => {
    expect(formatPnL(0)).toBe("$0.00")
  })

  it("still signs real gains and losses", () => {
    expect(formatPnL(500)).toBe("+$500.00")
    expect(formatPnL(-500)).toBe("-$500.00")
  })

  it("a loss is never an unsigned dollar amount (the Trade History bug)", () => {
    expect(formatPnL(-533)).toBe("-$533.00")
    expect(formatPnL(-533).startsWith("-")).toBe(true)
    expect(formatPnL(-533).includes("$-")).toBe(false)
  })
})
