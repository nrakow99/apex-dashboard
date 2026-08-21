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
} from "@/lib/types"
import { metaToDbPayload, type TradeMeta } from "@/lib/trade-meta"
import { normalizeSymbol } from "@/lib/instrument-specs"

const VALID_FIRMS: readonly Firm[] = ["Apex", "Lucid", "Tradeify", "Topstep", "Alpha"]

interface AccountRow {
  id: string
  user_id: string
  name: string
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
  return {
    id: row.id,
    name: row.name,
    // Every valid Firm passes through unchanged. Anything else (legacy rows,
    // corrupt data) falls back to "Apex" — but that fallback must never
    // silently masquerade as a real Topstep/Alpha account, which is why this
    // list is exhaustive rather than special-casing Lucid/Tradeify only (the
    // bug that used to reclassify every non-Lucid/Tradeify firm as Apex).
    firm: (VALID_FIRMS.includes(row.firm as Firm) ? row.firm : "Apex") as Firm,
    type: row.type,
    status: row.status === "Inactive" ? "Active" : (row.status as "Active" | "Passed" | "Breached"),
    drawdownType: (row.drawdown_type ?? "EOD") as DrawdownType,
    accountSize: row.account_size ?? 50000,
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

export async function fetchAccounts(): Promise<{ data: Account[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as AccountRow[]).map(rowToAccount), error: null }
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

export async function fetchPayouts(): Promise<{ data: Payout[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as PayoutRow[]).map(rowToPayout), error: null }
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
  maxDrawdown?: number
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
      firm: account.firm,
      type: account.type,
      status: "Active",
      drawdown_type: account.drawdownType,
      account_size: account.accountSize,
      quantity: account.quantity ?? 1,
      starting_balance: account.startingBalance,
      profit_target: account.profitTarget ?? null,
      max_drawdown: account.maxDrawdown ?? 2000,
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
