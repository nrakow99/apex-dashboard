"use client"

import { createClient } from "@/lib/supabase/client"
import type {
  Account,
  Trade,
  Payout,
  Firm,
  DrawdownType,
  TradeifyProgram,
  TopstepPayoutPath,
  AlphaTier,
  InstrumentSpec,
  RiskProfile,
  AccountCost,
  AccountCostCategory,
  DailySessionPlan,
  TradeImportBatch,
  TradeImportSource,
} from "@/lib/types"
import { metaToDbPayload, type TradeMeta } from "@/lib/trade-meta"
import { normalizeSymbol } from "@/lib/instrument-specs"
import {
  createScreenshotImportKey,
  type ImportableScreenshotTradeRow,
  type ScreenshotImportSource,
} from "@/lib/screenshot-import"
import type { SubscriptionEntitlement, SubscriptionStatus, SubscriptionTier } from "@/lib/subscriptions"

const VALID_FIRMS: readonly Firm[] = ["Apex", "Lucid", "Tradeify", "Topstep", "Alpha"]

interface AccountRow {
  id: string
  user_id: string
  name: string
  is_demo?: boolean | null
  firm: string
  type: "Eval" | "PA" | "Live"
  status: "Active" | "Inactive" | "Breached" | "Passed"
  drawdown_type: DrawdownType
  account_size: number
  quantity?: number
  starting_balance: number
  profit_target: number | null
  max_drawdown: number
  daily_loss_limit: number | null
  manual_intraday_floor?: number | null
  manual_drawdown_remaining?: number | null
  manual_drawdown_updated_at?: string | null
  activated_at?: string | null
  activation_start_date?: string | null
  previous_type?: string | null
  program?: string | null
  legacy_fifty_k_target?: boolean | null
  has_daily_loss_limit?: boolean | null
  topstep_payout_path?: string | null
  alpha_tier?: string | null
  risk_symbol?: string | null
  risk_contracts?: number | null
  risk_stop_ticks?: number | null
  created_at: string
  updated_at: string
}

interface InstrumentSpecRow {
  id: string
  user_id: string | null
  symbol: string
  label: string
  tick_size: number
  tick_value: number
  source: string | null
}

interface UserSettingsRow {
  user_id: string
  risk_symbol: string | null
  risk_contracts: number | null
  risk_stop_ticks: number | null
  onboarding_started?: boolean | null
  onboarding_dismissed?: boolean | null
  onboarding_visited_paths?: string[] | null
  onboarding_activated?: boolean | null
  onboarding_goal?: string | null
  onboarding_history_choice?: string | null
}

interface AccountCostRow {
  id: string
  account_id: string
  cost_date: string
  category: AccountCostCategory
  amount: number
  notes: string | null
}

interface DailySessionPlanRow {
  plan_date: string
  reviewed_risk_queue: boolean
  confirmed_firm_portal: boolean
  checked_news_events: boolean
  personal_loss_limit: number | null
  max_trades: number | null
  notes: string | null
}

interface UserEntitlementRow {
  tier: SubscriptionTier
  status: SubscriptionStatus
  account_limit: number | null
  screenshot_monthly_limit: number
  current_period_end: string | null
}

export interface UserOnboardingSettings {
  started: boolean
  dismissed: boolean
  activated: boolean
  goal: import("@/lib/onboarding").OnboardingGoal | null
  historyChoice: import("@/lib/onboarding").OnboardingHistoryChoice | null
  visitedPaths: string[]
}

interface TradeRow {
  id: string
  user_id: string
  account_id: string
  date: string
  symbol: string
  pnl: number
  notes: string | null
  session?: string | null
  direction?: string | null
  grade?: string | null
  setup_tags?: string[] | null
  discipline_tags?: string[] | null
  entry_price?: number | null
  exit_price?: number | null
  contracts?: number | null
  import_source?: string | null
  raw_symbol?: string | null
  is_aggregate?: boolean | null
  pnl_high?: number | null
  pnl_low?: number | null
  commission?: number | null
  avg_win?: number | null
  avg_loss?: number | null
  win_duration_seconds?: number | null
  loss_duration_seconds?: number | null
  win_rate_percent?: number | null
  extraction_confidence?: string | null
  import_batch_id?: string | null
  import_key?: string | null
  created_at: string
}

