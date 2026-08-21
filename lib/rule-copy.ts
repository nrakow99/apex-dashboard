import type { Firm } from "@/lib/types"

/**
 * Plain-language copy for every rule and concept the UI has to explain.
 * Components must read from here — never inline a second explanation.
 *
 * Voice: explain it to a friend who doesn't trade futures. If a sentence
 * only makes sense after you already know the term, rewrite it.
 *
 * `byFirm` is for firm-wide differences (DLL on Topstep vs Alpha).
 * `extra` is for variants inside a firm (Topstep eval vs funded consistency).
 */
export type RuleCopyKey =
  | "drawdownType"
  | "dll"
  | "consistency"
  | "payoutPath"
  | "tiers"
  | "headroom"
  | "floor"
  | "staleness"
  | "roomToday"
  | "atRisk"
  | "payoutReady"
  | "needsUpdate"

export interface RuleCopyEntry {
  /** Short label, shown as the popover heading. */
  name: string
  /** One sentence. This is what most people will actually read. */
  oneLiner: string
  /** Extra paragraph when this firm does the thing differently. */
  byFirm?: Partial<Record<Firm, string>>
  /** Extra paragraph for a named variant (e.g. topstepEval, topstepXfa). */
  extra?: Record<string, string>
}

export const RULE_COPY: Record<RuleCopyKey, RuleCopyEntry> = {
  drawdownType: {
    name: "Drawdown type",
    oneLiner:
      "EOD = your floor only moves at the end of each day. Intraday = it trails your peak in real time.",
    byFirm: {
      Apex: "Apex is the firm that lets you pick. End-of-day waits until the close to raise the line you can't cross. Intraday raises that line as soon as you make a new high — so a big run-up, then a give-back, can close the account even if you finish the day ahead.",
      Lucid: "Lucid is end-of-day only. The line you can't cross does not move until the trading day is over.",
      Tradeify: "Tradeify is end-of-day only. The line you can't cross does not move until the trading day is over.",
      Topstep: "Topstep is end-of-day only. The line you can't cross does not move until the trading day is over.",
      Alpha: "Alpha is end-of-day only. The line you can't cross does not move until the trading day is over.",
    },
  },
  dll: {
    name: "Daily loss limit",
    oneLiner:
      "A hard cap on how much you can lose in a single day. Hit it and you're done trading for the day — on some firms, hitting it fails the account.",
    byFirm: {
      Topstep:
        "Optional at checkout. Electing it doubles your payout cap but adds the daily cutoff. Pick what you actually bought.",
      Alpha:
        "Alpha calls this the Daily Loss Guard. Whether you have one depends on your tier and stage — Zero has it everywhere, Standard only once funded, Advanced never.",
    },
  },
  consistency: {
    name: "Consistency",
    oneLiner:
      "No single day can be too big a share of your total profit. It stops one lucky day from carrying the account.",
    extra: {
      topstepEval:
        "Topstep evals measure your best day against the PROFIT TARGET, not your total — your best day must stay under 50% of the target.",
      topstepXfa:
        "On the funded Consistency path, your largest day must stay under 40% of your total profit since your last payout.",
    },
  },
  payoutPath: {
    name: "Payout path",
    oneLiner:
      "How this funded account pays you — the days you need, and whether a consistency rule applies. Chosen once, not a score.",
    byFirm: {
      Topstep:
        "Chosen when you get funded, and permanent. Standard: 5 winning days of $150+, no consistency rule. Consistency: only 3 days, but your biggest day must stay under 40% of your total.",
    },
  },
  tiers: {
    name: "Contract tiers",
    oneLiner:
      "How many contracts you're allowed to trade grows as the account makes money. You start small and size up only after you've earned it.",
  },
  headroom: {
    name: "Headroom",
    oneLiner:
      "How many of your typical trades this account can lose before hitting its floor. Based on the risk profile you set (contracts × stop × instrument).",
  },
  floor: {
    name: "The floor",
    oneLiner:
      "The balance where this account ends. If your balance closes below this line, the account is breached. Some firms move it up as you profit, then lock it permanently.",
  },
  staleness: {
    name: "Stale numbers",
    oneLiner:
      "Balances here are entered by you, not synced. If you haven't logged today's result, every number on this account may be wrong until you do.",
  },
  roomToday: {
    name: "Room today",
    oneLiner:
      "How much you can still lose across your live accounts before hitting a floor. Dead accounts aren't counted — they have no room left.",
  },
  atRisk: {
    name: "At risk",
    oneLiner:
      "How many accounts are close enough to their floor that another typical loss could end them.",
  },
  payoutReady: {
    name: "Payout ready",
    oneLiner:
      "How many funded accounts currently meet every condition their firm requires to request a payout.",
  },
  needsUpdate: {
    name: "Needs update",
    oneLiner:
      "How many accounts have no result logged today. Every number on those cards may be wrong until you do.",
  },
}

export function getRuleCopy(
  key: RuleCopyKey,
  firm?: Firm | null,
  extraKey?: string | null,
): { name: string; oneLiner: string; detail?: string } {
  const entry = RULE_COPY[key]
  const detail =
    extraKey && extraKey in (entry.extra ?? {})
      ? entry.extra![extraKey]
      : firm
        ? entry.byFirm?.[firm]
        : undefined
  return { name: entry.name, oneLiner: entry.oneLiner, detail }
}
