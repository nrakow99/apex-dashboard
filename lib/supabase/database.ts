"use client"

import { createClient } from "@/lib/supabase/client"
import type { Account, Trade, Payout } from "@/lib/types"

// Type definitions for database rows
interface AccountRow {
  id: string
  user_id: string
  name: string
  type: "Eval" | "PA" | "Live"
  status: "Active" | "Inactive" | "Breached"
  starting_balance: number
  profit_target: number | null
  max_drawdown: number
  daily_loss_limit: number | null
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
  created_at: string
}

// Transform database row to app type
function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status === "Inactive" ? "Active" : row.status as "Active" | "Passed" | "Breached",
    balance: row.starting_balance, // Will be calculated from trades
    startingBalance: row.starting_balance,
    maxBalance: row.starting_balance, // Will be calculated from trades
    profitTarget: row.profit_target ?? undefined,
    maxDrawdown: row.max_drawdown,
    dailyLossLimit: row.daily_loss_limit ?? 1000,
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
  }
}

// Fetch all accounts for current user
export async function fetchAccounts(): Promise<{ data: Account[] | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: (data as AccountRow[]).map(rowToAccount), error: null }
}

// Fetch all trades for current user
export async function fetchTrades(): Promise<{ data: Trade[] | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("date", { ascending: true })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: (data as TradeRow[]).map(rowToTrade), error: null }
}

// Fetch all payouts for current user
export async function fetchPayouts(): Promise<{ data: Payout[] | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: (data as PayoutRow[]).map(rowToPayout), error: null }
}

// Create a new account
export async function createAccount(account: {
  name: string
  type: "Eval" | "PA" | "Live"
  startingBalance: number
  profitTarget?: number
  maxDrawdown?: number
  dailyLossLimit?: number
}): Promise<{ data: Account | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: account.name,
      type: account.type,
      status: "Active",
      starting_balance: account.startingBalance,
      profit_target: account.profitTarget ?? null,
      max_drawdown: account.maxDrawdown ?? 2000,
      daily_loss_limit: account.dailyLossLimit ?? 1000,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: rowToAccount(data as AccountRow), error: null }
}

// Create a new trade
export async function createTrade(trade: {
  accountId: string
  date: string
  symbol: string
  pnl: number
  notes?: string
}): Promise<{ data: Trade | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: user.id,
      account_id: trade.accountId,
      date: trade.date,
      symbol: trade.symbol,
      pnl: trade.pnl,
      notes: trade.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: rowToTrade(data as TradeRow), error: null }
}

// Create a new payout
export async function createPayout(payout: {
  accountId: string
  date: string
  amount: number
  payoutNumber: number
  notes?: string
}): Promise<{ data: Payout | null; error: Error | null }> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error("Not authenticated") }
  }

  const { data, error } = await supabase
    .from("payouts")
    .insert({
      user_id: user.id,
      account_id: payout.accountId,
      date: payout.date,
      amount: payout.amount,
      payout_number: payout.payoutNumber,
      notes: payout.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: rowToPayout(data as PayoutRow), error: null }
}

// Delete an account (and all related trades/payouts via cascade)
export async function deleteAccount(accountId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId)

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

// Delete a trade
export async function deleteTrade(tradeId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", tradeId)

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

// Delete a payout
export async function deletePayout(payoutId: string): Promise<{ error: Error | null }> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from("payouts")
    .delete()
    .eq("id", payoutId)

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

// Update an account
export async function updateAccount(
  accountId: string,
  updates: {
    name?: string
    type?: "Eval" | "PA" | "Live"
    status?: "Active" | "Inactive" | "Breached" | "Passed"
    startingBalance?: number
    profitTarget?: number | null
    maxDrawdown?: number
    dailyLossLimit?: number
  }
): Promise<{ data: Account | null; error: Error | null }> {
  const supabase = createClient()

  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.type !== undefined) updateData.type = updates.type
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.startingBalance !== undefined) updateData.starting_balance = updates.startingBalance
  if (updates.profitTarget !== undefined) updateData.profit_target = updates.profitTarget
  if (updates.maxDrawdown !== undefined) updateData.max_drawdown = updates.maxDrawdown
  if (updates.dailyLossLimit !== undefined) updateData.daily_loss_limit = updates.dailyLossLimit

  const { data, error } = await supabase
    .from("accounts")
    .update(updateData)
    .eq("id", accountId)
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: rowToAccount(data as AccountRow), error: null }
}

// Update a trade
export async function updateTrade(
  tradeId: string,
  updates: {
    date?: string
    accountId?: string
    symbol?: string
    pnl?: number
    notes?: string | null
  }
): Promise<{ data: Trade | null; error: Error | null }> {
  const supabase = createClient()

  const updateData: Record<string, unknown> = {}
  if (updates.date !== undefined) updateData.date = updates.date
  if (updates.accountId !== undefined) updateData.account_id = updates.accountId
  if (updates.symbol !== undefined) updateData.symbol = updates.symbol
  if (updates.pnl !== undefined) updateData.pnl = updates.pnl
  if (updates.notes !== undefined) updateData.notes = updates.notes

  const { data, error } = await supabase
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: rowToTrade(data as TradeRow), error: null }
}
