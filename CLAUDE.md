# Project rules

## What this is

Prop firm account tracking. The product is not a trading journal — it is
payout compliance. The user has already passed their evaluation; the job is
making sure they do not get denied at payout.

## The one architectural rule

**All account rule logic goes through `lib/rules.ts` first.**

`getAccountRules(account)` is the single source of truth for every firm rule:
drawdown, daily loss limit, profit target, consistency, payout caps, safety
nets, contract limits, lock schedules.

Never inline a rule value in a component. Never compute a threshold in a
`.tsx` file. If a component needs a number, it comes from `getAccountRules()`
or from a function in `lib/` that calls it.

If a rule does not fit the `AccountRules` interface, extend the interface.
Do not work around it.

## Correctness bar

The rule engine is the product. A wrong payout cap or a wrong floor costs a
user real money and a real funded account.

- Every change to `lib/rules.ts`, `lib/storage.ts`, `lib/lucid-flex-floor.ts`
  or `lib/tradeify-rules.ts` requires passing tests before commit.
- Adding a firm means adding its golden-file cases in the same commit.
- When a computed value is stale or unavailable, the UI must refuse to state
  it. Never fall back to a default and display it as if it were real. A blank
  is safe; a confident wrong number is not.

## Stack

Next.js 15 App Router, React 19, Supabase, Tailwind 3, shadcn/ui,
date-fns-tz. Vitest for tests.

## Design tokens

Midnight black. Two color families only.

```
--ground     #000000    page
--surface    #0C0C0D    card
--raised     #141415    input, nested
--hairline   #1F1F21    every border
--text       #FFFFFF
--muted      #6E6E73    labels, units
--faint      #3F3F45    axis, disabled
--gain       #3ECF8E
--loss       #E5484D
--radius     2px
```

Green and red appear on signed P&L figures only. Never on buttons, progress
bars, borders, backgrounds, checkmarks, or tags. If a color appears without a
plus or minus in front of it, that is a bug.

Distance to the floor is expressed structurally — position, size, weight —
never chromatically. Primary buttons are white fill with black text.

Every numeral renders in JetBrains Mono with tabular figures. Inter is for
labels and prose only.

No gradients, no glow, no blur. The background is flat `#000`.

## Known issues (fix before building on top of them)

- `toSizeKey()` in `lib/rules.ts` clamps any size above 150000 down to the
  150000 rule set with no warning. Silently wrong for 250K/300K accounts.
- `lib/storage.ts` has localStorage persistence and `lib/supabase/database.ts`
  has Supabase persistence. Two sources of truth. Pick one, delete the other.
- No `app/api` directory exists. There is no server surface, so nothing can
  run on a cron or generate a digest server-side.
- `app/page.tsx` is ~1260 lines and fully client-side.
- `app/globals.css` sets `--font-sans: var(--font-geist-sans)`, which is dead
  v0 leftover — `app/layout.tsx` loads Inter and JetBrains Mono and overrides
  it. Delete the dead line.
- `middleware.ts` gates every route except `/auth/*`. There is no public
  surface for a landing page or per-firm marketing pages.
- `components/payout-status-panel.tsx` dispatches on `eligibility.firm`, but
  only special-cases `"Tradeify"` and `"Lucid"` — everything else (Apex,
  Topstep, and soon Alpha) falls into `ApexPayoutPanel`, which reads
  Apex-shaped condition keys (`isConsistent`, `hasMinBalance`,
  `isAboveSafetyNet`) and a "qualifying days" count sourced from
  `consistencyInfo.daysWithMinProfit`, which is lifetime-windowed, not
  since-last-payout-windowed. Topstep's XFA branch (`lib/storage.ts`) computes
  its own correctly-windowed day counts, but the panel doesn't display them —
  it'll show a lifetime count instead. Deferred until the panel gets rebuilt
  as part of the visual rebrand; don't build a Topstep- or Alpha-specific
  panel branch before then.
