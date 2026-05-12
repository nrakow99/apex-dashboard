import type { EconomicEvent } from "./types"

/** Swap implementations in the API route or a small factory (Finnhub, Trading Economics, FMP). */
export interface EconomicEventsProvider {
  fetchEvents(from: string, to: string): Promise<EconomicEvent[]>
}
