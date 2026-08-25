# PropDash

A prop-firm payout and risk-compliance dashboard. PropDash tracks account
headroom, drawdown floors, consistency, payout readiness, and reviewed trading
history across multiple firms.

## Getting started

Install dependencies and copy the environment template:

```bash
pnpm install
cp .env.example .env.local
```

Add the Supabase values to `.env.local`. Screenshot trade import also requires a
server-side `OPENAI_API_KEY`; never expose that value through a
`NEXT_PUBLIC_...` variable.

The Supabase CLI is pinned as a project dependency. Authenticate once, link
the checkout to the existing project, inspect the migration history, and
always dry-run before applying remote changes:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm db:migrations
pnpm db:push:dry
pnpm db:push
```

Do not run `db reset` against a shared or production database. The current
migrations add row-level security for every user-owned table. Screenshot source
images are not stored; only request metadata and user-approved trade rows are
persisted.

Then start the dashboard:

```bash
pnpm dev --port 3001
```

Open [http://localhost:3001](http://localhost:3001). The page updates as files
change. If port 3001 is busy, stop the existing process or choose another port.

## Verification

Run the required checks after each completed implementation step:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Screenshot files are sent to the configured vision model with API storage
disabled. The app does not persist the source images; it saves only rows the
trader explicitly approves.