interface TradeImportBatchRow {
  id: string
  account_id: string
  source: TradeImportSource
  filenames: string[] | null
  row_count: number
  coverage_start: string | null
  coverage_end: string | null
  created_at: string
}

interface PayoutRow {
  id: string
  user_id: string
  account_id: string
  date: string
  amount: number
  payout_number: number
  notes: string | null
  trader_received: number | null
  firm_split: number | null
  payout_split_percent: number | null
  created_at: string
}

function rowToAccount(row: AccountRow): Account {
  if (!VALID_FIRMS.includes(row.firm as Firm)) {
    throw new Error(`Unsupported firm in account ${row.id}; verified rules are unavailable`)
  }
  if (row.drawdown_type !== "EOD" && row.drawdown_type !== "Intraday") {
    throw new Error(`Unsupported drawdown type in account ${row.id}`)
  }
  return {
    id: row.id,
    name: row.name,
    // Prefix fallback keeps an older database safe until the migration lands.
    // Once is_demo exists, renaming an account cannot change its data scope.
    isDemo: row.is_demo ?? row.name.startsWith("DEMO ·"),
    firm: row.firm as Firm,
    type: row.type,
    status: row.status === "Inactive" ? "Active" : (row.status as "Active" | "Passed" | "Breached"),
    drawdownType: row.drawdown_type,
    accountSize: row.account_size,
    quantity: row.quantity ?? 1,
    balance: row.starting_balance,
    startingBalance: row.starting_balance,
    maxBalance: row.starting_balance,
    profitTarget: row.profit_target ?? undefined,
    maxDrawdown: row.max_drawdown,
    dailyLossLimit: row.daily_loss_limit ?? 0,
    manualIntradayFloor:
      row.manual_intraday_floor != null ? Number(row.manual_intraday_floor) : null,
    manualDrawdownRemaining:
      row.manual_drawdown_remaining != null ? Number(row.manual_drawdown_remaining) : null,
    manualDrawdownUpdatedAt: row.manual_drawdown_updated_at ?? null,
    activatedAt: row.activated_at ?? null,
    activationStartDate: row.activation_start_date ?? null,
    previousType: row.previous_type ?? null,
    createdAt: row.created_at ?? null,
    program: (row.program as TradeifyProgram | null) ?? null,
    legacyFiftyKTarget: row.legacy_fifty_k_target ?? false,
    hasDailyLossLimit: row.has_daily_loss_limit ?? false,
    topstepPayoutPath: (row.topstep_payout_path as TopstepPayoutPath | null) ?? null,
    alphaTier: (row.alpha_tier as AlphaTier | null) ?? null,
    riskSymbol: row.risk_symbol ?? null,
    riskContracts: row.risk_contracts != null ? Number(row.risk_contracts) : null,
    riskStopTicks: row.risk_stop_ticks != null ? Number(row.risk_stop_ticks) : null,
  }
}

function rowToInstrumentSpec(row: InstrumentSpecRow): InstrumentSpec {
  return {
    symbol: row.symbol,
    label: row.label,
    tickSize: Number(row.tick_size),
    tickValue: Number(row.tick_value),
    source: row.source,
    isBuiltin: row.user_id === null,
  }
}

