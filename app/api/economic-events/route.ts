import { NextResponse } from "next/server"
import { createFinnhubEconomicEventsProvider } from "@/lib/economic-events/finnhub"

export const revalidate = 600

function defaultFromTo(): { from: string; to: string } {
  const now = new Date()
  const from = now.toISOString().slice(0, 10)
  const end = new Date(now)
  end.setUTCDate(end.getUTCDate() + 14)
  const to = end.toISOString().slice(0, 10)
  return { from, to }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const qpFrom = url.searchParams.get("from")
  const qpTo = url.searchParams.get("to")
  const defaults = defaultFromTo()
  const from = qpFrom && /^\d{4}-\d{2}-\d{2}$/.test(qpFrom) ? qpFrom : defaults.from
  const to = qpTo && /^\d{4}-\d{2}-\d{2}$/.test(qpTo) ? qpTo : defaults.to

  try {
    const provider = createFinnhubEconomicEventsProvider()
    const events = await provider.fetchEvents(from, to)
    return NextResponse.json(
      {
        events,
        meta: {
          from,
          to,
          provider: "finnhub",
          stale: false,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      },
    )
  } catch {
    return NextResponse.json(
      {
        events: [],
        meta: {
          from,
          to,
          provider: "finnhub",
          error: "fetch_failed",
          stale: false,
        },
      },
      { status: 200 },
    )
  }
}
