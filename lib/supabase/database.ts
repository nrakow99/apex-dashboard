"use client"

import { createClient } from "@/lib/supabase/client"
import type { Account, Trade, Payout, Firm, DrawdownType, TradeifyProgram, TopstepPayoutPath, AlphaTier } from "@/lib/types"
import { metaToDbPayload, type TradeMeta } from "@/lib/trade-meta"

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
  created_at: string
  updated_at: string
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