function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    date: row.date,
    accountId: row.account_id,
    symbol: row.symbol,
    pnl: Number(row.pnl),
    notes: row.notes ?? undefined,
    session: row.session ?? undefined,
    direction: row.direction ?? undefined,
    grade: row.grade ?? undefined,
    setupTags: Array.isArray(row.setup_tags) ? row.setup_tags : [],
    disciplineTags: Array.isArray(row.discipline_tags) ? row.discipline_tags : [],
    entryPrice: row.entry_price != null ? Number(row.entry_price) : undefined,
    exitPrice: row.exit_price != null ? Number(row.exit_price) : undefined,
    contracts: row.contracts != null ? Number(row.contracts) : undefined,
    importSource: row.import_source === "screenshot" || row.import_source === "csv" ? row.import_source : null,
    rawSymbol: row.raw_symbol ?? null,
    isAggregate: row.is_aggregate ?? false,
    pnlHigh: row.pnl_high != null ? Number(row.pnl_high) : null,
    pnlLow: row.pnl_low != null ? Number(row.pnl_low) : null,
    commission: row.commission != null ? Number(row.commission) : null,
    avgWin: row.avg_win != null ? Number(row.avg_win) : null,
    avgLoss: row.avg_loss != null ? Number(row.avg_loss) : null,
    winDurationSeconds:
      row.win_duration_seconds != null ? Number(row.win_duration_seconds) : null,
    lossDurationSeconds:
      row.loss_duration_seconds != null ? Number(row.loss_duration_seconds) : null,
    winRatePercent: row.win_rate_percent != null ? Number(row.win_rate_percent) : null,
    extractionConfidence:
      row.extraction_confidence === "high" ||
      row.extraction_confidence === "medium" ||
      row.extraction_confidence === "low"
        ? row.extraction_confidence
        : null,
    importBatchId: row.import_batch_id ?? null,
    importKey: row.import_key ?? null,
  }
}

function rowToTradeImportBatch(row: TradeImportBatchRow): TradeImportBatch {
  return {
    id: row.id,
    accountId: row.account_id,
    source: row.source,
    filenames: Array.isArray(row.filenames) ? row.filenames : [],
    rowCount: Number(row.row_count),
    coverageStart: row.coverage_start,
    coverageEnd: row.coverage_end,
    createdAt: row.created_at,
  }
}

export interface ScreenshotTradeImportRequest {
  accountId: string
  source: ScreenshotImportSource
  filenames: string[]
  coverageStart: string | null
  coverageEnd: string | null
  warnings: string[]
  rows: ImportableScreenshotTradeRow[]
}

export interface ScreenshotTradeImportResult {
  insertedCount: number
  duplicateCount: number
  /** True only when the live database has not applied the import migration. */
  usedCompatibilityMode: boolean
}

function screenshotNotes(row: ImportableScreenshotTradeRow): string {
  const details = [
    `Imported aggregate from screenshot (${row.rawSymbol})`,
    row.commission != null ? `Commission $${row.commission}` : null,
    row.pnlHigh != null ? `P&L high $${row.pnlHigh}` : null,
    row.pnlLow != null ? `P&L low $${row.pnlLow}` : null,
  ].filter(Boolean)
  return details.join(" · ")
}

function rpcUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /import_screenshot_trade_rows/i.test(error.message ?? "") &&
      /schema cache|does not exist|could not find/i.test(error.message ?? "")
  )
}

/**
 * Imports all reviewed rows in one database transaction. Until the migration
 * is applied to an older local database, a one-statement compatibility insert
 * preserves core P&L and clearly records the source in notes.
 */
