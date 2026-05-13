import { NextResponse } from "next/server"
import { resolveFetchRevalidateSeconds, resolveHttpCacheControl } from "@/lib/economic-events/cache-policy"
import { getSelectedEconomicEventsProvider } from "@/lib/economic-events/provider"
import type { EconomicEvent } from "@/lib/economic-events/types"

function defaultFromTo(): { from: string; to: string } {
  const now = new Date()
  const from = now.toISOString().slice(0, 10)
  const end = new Date(now)
  end.setUTCDate(end.getUTCDate() + 14)
  const to = end.toISOString().slice(0, 10)
  return { from, to }
}

function countUsdRedFolder(events: EconomicEvent[]): number {
  return events.filter((e) => e.currency === "USD" && e.impact === "high" && e.isRedFolder).length
}

function hasForexFactoryApiHost(): boolean {
  if (process.env.FOREX_FACTORY_API_HOST?.trim()) return true

  const rawUrl = process.env.FOREX_FACTORY_API_URL?.trim()
  if (!rawUrl) return false

  try {
    return Boolean(new URL(rawUrl).host)
  } catch {
    return false
  }
}

function safeFallbackReason(error: unknown): string {
  if (!(error instanceof Error)) return "provider_fetch_failed"
  if (error.message === "FOREX_FACTORY_API_URL is not configured") return error.message
  if (error.message === "Invalid URL") return "FOREX_FACTORY_API_URL is invalid"
  if (/ForexFactory-style provider failed: \d+/.test(error.message)) return error.message
  return "provider_fetch_failed"
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

  const debugBase = {
    providerRequested: providerSelection.name,
    hasForexFactoryApiUrl: Boolean(process.env.FOREX_FACTORY_API_URL?.trim()),
    hasForexFactoryApiKey: Boolean(process.env.FOREX_FACTORY_API_KEY?.trim()),
    hasForexFactoryApiHost: hasForexFactoryApiHost(),
  }

  const getDebugFields = (
    providerUsed: string | null,
    fallbackReason: string | null,
  ) => {
    const forexDiagnostics =
      providerSelection.name === "forex_factory"
        ? providerSelection.provider.getDiagnostics?.()
        : undefined

    return {
      ...debugBase,
      providerUsed,
      fallbackReason,
      rawForexFactoryCount: forexDiagnostics?.rawCount ?? null,
      normalizedForexFactoryCount: forexDiagnostics?.normalizedCount ?? null,
      forexFactoryStatusCode: forexDiagnostics?.statusCode ?? null,
      forexFactoryRequestHost: forexDiagnostics?.requestHost ?? null,
      forexFactoryRequestPath: forexDiagnostics?.requestPath ?? null,
      forexFactoryRequestCountries: forexDiagnostics?.requestCountries ?? null,
      forexFactoryAuthHeaderPresent: forexDiagnostics?.authHeaderPresent ?? null,
      rapidApiKeyLength: forexDiagnostics?.rapidApiKeyLength ?? null,
    }
  }

  try {
    const events = await providerSelection.provider.fetchEvents(from, to, revalidateSec)
    console.info("[economic-events] route", {
      provider: providerSelection.name,
      normalizedEvents: events.length,
      usdRedFolderEvents: countUsdRedFolder(events),
    })
    return NextResponse.json(
      {
        events,
        ...getDebugFields(providerSelection.name, null),
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
  } catch (primaryError) {
    const fallbackReason = safeFallbackReason(primaryError)

    if (providerSelection.fallbackProvider && providerSelection.fallbackName) {
      try {
        const events = await providerSelection.fallbackProvider.fetchEvents(from, to, revalidateSec)
        console.info("[economic-events] route", {
          provider: providerSelection.fallbackName,
          requestedProvider: providerSelection.name,
          fallback: true,
          normalizedEvents: events.length,
          usdRedFolderEvents: countUsdRedFolder(events),
        })
        return NextResponse.json(
          {
            events,
            ...getDebugFields(providerSelection.fallbackName, fallbackReason),
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
        ...getDebugFields(null, fallbackReason),
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
