import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ screenshotScanConfigured: Boolean(process.env.OPENAI_API_KEY) })
}
