---
name: project-multi-firm-support
description: Multi-firm (Apex + Lucid) prop firm support added to apex-dashboard — rule engine, DB, UI
metadata:
  type: project
---

Multi-firm support was added to the apex-dashboard. Key architecture:

**Why:** User wanted Apex + Lucid accounts tracked with firm-specific rules.

**How to apply:** All new feature work on accounts should go through `lib/rules.ts` first.

Key files:
- `lib/rules.ts` — Central `getAccountRules(account)` function. Returns all rules (maxDrawdown, hasDLL, hasConsistency, payoutCaps, etc.) by firm/type/drawdown/size.
- `lib/types.ts` — `Firm = "Apex" | "Lucid"`, `DrawdownType = "EOD" | "Intraday"` (was INTRADAY), `accountSize` on Account
- `scripts/003_add_firm_and_size.sql` — Run this in Supabase: adds firm, account_size columns; renames INTRADAY→Intraday; adds payout split columns

Account sizes supported: 25000, 50000, 100000, 150000

Payout logic:
- Apex: safety-net based, up to 6 payouts, 50% consistency for EOD PA
- Lucid: cycle-profit based, 90/10 split, up to 5 payouts, no consistency on PA
