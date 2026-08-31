import { Suspense } from "react"
import { TradesWorkspace } from "@/app/trades/page"
import { AnalyticsWorkspace } from "@/app/analytics/page"

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams
  return <Suspense fallback={null}>{params.tab === "edge" ? <AnalyticsWorkspace reviewMode /> : <TradesWorkspace reviewMode />}</Suspense>
}
