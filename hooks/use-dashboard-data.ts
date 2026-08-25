"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchAccounts,
  fetchInstrumentSpecs,
  fetchPayouts,
  fetchTrades,
  fetchUserSettings,
} from "@/lib/supabase/database"
import type { Account, InstrumentSpec, Payout, RiskProfile, Trade } from "@/lib/types"

export function useDashboardData() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [instrumentSpecs, setInstrumentSpecs] = useState<InstrumentSpec[]>([])
  const [userRiskProfile, setUserRiskProfile] = useState<RiskProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [accountResult, tradeResult, payoutResult, specsResult, settingsResult] = await Promise.all([
      fetchAccounts(),
      fetchTrades(),
      fetchPayouts(),
      fetchInstrumentSpecs(),
      fetchUserSettings(),
    ])
    const firstError = accountResult.error ?? tradeResult.error ?? payoutResult.error ?? specsResult.error ?? settingsResult.error
    if (firstError) setError(firstError.message)
    if (accountResult.data) setAccounts(accountResult.data)
    if (tradeResult.data) setTrades(tradeResult.data)
    if (payoutResult.data) setPayouts(payoutResult.data)
    if (specsResult.data) setInstrumentSpecs(specsResult.data)
    if (!settingsResult.error) setUserRiskProfile(settingsResult.data)
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
    loading,
    error,
    reload,
    setAccounts,
    setTrades,
    setPayouts,
    setInstrumentSpecs,
    setUserRiskProfile,
  }
}