export async function importScreenshotTrades(
  request: ScreenshotTradeImportRequest,
): Promise<{ data: ScreenshotTradeImportResult | null; error: Error | null }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }
  if (request.rows.length === 0) return { data: null, error: new Error("No reviewed rows selected") }

  const rpcRows = request.rows.map((row) => ({
    trade_date: row.date,
    symbol: row.symbol,
    raw_symbol: row.rawSymbol,
    pnl: row.netPnl,
    contracts: row.quantity != null && Number.isInteger(row.quantity) ? row.quantity : null,
    notes: screenshotNotes(row),
    pnl_high: row.pnlHigh,
    pnl_low: row.pnlLow,
    commission: row.commission,
    avg_win: row.avgWin,
    avg_loss: row.avgLoss,
    win_duration_seconds:
      row.winDurationSeconds != null ? Math.round(row.winDurationSeconds) : null,
    loss_duration_seconds:
      row.lossDurationSeconds != null ? Math.round(row.lossDurationSeconds) : null,
    win_rate_percent: row.winRatePercent,
    extraction_confidence: row.confidence,
    import_key: createScreenshotImportKey(request.accountId, row),
  }))

  const { data, error } = await supabase.rpc("import_screenshot_trade_rows", {
    p_account_id: request.accountId,
    p_source: request.source,
    p_filenames: request.filenames,
    p_coverage_start: request.coverageStart,
    p_coverage_end: request.coverageEnd,
    p_warnings: request.warnings,
    p_rows: rpcRows,
  })

  if (!error) {
    const summary = Array.isArray(data) ? data[0] : data
    const typed = (summary ?? {}) as { inserted_count?: number; duplicate_count?: number }
    return {
      data: {
        insertedCount: Number(typed.inserted_count ?? 0),
        duplicateCount: Number(typed.duplicate_count ?? 0),
        usedCompatibilityMode: false,
      },
      error: null,
    }
  }

  if (!rpcUnavailable(error)) return { data: null, error: new Error(error.message) }

  // Compatibility path for an existing development DB before the new
  // migration is applied. This is still a single atomic INSERT statement.
  const { data: existing, error: existingError } = await supabase
    .from("trades")
    .select("date,symbol,pnl,contracts")
    .eq("account_id", request.accountId)
  if (existingError) return { data: null, error: new Error(existingError.message) }

  const pending = request.rows.filter(
    (row) =>
      !(existing ?? []).some(
        (trade) =>
          trade.date === row.date &&
          String(trade.symbol).toUpperCase() === row.symbol.toUpperCase() &&
          Number(trade.pnl) === row.netPnl &&
          (trade.contracts == null ||
            row.quantity == null ||
            Number(trade.contracts) === row.quantity),
      ),
  )
  const duplicateCount = request.rows.length - pending.length
  if (pending.length === 0) {
    return { data: { insertedCount: 0, duplicateCount, usedCompatibilityMode: true }, error: null }
  }

  const { error: insertError } = await supabase.from("trades").insert(
    pending.map((row) => ({
      user_id: user.id,
      account_id: request.accountId,
      date: row.date,
      symbol: row.symbol,
      pnl: row.netPnl,
      notes: screenshotNotes(row),
      contracts: row.quantity != null && Number.isInteger(row.quantity) ? row.quantity : null,
    })),
  )
  if (insertError) return { data: null, error: new Error(insertError.message) }

  return {
    data: { insertedCount: pending.length, duplicateCount, usedCompatibilityMode: true },
    error: null,
  }
}

function rowToPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    date: row.date,
    accountId: row.account_id,
    amount: Number(row.amount),
    payoutNumber: row.payout_number,
    notes: row.notes ?? undefined,
    traderReceived: row.trader_received ?? undefined,
    firmSplit: row.firm_split ?? undefined,
    payoutSplitPercent: row.payout_split_percent ?? undefined,
  }
}

function rowToAccountCost(row: AccountCostRow): AccountCost {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.cost_date,
    category: row.category,
    amount: Number(row.amount),
    notes: row.notes ?? undefined,
  }
}

function rowToDailySessionPlan(row: DailySessionPlanRow): DailySessionPlan {
  return {
    date: row.plan_date,
    reviewedRiskQueue: row.reviewed_risk_queue,
    confirmedFirmPortal: row.confirmed_firm_portal,
    checkedNewsEvents: row.checked_news_events,
    personalLossLimit:
      row.personal_loss_limit == null ? null : Number(row.personal_loss_limit),
    maxTrades: row.max_trades == null ? null : Number(row.max_trades),
    notes: row.notes ?? "",
  }
}

export async function fetchAccounts(): Promise<{ data: Account[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) return { data: null, error: new Error(error.message) }
  try {
    return { data: (data as AccountRow[]).map(rowToAccount), error: null }
  } catch (caught) {
    return { data: null, error: caught instanceof Error ? caught : new Error("Account data is invalid") }
  }
}

export async function fetchTrades(): Promise<{ data: Trade[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("date", { ascending: true })
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as TradeRow[]).map(rowToTrade), error: null }
}

export async function fetchTradeImportBatches(): Promise<{ data: TradeImportBatch[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("trade_import_batches")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as TradeImportBatchRow[]).map(rowToTradeImportBatch), error: null }
}

export async function fetchPayouts(): Promise<{ data: Payout[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as PayoutRow[]).map(rowToPayout), error: null }
}

export async function fetchAccountCosts(): Promise<{ data: AccountCost[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("account_costs")
    .select("*")
    .order("cost_date", { ascending: false })
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as AccountCostRow[]).map(rowToAccountCost), error: null }
}

