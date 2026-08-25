import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sanitizeScreenshotExtraction } from "@/lib/screenshot-import"

export const runtime = "nodejs"

const MAX_IMAGES = 8
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 30 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

const SCREENSHOT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    source: {
      type: "string",
      enum: ["lucid_trading_history", "generic_trading_history", "unknown"],
    },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: ["string", "null"] },
          rawSymbol: { type: ["string", "null"] },
          netPnl: { type: ["number", "null"] },
          pnlHigh: { type: ["number", "null"] },
          pnlLow: { type: ["number", "null"] },
          quantity: { type: ["number", "null"] },
          commission: { type: ["number", "null"] },
          avgWin: { type: ["number", "null"] },
          avgLoss: { type: ["number", "null"] },
          winDurationSeconds: { type: ["number", "null"] },
          lossDurationSeconds: { type: ["number", "null"] },
          winRatePercent: { type: ["number", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          warnings: { type: "array", items: { type: "string" } },
        },
        required: [
          "date",
          "rawSymbol",
          "netPnl",
          "pnlHigh",
          "pnlLow",
          "quantity",
          "commission",
          "avgWin",
          "avgLoss",
          "winDurationSeconds",
          "lossDurationSeconds",
          "winRatePercent",
          "confidence",
          "warnings",
        ],
      },
    },
    coverageStart: { type: ["string", "null"] },
    coverageEnd: { type: ["string", "null"] },
    isLikelyComplete: { type: ["boolean", "null"] },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "source",
    "rows",
    "coverageStart",
    "coverageEnd",
    "isLikelyComplete",
    "warnings",
  ],
} as const

const EXTRACTION_PROMPT = `You are reading one or more screenshots of a futures trading-history table for a compliance dashboard.

Extract one row for every visible data row. Screenshots may overlap; include an overlapping row only once when every visible field matches. Keep different symbols on the same date as separate rows.

Safety rules:
- Read only values visibly present. Never infer a fill, price, direction, session, setup, or missing number.
- A cell showing only a currency symbol such as "$" is unavailable: return null, never zero.
- Preserve the exact displayed contract symbol in rawSymbol, including month/year codes (for example NQU6 or MNQU6).
- Convert dates to YYYY-MM-DD only when the date is legible. Otherwise return null.
- Return signed numeric values without currency symbols or commas. Check negative signs carefully.
- Convert visible durations to integer seconds. If unavailable, return null.
- confidence is per row. Use low whenever the date, symbol, or Net P&L is ambiguous.
- Add a short warning for cropped, obscured, ambiguous, or unavailable values.
- isLikelyComplete describes whether the screenshots appear to cover the whole table, not whether each visible row was read.
- coverageStart and coverageEnd are the earliest and latest verified visible dates.

These rows may be daily-symbol aggregates rather than individual fills. Do not split them into imagined trades.`

function readOutputText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null
  const root = response as Record<string, unknown>
  if (typeof root.output_text === "string") return root.output_text
  if (!Array.isArray(root.output)) return null

  for (const item of root.output) {
    if (!item || typeof item !== "object") continue
    const content = (item as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== "object") continue
      const typed = part as Record<string, unknown>
      if (typed.type === "output_text" && typeof typed.text === "string") return typed.text
    }
  }
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Screenshot reading is not configured. Add OPENAI_API_KEY to .env.local and restart the local server.",
        code: "SCREENSHOT_IMPORT_NOT_CONFIGURED",
      },
      { status: 503 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded files." }, { status: 400 })
  }

  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (files.length === 0) {
    return NextResponse.json({ error: "Choose at least one screenshot." }, { status: 400 })
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Choose no more than ${MAX_IMAGES} screenshots.` }, { status: 400 })
  }

  let totalBytes = 0
  for (const file of files) {
    totalBytes += file.size
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `${file.name} is not a supported PNG, JPEG, or WebP image.` },
        { status: 400 },
      )
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `${file.name} is larger than 10 MB.` }, { status: 400 })
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "The selected screenshots exceed 30 MB total." }, { status: 400 })
  }

  const { data: reservationData, error: reservationError } = await supabase.rpc(
    "reserve_screenshot_scan",
    { p_image_count: files.length },
  )
  if (reservationError) {
    const limited = /safety limit reached/i.test(reservationError.message)
    return NextResponse.json(
      {
        error: limited
          ? "Screenshot scanning is temporarily limited for this account. Try again later."
          : "Screenshot usage could not be verified. Try again after the database update is applied.",
        code: limited ? "SCREENSHOT_IMPORT_RATE_LIMITED" : "SCREENSHOT_USAGE_UNAVAILABLE",
      },
      { status: limited ? 429 : 503 },
    )
  }

  const reservation = Array.isArray(reservationData) ? reservationData[0] : reservationData
  const requestId = (reservation as { request_id?: string } | null)?.request_id
  if (!requestId) {
    return NextResponse.json(
      { error: "Screenshot usage could not be reserved. Try again.", code: "SCREENSHOT_USAGE_UNAVAILABLE" },
      { status: 503 },
    )
  }

  const finishScan = async (status: "succeeded" | "failed", rowCount: number | null = null) => {
    await supabase.rpc("finish_screenshot_scan", {
      p_request_id: requestId,
      p_status: status,
      p_extracted_row_count: rowCount,
    })
  }

  const imageContent = await Promise.all(
    files.map(async (file) => ({
      type: "input_image" as const,
      image_url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
      detail: "high" as const,
    })),
  )

  const model = process.env.OPENAI_SCREENSHOT_MODEL?.trim() || "gpt-5.4-mini"
  let upstream: Response
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 20000,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: EXTRACTION_PROMPT }, ...imageContent],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "screenshot_trade_history",
            strict: true,
            schema: SCREENSHOT_SCHEMA,
          },
        },
      }),
    })
  } catch {
    await finishScan("failed")
    return NextResponse.json(
      { error: "The screenshot reader could not be reached. Try again." },
      { status: 502 },
    )
  }

  const payload: unknown = await upstream.json().catch(() => null)
  if (!upstream.ok) {
    await finishScan("failed")
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : null
    return NextResponse.json(
      { error: message || "The screenshot reader could not process these files." },
      { status: upstream.status >= 500 ? 502 : 400 },
    )
  }

  const outputText = readOutputText(payload)
  if (!outputText) {
    await finishScan("failed")
    return NextResponse.json(
      { error: "No verified table data was returned. Try a clearer screenshot." },
      { status: 422 },
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(outputText)
  } catch {
    await finishScan("failed")
    return NextResponse.json(
      { error: "The extracted table could not be verified. Try again." },
      { status: 422 },
    )
  }

  const extraction = sanitizeScreenshotExtraction(parsed)
  if (extraction.rows.length === 0) {
    await finishScan("failed", 0)
    return NextResponse.json(
      { error: "No visible trade-history rows were found in these screenshots." },
      { status: 422 },
    )
  }
  if (extraction.rows.length > 500) {
    await finishScan("failed")
    return NextResponse.json(
      { error: "More than 500 visible rows were found. Split the screenshots into smaller imports." },
      { status: 422 },
    )
  }

  await finishScan("succeeded", extraction.rows.length)
  return NextResponse.json({ extraction })
}
