/**
 * Static mock economic calendar events — replace with API data later.
 * Keys: date in YYYY-MM-DD (local calendar dates).
 */

export type EconomicEventImpact = "High" | "Medium" | "Low"

export interface EconomicEventItem {
  time: string
  name: string
  impact: EconomicEventImpact
  forecast: string | null
  previous: string | null
  actual: string | null
}

export interface EconomicEventDay {
  date: string
  events: EconomicEventItem[]
}

export const MOCK_ECONOMIC_EVENTS: EconomicEventDay[] = [
  {
    date: "2026-05-12",
    events: [
      {
        time: "5:30 AM",
        name: "Core CPI m/m",
        impact: "High",
        forecast: "0.3%",
        previous: "0.2%",
        actual: null,
      },
      {
        time: "7:00 AM",
        name: "Fed Chair Speech",
        impact: "Medium",
        forecast: null,
        previous: null,
        actual: null,
      },
      {
        time: "9:00 AM",
        name: "Building Permits",
        impact: "Low",
        forecast: "1.45M",
        previous: "1.42M",
        actual: null,
      },
      {
        time: "2:00 PM",
        name: "Treasury Auction",
        impact: "Low",
        forecast: null,
        previous: null,
        actual: null,
      },
    ],
  },
  {
    date: "2026-05-13",
    events: [
      {
        time: "6:00 AM",
        name: "PPI m/m",
        impact: "High",
        forecast: "0.2%",
        previous: "0.1%",
        actual: null,
      },
      {
        time: "8:30 AM",
        name: "Retail Sales",
        impact: "Medium",
        forecast: "0.4%",
        previous: "0.3%",
        actual: null,
      },
    ],
  },
  {
    date: "2026-05-14",
    events: [
      {
        time: "7:30 AM",
        name: "Jobless Claims",
        impact: "Medium",
        forecast: "220K",
        previous: "218K",
        actual: null,
      },
    ],
  },
]

export function buildEconomicEventsByDate(
  days: EconomicEventDay[],
): Map<string, EconomicEventItem[]> {
  const map = new Map<string, EconomicEventItem[]>()
  for (const d of days) {
    map.set(d.date, d.events)
  }
  return map
}

export function maxImpactForDay(events: EconomicEventItem[]): EconomicEventImpact | null {
  if (events.length === 0) return null
  if (events.some((e) => e.impact === "High")) return "High"
  if (events.some((e) => e.impact === "Medium")) return "Medium"
  return "Low"
}
