"use client"

import { createClient } from "@/lib/supabase/client"

export type RiskClampFamily = "NQ" | "ES"

export interface RiskClampSettings {
  accountId: string
  buffer: number
  stopPoints: number
  numAccounts: number
  family: RiskClampFamily
}

export interface RiskClampTrade {
  id: string
  date: string
  family: string
  stopPoints: number
  pnl: number
  note: string
  balanceAfter: number
}

interface SettingsRow {
  account_id: string
  buffer: number | string
  stop_points: number | string
  num_accounts: number
  family: string
}

interface TradeRow {
  id: string
  trade_date: string
  family: string
  stop_points: number | string
  pnl: number | string
  note: string | null
  balance_after: number | string
}

function rowToSettings(row: SettingsRow): RiskClampSettings {
  return {
    accountId: row.account_id,
    buffer: Number(row.buffer),
    stopPoints: Number(row.stop_points),
    numAccounts: Number(row.num_accounts) || 1,
    family: row.family === "ES" ? "ES" : "NQ",
  }
}

function rowToTrade(row: TradeRow): RiskClampTrade {
  return {
    id: row.id,
    date: row.trade_date,
    family: row.family,
    stopPoints: Number(row.stop_points),
    pnl: Number(row.pnl),
    note: row.note ?? "",
    balanceAfter: Number(row.balance_after),
  }
}

const DEFAULT_SETTINGS = {
  buffer: 2000,
  stopPoints: 30,
  numAccounts: 1,
  family: "NQ" as RiskClampFamily,
}

export async function fetchRiskClampSettings(
  accountId: string,
): Promise<{ data: RiskClampSettings | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("risk_clamp_settings")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  if (!data) return { data: null, error: null }
  return { data: rowToSettings(data as SettingsRow), error: null }
}

export async function upsertRiskClampSettings(
  accountId: string,
  settings: {
    buffer: number
    stopPoints: number
    numAccounts: number
    family: string
  },
): Promise<{ data: RiskClampSettings | null; error: Error | null }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const { data, error } = await supabase
    .from("risk_clamp_settings")
    .upsert(
      {
        user_id: user.id,
        account_id: accountId,
        buffer: settings.buffer,
        stop_points: settings.stopPoints,
        num_accounts: Math.max(1, settings.numAccounts),
        family: settings.family === "ES" ? "ES" : "NQ",
      },
      { onConflict: "account_id" },
    )
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToSettings(data as SettingsRow), error: null }
}

export async function ensureRiskClampSettings(
  accountId: string,
  defaults?: { buffer?: number },
): Promise<{ data: RiskClampSettings | null; error: Error | null }> {
  const existing = await fetchRiskClampSettings(accountId)
  if (existing.error) return existing
  if (existing.data) return existing

  return upsertRiskClampSettings(accountId, {
    buffer: defaults?.buffer ?? DEFAULT_SETTINGS.buffer,
    stopPoints: DEFAULT_SETTINGS.stopPoints,
    numAccounts: DEFAULT_SETTINGS.numAccounts,
    family: DEFAULT_SETTINGS.family,
  })
}

export async function fetchRiskClampTrades(
  accountId: string,
): Promise<{ data: RiskClampTrade[] | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("risk_clamp_trades")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })

  if (error) return { data: null, error: new Error(error.message) }
  return { data: ((data as TradeRow[]) ?? []).map(rowToTrade), error: null }
}

export async function insertRiskClampTrade(
  accountId: string,
  trade: {
    tradeDate: string
    family: string
    stopPoints: number
    pnl: number
    note: string
    balanceAfter: number
  },
): Promise<{ data: RiskClampTrade | null; error: Error | null }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error("Not authenticated") }

  const { data, error } = await supabase
    .from("risk_clamp_trades")
    .insert({
      user_id: user.id,
      account_id: accountId,
      trade_date: trade.tradeDate,
      family: trade.family,
      stop_points: trade.stopPoints,
      pnl: trade.pnl,
      note: trade.note || null,
      balance_after: trade.balanceAfter,
    })
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: rowToTrade(data as TradeRow), error: null }
}

export async function deleteRiskClampTrades(
  accountId: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("risk_clamp_trades")
    .delete()
    .eq("account_id", accountId)

  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function resetRiskClampAccount(
  accountId: string,
): Promise<{ error: Error | null }> {
  const settingsResult = await upsertRiskClampSettings(accountId, {
    buffer: DEFAULT_SETTINGS.buffer,
    stopPoints: DEFAULT_SETTINGS.stopPoints,
    numAccounts: DEFAULT_SETTINGS.numAccounts,
    family: DEFAULT_SETTINGS.family,
  })
  if (settingsResult.error) return { error: settingsResult.error }

  return deleteRiskClampTrades(accountId)
}