export async function createAccountCost(input: {
  accountId: string
  date: string
  category: AccountCostCategory
  amount: number
  notes?: string
}): Promise<{ data: AccountCost | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const { data, error } = await supabase
    .from("account_costs")
    .insert({
      user_id: user.id,
      account_id: input.accountId,
      cost_date: input.date,
      category: input.category,
      amount: input.amount,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToAccountCost(data as AccountCostRow), error: null }
}

export async function deleteAccountCost(costId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("account_costs").delete().eq("id", costId)
  return { error: error ? new Error(error.message) : null }
}

export async function fetchDailySessionPlan(
  date: string,
): Promise<{ data: DailySessionPlan | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }
  const { data, error } = await supabase
    .from("daily_session_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("plan_date", date)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: data ? rowToDailySessionPlan(data as DailySessionPlanRow) : null, error: null }
}

export async function saveDailySessionPlan(
  plan: DailySessionPlan,
): Promise<{ data: DailySessionPlan | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }
  const { data, error } = await supabase
    .from("daily_session_plans")
    .upsert({
      user_id: user.id,
      plan_date: plan.date,
      reviewed_risk_queue: plan.reviewedRiskQueue,
      confirmed_firm_portal: plan.confirmedFirmPortal,
      checked_news_events: plan.checkedNewsEvents,
      personal_loss_limit: plan.personalLossLimit,
      max_trades: plan.maxTrades,
      notes: plan.notes.trim() || null,
    }, { onConflict: "user_id,plan_date" })
    .select()
    .single()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToDailySessionPlan(data as DailySessionPlanRow), error: null }
}

export async function createAccount(account: {
  name: string
  firm: Firm
  type: "Eval" | "PA" | "Live"
  drawdownType: DrawdownType
  accountSize: number
  quantity?: number
  startingBalance: number
  profitTarget?: number
  maxDrawdown: number
  dailyLossLimit?: number
  program?: TradeifyProgram | null
  legacyFiftyKTarget?: boolean
  hasDailyLossLimit?: boolean
  topstepPayoutPath?: TopstepPayoutPath | null
  alphaTier?: AlphaTier | null
  riskSymbol?: string | null
  riskContracts?: number | null
  riskStopTicks?: number | null
}): Promise<{ data: Account | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: account.name,
      is_demo: false,
      firm: account.firm,
      type: account.type,
      status: "Active",
      drawdown_type: account.drawdownType,
      account_size: account.accountSize,
      quantity: account.quantity ?? 1,
      starting_balance: account.startingBalance,
      profit_target: account.profitTarget ?? null,
      max_drawdown: account.maxDrawdown,
      daily_loss_limit: account.dailyLossLimit ?? null,
      program: account.program ?? null,
      legacy_fifty_k_target: account.legacyFiftyKTarget ?? false,
      has_daily_loss_limit: account.hasDailyLossLimit ?? false,
      topstep_payout_path: account.topstepPayoutPath ?? null,
      alpha_tier: account.alphaTier ?? null,
      risk_symbol: account.riskSymbol ?? null,
      risk_contracts: account.riskContracts ?? null,
      risk_stop_ticks: account.riskStopTicks ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToAccount(data as AccountRow), error: null }
}

export async function createTrade(
  trade: {
    accountId: string
    date: string
    symbol: string
    pnl: number
    notes?: string
  },
  meta: TradeMeta = {},
): Promise<{ data: Trade | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: user.id,
      account_id: trade.accountId,
      date: trade.date,
      symbol: trade.symbol,
      pnl: trade.pnl,
      notes: trade.notes ?? null,
      ...metaToDbPayload(meta),
    })
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToTrade(data as TradeRow), error: null }
}

