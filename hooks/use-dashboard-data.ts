"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchAccounts,
  fetchInstrumentSpecs,
  fetchPayouts,
  fetchTrades,
  fetchUserSettings,
  fetchAccountCosts,
  fetchTradeImportBatches,
} from "@/lib/supabase/database"
import type { Account, AccountCost, InstrumentSpec, Payout, RiskProfile, Trade, TradeImportBatch } from "@/lib/types"

export function useDashboardData() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [instrumentSpecs, setInstrumentSpecs] = useState<InstrumentSpec[]>([])
  const [userRiskProfile, setUserRiskProfile] = useState<RiskProfile | null>(null)
  const [accountCosts, setAccountCosts] = useState<AccountCost[]>([])
  const [accountCostsAvailable, setAccountCostsAvailable] = useState(false)
  const [importBatches, setImportBatches] = useState<TradeImportBatch[]>([])
  const [importBatchesAvailable, setImportBatchesAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAccountCostsAvailable(false)
    setImportBatchesAvailable(false)
    const [accountResult, tradeResult, payoutResult, specsResult, settingsResult, costsResult, batchesResult] = await Promise.all([
      fetchAccounts(),
      fetchTrades(),
      fetchPayouts(),
      fetchInstrumentSpecs(),
      fetchUserSettings(),
      fetchAccountCosts(),
      fetchTradeImportBatches(),
    ])
    const firstError = accountResult.error ?? tradeResult.error ?? payoutResult.error ?? specsResult.error ?? settingsResult.error
    if (firstError) setError(firstError.message)
    if (accountResult.data) setAccounts(accountResult.data)
    if (tradeResult.data) setTrades(tradeResult.data)
    if (payoutResult.data) setPayouts(payoutResult.data)
    if (specsResult.data) setInstrumentSpecs(specsResult.data)
    if (!settingsResult.error) setUserRiskProfile(settingsResult.data)
    if (!costsResult.error) {
      setAccountCosts(costsResult.data ?? [])
      setAccountCostsAvailable(true)
    }
    if (!batchesResult.error) {
      setImportBatches(batchesResult.data ?? [])
      setImportBatchesAvailable(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  return {
    accounts,
    trades,
    payouts,
    instrumentSpecs,
    userRiskProfile,
    accountCosts,
    accountCostsAvailable,
    importBatches,
    importBatchesAvailable,
    loading,
    error,
    reload,
    setAccounts,
    setTrades,
    setPayouts,
    setInstrumentSpecs,
    setUserRiskProfile,
    setAccountCosts,
    setImportBatches,
  }
}
