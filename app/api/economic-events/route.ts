import { NextResponse } from "next/server"
import { resolveFetchRevalidateSeconds, resolveHttpCacheControl } from "@/lib/economic-events/cache-policy"
import { getSelectedEconomicEventsProvider } from "@/lib/economic-events/provider"

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

  const revalidateSec = resolveFetchRevalidateSeconds(from, to)
  const providerSelection = getSelectedEconomicEventsProvider(revalidateSec)
  const headers = {
    "Cache-Control": resolveHttpCacheControl(from, to),
  }

  try {
    const events = await providerSelection.provider.fetchEvents(from, to, revalidateSec)
    return NextResponse.json(
      {
        events,
        meta: {
          from,
          to,
          provider: providerSelection.name,
          stale: false,
          cacheSeconds: revalidateSec,
        },
      },
      { headers },
    )
  } catch {
    if (providerSelection.fallbackProvider && providerSelection.fallbackName) {
      try {
        const events = await providerSelection.fallbackProvider.fetchEvents(from, to, revalidateSec)
        return NextResponse.json(
          {
            events,
            meta: {
              from,
              to,
              provider: providerSelection.fallbackName,
              requestedProvider: providerSelection.name,
              fallback: true,
              stale: false,
              cacheSeconds: revalidateSec,
            },
          },
          { headers },
        )
      } catch {
        // Fall through to the stable empty response below.
      }
    }

    return NextResponse.json(
      {
        events: [],
        meta: {
          from,
          to,
          provider: providerSelection.name,
          error: "fetch_failed",
          stale: false,
          cacheSeconds: revalidateSec,
        },
      },
      { status: 200, headers },
    )
  }
}