export async function createCsvTrades(
  rows: Array<{ accountId: string; date: string; symbol: string; pnl: number; contracts: number | null; filename: string }>,
): Promise<{ data: Trade[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }
  if (rows.length === 0) return { data: [], error: null }

  const accountIds = [...new Set(rows.map((row) => row.accountId))]
  if (accountIds.length !== 1) return { data: null, error: new Error("A CSV import must target one account") }

  const { data: rpcData, error: rpcError } = await supabase.rpc("import_csv_trade_rows", {
    p_account_id: accountIds[0],
    p_filename: rows[0].filename,
    p_rows: rows.map((row) => ({
      trade_date: row.date,
      symbol: normalizeSymbol(row.symbol),
      pnl: row.pnl,
      contracts: row.contracts,
      notes: `Imported from CSV: ${row.filename}`,
    })),
  })
  if (!rpcError) {
    const summary = Array.isArray(rpcData) ? rpcData[0] : rpcData
    const batchId = (summary as { batch_id?: string } | null)?.batch_id
    if (!batchId) return { data: null, error: new Error("CSV import did not return a batch identifier") }
    const { data, error } = await supabase.from("trades").select("*").eq("import_batch_id", batchId)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: (data as TradeRow[]).map(rowToTrade), error: null }
  }
  if (!rpcUnavailable(rpcError)) return { data: null, error: new Error(rpcError.message) }

  const { data, error } = await supabase.from("trades").insert(rows.map((row) => ({
    user_id: user.id,
    account_id: row.accountId,
    date: row.date,
    symbol: normalizeSymbol(row.symbol),
    pnl: row.pnl,
    notes: `Imported from CSV: ${row.filename}`,
    ...metaToDbPayload({ contracts: row.contracts ?? undefined }),
  }))).select()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as TradeRow[]).map(rowToTrade), error: null }
}

export async function deleteTradeImportBatch(batchId: string): Promise<{ deletedCount: number; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("delete_trade_import_batch", { p_batch_id: batchId })
  if (error) return { deletedCount: 0, error: new Error(error.message) }
  const result = Array.isArray(data) ? data[0] : data
  return { deletedCount: Number((result as { deleted_count?: number } | null)?.deleted_count ?? 0), error: null }
}

export async function createPayout(payout: {
  accountId: string
  date: string
  amount: number
  payoutNumber: number
  notes?: string
  traderReceived?: number
  firmSplit?: number
  payoutSplitPercent?: number
}): Promise<{ data: Payout | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const { data, error } = await supabase
    .from("payouts")
    .insert({
      user_id: user.id,
      account_id: payout.accountId,
      date: payout.date,
      amount: payout.amount,
      payout_number: payout.payoutNumber,
      notes: payout.notes ?? null,
      trader_received: payout.traderReceived ?? null,
      firm_split: payout.firmSplit ?? null,
      payout_split_percent: payout.payoutSplitPercent ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToPayout(data as PayoutRow), error: null }
}

export async function deleteAccount(accountId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("accounts").delete().eq("id", accountId)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function deleteTrade(tradeId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("trades").delete().eq("id", tradeId)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function deletePayout(payoutId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("payouts").delete().eq("id", payoutId)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function updateAccount(
  accountId: string,
  updates: {
    name?: string
    firm?: Firm
    type?: "Eval" | "PA" | "Live"
    status?: "Active" | "Inactive" | "Breached" | "Passed"
    drawdownType?: DrawdownType
    accountSize?: number
    quantity?: number
    startingBalance?: number
    profitTarget?: number | null
    maxDrawdown?: number
    dailyLossLimit?: number | null
    manualIntradayFloor?: number | null
    manualDrawdownRemaining?: number | null
    manualDrawdownUpdatedAt?: string | null
    activatedAt?: string | null
    activationStartDate?: string | null
    previousType?: string | null
    program?: TradeifyProgram | null
    legacyFiftyKTarget?: boolean
    hasDailyLossLimit?: boolean
    topstepPayoutPath?: TopstepPayoutPath | null
    alphaTier?: AlphaTier | null
    riskSymbol?: string | null
    riskContracts?: number | null
    riskStopTicks?: number | null
  }
): Promise<{ data: Account | null; error: Error | null }> {
  const supabase = createClient()
  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.firm !== undefined) updateData.firm = updates.firm
  if (updates.type !== undefined) updateData.type = updates.type
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.drawdownType !== undefined) updateData.drawdown_type = updates.drawdownType
  if (updates.accountSize !== undefined) updateData.account_size = updates.accountSize
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity
  if (updates.startingBalance !== undefined) updateData.starting_balance = updates.startingBalance
  if (updates.profitTarget !== undefined) updateData.profit_target = updates.profitTarget
  if (updates.maxDrawdown !== undefined) updateData.max_drawdown = updates.maxDrawdown
  if (updates.dailyLossLimit !== undefined) updateData.daily_loss_limit = updates.dailyLossLimit
  if (updates.manualIntradayFloor !== undefined)
    updateData.manual_intraday_floor = updates.manualIntradayFloor
  if (updates.manualDrawdownRemaining !== undefined)
    updateData.manual_drawdown_remaining = updates.manualDrawdownRemaining
  if (updates.manualDrawdownUpdatedAt !== undefined)
    updateData.manual_drawdown_updated_at = updates.manualDrawdownUpdatedAt
  if (updates.activatedAt !== undefined) updateData.activated_at = updates.activatedAt
  if (updates.activationStartDate !== undefined)
    updateData.activation_start_date = updates.activationStartDate
  if (updates.previousType !== undefined) updateData.previous_type = updates.previousType
  if (updates.program !== undefined) updateData.program = updates.program
  if (updates.legacyFiftyKTarget !== undefined)
    updateData.legacy_fifty_k_target = updates.legacyFiftyKTarget
  if (updates.hasDailyLossLimit !== undefined)
    updateData.has_daily_loss_limit = updates.hasDailyLossLimit
  if (updates.topstepPayoutPath !== undefined)
    updateData.topstep_payout_path = updates.topstepPayoutPath
  if (updates.alphaTier !== undefined) updateData.alpha_tier = updates.alphaTier
  if (updates.riskSymbol !== undefined) updateData.risk_symbol = updates.riskSymbol
  if (updates.riskContracts !== undefined) updateData.risk_contracts = updates.riskContracts
  if (updates.riskStopTicks !== undefined) updateData.risk_stop_ticks = updates.riskStopTicks

  const { data, error } = await supabase
    .from("accounts")
    .update(updateData)
    .eq("id", accountId)
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToAccount(data as AccountRow), error: null }
}

export async function updateTrade(
  tradeId: string,
  updates: {
    date?: string
    accountId?: string
    symbol?: string
    pnl?: number
    notes?: string | null
  },
  meta?: TradeMeta,
): Promise<{ data: Trade | null; error: Error | null }> {
  const supabase = createClient()
  const updateData: Record<string, unknown> = {}
  if (updates.date !== undefined) updateData.date = updates.date
  if (updates.accountId !== undefined) updateData.account_id = updates.accountId
  if (updates.symbol !== undefined) updateData.symbol = updates.symbol
  if (updates.pnl !== undefined) updateData.pnl = updates.pnl
  if (updates.notes !== undefined) updateData.notes = updates.notes
  if (meta !== undefined) Object.assign(updateData, metaToDbPayload(meta))

  const { data, error } = await supabase
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToTrade(data as TradeRow), error: null }
}

/** Built-ins (user_id null) plus the current user's own rows. RLS already
 *  scopes this correctly. */
export async function fetchInstrumentSpecs(): Promise<{ data: InstrumentSpec[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("instrument_specs")
    .select("*")
    .order("symbol", { ascending: true })
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as InstrumentSpecRow[]).map(rowToInstrumentSpec), error: null }
}

/** Adds a user's own instrument, or updates it if they already have a row
 *  for that symbol (e.g. correcting their own earlier entry). Never touches
 *  a built-in row — a user can only shadow one via their own row, never
 *  edit the built-in itself. */
export async function upsertUserInstrumentSpec(spec: {
  symbol: string
  label: string
  tickSize: number
  tickValue: number
}): Promise<{ data: InstrumentSpec | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const symbol = normalizeSymbol(spec.symbol)
  const { data: existing } = await supabase
    .from("instrument_specs")
    .select("id")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .maybeSingle()

  const payload = {
    user_id: user.id,
    symbol,
    label: spec.label,
    tick_size: spec.tickSize,
    tick_value: spec.tickValue,
  }

  const { data, error } = existing
    ? await supabase.from("instrument_specs").update(payload).eq("id", (existing as { id: string }).id).select().single()
    : await supabase.from("instrument_specs").insert(payload).select().single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToInstrumentSpec(data as InstrumentSpecRow), error: null }
}

export async function deleteUserInstrumentSpec(symbol: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error("Not authenticated") }
  const { error } = await supabase
    .from("instrument_specs")
    .delete()
    .eq("user_id", user.id)
    .eq("symbol", normalizeSymbol(symbol))
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function fetchUserSettings(): Promise<{ data: RiskProfile | null; error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  const row = data as UserSettingsRow | null
  if (!row || !row.risk_symbol || !row.risk_contracts || !row.risk_stop_ticks) {
    return { data: null, error: null }
  }
  return {
    data: {
      symbol: row.risk_symbol,
      contracts: Number(row.risk_contracts),
      riskStopTicks: Number(row.risk_stop_ticks),
    },
    error: null,
  }
}

/** Upserts the user's default risk profile. Pass null to clear it. */
export async function saveUserSettings(
  profile: RiskProfile | null,
): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error("Not authenticated") }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      risk_symbol: profile ? normalizeSymbol(profile.symbol) : null,
      risk_contracts: profile?.contracts ?? null,
      risk_stop_ticks: profile?.riskStopTicks ?? null,
    },
    { onConflict: "user_id" },
  )
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function fetchOnboardingSettings(): Promise<{
  data: UserOnboardingSettings | null
  error: Error | null
}> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }
  const { data, error } = await supabase
    .from("user_settings")
    .select("onboarding_started,onboarding_dismissed,onboarding_visited_paths,onboarding_activated,onboarding_goal,onboarding_history_choice")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  const row = data as UserSettingsRow | null
  if (!row) return { data: null, error: null }
  return {
    data: {
      started: Boolean(row.onboarding_started),
      dismissed: Boolean(row.onboarding_dismissed),
      activated: Boolean(row.onboarding_activated),
      goal: row.onboarding_goal === "protect-funded" || row.onboarding_goal === "reach-payout" || row.onboarding_goal === "manage-multiple" || row.onboarding_goal === "pass-eval" ? row.onboarding_goal : null,
      historyChoice: row.onboarding_history_choice === "csv" || row.onboarding_history_choice === "screenshot" || row.onboarding_history_choice === "start-now" ? row.onboarding_history_choice : null,
      visitedPaths: Array.isArray(row.onboarding_visited_paths)
        ? row.onboarding_visited_paths.filter((path): path is string => typeof path === "string")
        : [],
    },
    error: null,
  }
}

export async function saveOnboardingSettings(
  state: UserOnboardingSettings,
): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error("Not authenticated") }
  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    onboarding_started: state.started,
    onboarding_dismissed: state.dismissed,
    onboarding_activated: state.activated,
    onboarding_goal: state.goal,
    onboarding_history_choice: state.historyChoice,
    onboarding_visited_paths: [...new Set(state.visitedPaths)],
  }, { onConflict: "user_id" })
  return { error: error ? new Error(error.message) : null }
}

export async function fetchSubscriptionEntitlement(): Promise<{
  data: SubscriptionEntitlement | null
  error: Error | null
}> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("tier,status,account_limit,screenshot_monthly_limit,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  const row = data as UserEntitlementRow | null
  if (!row) return { data: null, error: null }
  return {
    data: {
      tier: row.tier,
      status: row.status,
      accountLimit: row.account_limit == null ? null : Number(row.account_limit),
      screenshotMonthlyLimit: Number(row.screenshot_monthly_limit),
      currentPeriodEnd: row.current_period_end,
    },
    error: null,
  }
}

export async function fetchScreenshotUsageThisMonth(): Promise<{
  data: number | null
  error: Error | null
}> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { data, error } = await supabase
    .from("screenshot_scan_requests")
    .select("image_count")
    .eq("user_id", user.id)
    .gte("requested_at", monthStart)
  if (error) return { data: null, error: new Error(error.message) }
  return {
    data: (data ?? []).reduce((sum, row) => sum + Number((row as { image_count?: number }).image_count ?? 0), 0),
    error: null,
  }
}
