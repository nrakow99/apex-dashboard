"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { MetricsCard } from "@/components/metrics-card"
import { AccountTrajectory } from "@/components/account-trajectory"
import { TradeHistoryTable } from "@/components/trade-history-table"
import { TradingCalendar } from "@/components/trading-calendar"
import { RuleEnginePanel } from "@/components/rule-engine-panel"
import { AccountsPortfolioView } from "@/components/accounts-portfolio-view"
import { AccountsModalLayer } from "@/components/accounts-modal-layer"
import { PayoutStatusPanel } from "@/components/payout-status-panel"
import { AddTradeModal } from "@/components/add-trade-modal"
import { ScreenshotImportModal } from "@/components/screenshot-import-modal"
import { AddAccountModal } from "@/components/add-account-modal"
import type { ManualDrawdownMode } from "@/components/manual-intraday-drawdown-modal"
import {
  applyIntradayManualDrawdownToStats,
  hasIntradayManualDrawdown,
} from "@/lib/intraday-manual-drawdown"
import {
  getFloorDisplayTitle,
  getFloorMetricStatusLabel,
  shouldShowEodProjectedFloorSubValue,
} from "@/lib/floor-display-labels"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { cn, formatCurrency, formatPnL } from "@/lib/utils"
import { formatRepresentativeTrackingHelper } from "@/lib/account-quantity"
import { AccountQuantityBadge } from "@/components/account-quantity-badge"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { useToast } from "@/hooks/use-toast"
import {
  calculateDailyPnLData,
  calculateAccountStats,
  getConsistencyInfo,
  getPayoutEligibility,
  tradesEffectiveForAccount,
  payoutsEffectiveForAccount,
} from "@/lib/storage"
import { getAccountRules } from "@/lib/rules"
import { getAccountsOverview } from "@/lib/accounts-overview"
import {
  fetchAccounts,
  fetchTrades,
  fetchPayouts,
  fetchInstrumentSpecs,
  fetchUserSettings,
  createAccount,
  createTrade,
  createPayout,
  updateAccount,
  updateTrade,
  deleteAccount,
  deleteTrade,
} from "@/lib/supabase/database"
import {
  buildEvalToPaConversionUpdates,
  getEvalActivationStats,
  isEvalEligibleForPaActivation,
} from "@/lib/pa-activation"
import type { Trade, Payout, Account, AccountType, DrawdownType, Firm, DailyPnL, TradeifyProgram, TopstepPayoutPath, AlphaTier, InstrumentSpec, RiskProfile } from "@/lib/types"
import { migrateLocalTradeMetadata, type TradeMeta } from "@/lib/trade-meta"
import { BUILTIN_INSTRUMENTS } from "@/lib/instrument-specs"
import { DISPLAY_THRESHOLDS } from "@/lib/display-thresholds"
import { resolveRiskProfile, getHeadroom, tradesSuffix, lossEndsAccountText } from "@/lib/headroom"
import { scopeDecisionWorkspace } from "@/lib/workspace-scope"

type ViewMode = "accounts" | "detail"
type DetailSection = "overview" | "rules" | "history"

export default function Dashboard() {
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>("accounts")
  const [accountFilter, setAccountFilter] = useState<AccountType | "All">("All")
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [detailSection, setDetailSection] = useState<DetailSection>("overview")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [allTrades, setAllTrades] = useState<Trade[]>([])
  const [allPayouts, setAllPayouts] = useState<Payout[]>([])
  // Headroom-in-trades: instrument table (built-ins + user's own rows) and
  // the user-level default risk profile. Falls back to the built-in table
  // before the fetch resolves so the UI never shows a blank instrument list.
  const [instrumentSpecs, setInstrumentSpecs] = useState<InstrumentSpec[]>([...BUILTIN_INSTRUMENTS])
  const [userRiskProfile, setUserRiskProfile] = useState<RiskProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Edit/Delete modal states
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [manualIntradayModalOpen, setManualIntradayModalOpen] = useState(false)
  const [manualIntradayModalMode, setManualIntradayModalMode] = useState<ManualDrawdownMode>("remaining")
  const [activatePaOpen, setActivatePaOpen] = useState(false)
  const [activatePaEval, setActivatePaEval] = useState<Account | null>(null)
  const [onboardingAccountRequested, setOnboardingAccountRequested] = useState(false)

  // Load data from Supabase on mount
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Instrument settings and legacy metadata maintenance are optional.
      // They must never hold the entire Accounts screen on its loading state.
      const optionalSettings = Promise.all([
        fetchInstrumentSpecs(),
        fetchUserSettings(),
      ])
      const [accountsResult, tradesResult, payoutsResult] = await Promise.all([
        fetchAccounts(),
        fetchTrades(),
        fetchPayouts(),
      ])

      if (accountsResult.error) throw accountsResult.error
      if (tradesResult.error) throw tradesResult.error
      if (payoutsResult.error) throw payoutsResult.error

      const loadedTrades = tradesResult.data ?? []
      setAccounts(accountsResult.data ?? [])
      setAllTrades(loadedTrades)
      setAllPayouts(payoutsResult.data ?? [])

      // Headroom safely starts with the verified built-in instrument table.
      // User overrides can hydrate independently once Supabase responds.
      void optionalSettings.then(([instrumentsResult, userSettingsResult]) => {
        if (!instrumentsResult.error && instrumentsResult.data) {
          setInstrumentSpecs(instrumentsResult.data)
        }
        if (!userSettingsResult.error) setUserRiskProfile(userSettingsResult.data)
      })

      // Legacy localStorage migration is maintenance, not page-critical data.
      // Run it after first render so a stale browser lock cannot trap the UI.
      if (loadedTrades.length > 0) {
        void migrateLocalTradeMetadata(loadedTrades, updateTrade)
          .then((migrated) => {
            if (migrated.length > 0) setAllTrades(migrated)
          })
          .catch(() => undefined)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (typeof window === "undefined") return
    setOnboardingAccountRequested(new URLSearchParams(window.location.search).get("onboarding") === "account")
  }, [])

  useEffect(() => {
    if (accounts.length === 0 || typeof window === "undefined") return
    const syncViewFromUrl = () => {
      const accountId = new URLSearchParams(window.location.search).get("account")
      if (accountId && accounts.some((account) => account.id === accountId)) {
        setSelectedAccountId(accountId)
        setViewMode("detail")
        return
      }
      setSelectedAccountId(null)
      setViewMode("accounts")
    }

    syncViewFromUrl()
    window.addEventListener("popstate", syncViewFromUrl)
    return () => window.removeEventListener("popstate", syncViewFromUrl)
  }, [accounts])

  useEffect(() => { setDetailSection("overview") }, [selectedAccountId])

  // Get selected account
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) ?? null
  }, [accounts, selectedAccountId])

  const resolvedRulesByAccount = useMemo(() => {
    const resolved = new Map<string, ReturnType<typeof getAccountRules> | null>()
    for (const account of accounts) {
      try {
        resolved.set(account.id, getAccountRules(account))
      } catch {
        resolved.set(account.id, null)
      }
    }
    return resolved
  }, [accounts])

  const selectedRules = selectedAccount
    ? resolvedRulesByAccount.get(selectedAccount.id) ?? null
    : null

  // Filter accounts by type
  const filteredAccounts = useMemo(() => {
    if (accountFilter === "All") return accounts
    return accounts.filter((a) => a.type === accountFilter)
  }, [accounts, accountFilter])

  const filteredValidAccounts = useMemo(
    () => filteredAccounts.filter((account) => resolvedRulesByAccount.get(account.id) != null),
    [filteredAccounts, resolvedRulesByAccount],
  )

  const configurationIssueCount = filteredAccounts.length - filteredValidAccounts.length

  // Get data for selected account
  const accountTrades = useMemo(() => {
    if (!selectedAccount) return []
    return tradesEffectiveForAccount(selectedAccount, allTrades)
  }, [allTrades, selectedAccount])

  const accountPayouts = useMemo(() => {
    if (!selectedAccount) return []
    return payoutsEffectiveForAccount(selectedAccount, allPayouts)
  }, [allPayouts, selectedAccount])

  const accountDailyData = useMemo((): DailyPnL[] => {
    if (!selectedAccount || !selectedRules) return []
    return calculateDailyPnLData(selectedAccount.id, allTrades, selectedAccount, allPayouts)
  }, [selectedAccount, selectedRules, allTrades, allPayouts])

  const accountStats = useMemo(() => {
    if (!selectedAccount || !selectedRules) return null
    return calculateAccountStats(selectedAccount, allTrades, allPayouts)
  }, [selectedAccount, selectedRules, allTrades, allPayouts])

  /** Display-only floor/drawdown for intraday manual Tradovate overrides; payout logic uses raw accountStats */
  const displayAccountStats = useMemo(() => {
    if (!selectedAccount || !accountStats) return null
    return applyIntradayManualDrawdownToStats(selectedAccount, accountStats)
  }, [selectedAccount, accountStats])

  /** Headroom-in-trades for the selected account's drawdown remaining —
   *  account override if complete, else the user default, else
   *  dollars-only (trades: null). See lib/headroom.ts. */
  const selectedAccountHeadroom = useMemo(() => {
    if (!selectedAccount || !displayAccountStats) return null
    const profile = resolveRiskProfile(selectedAccount, userRiskProfile, instrumentSpecs)
    return getHeadroom(displayAccountStats.drawdownRemaining, profile)
  }, [selectedAccount, displayAccountStats, userRiskProfile, instrumentSpecs])

  const consistencyInfo = useMemo(() => {
    if (!selectedAccount || !selectedRules) return null
    if (selectedRules.hasConsistency) {
      return getConsistencyInfo(selectedAccount.id, allTrades, selectedAccount, allPayouts)
    }
    // Apex PA: qualifying-day count lives on consistencyInfo (no eval-style consistency card)
    if (selectedAccount.firm === "Apex" && selectedAccount.type === "PA" && selectedRules.minProfitDays > 0) {
      return getConsistencyInfo(selectedAccount.id, allTrades, selectedAccount, allPayouts)
    }
    return null
  }, [selectedAccount, selectedRules, allTrades, allPayouts])

  const payoutEligibility = useMemo(() => {
    if (!selectedAccount || !selectedRules || selectedAccount.type !== "PA") return null
    return getPayoutEligibility(selectedAccount.id, allTrades, selectedAccount, allPayouts)
  }, [selectedAccount, selectedRules, allTrades, allPayouts])

  const accountDirective = useMemo(() => {
    if (!selectedAccount || !selectedRules || !accountStats || !displayAccountStats) return null
    const room = Math.max(0, displayAccountStats.drawdownRemaining)
    const roomFraction = selectedRules.maxDrawdown > 0 ? room / selectedRules.maxDrawdown : 1

    if (selectedAccount.status === "Breached" || !displayAccountStats.isSafe) {
      return {
        eyebrow: "Trading decision",
        title: "Do not trade this account",
        body: `The active floor has been breached. Keep it out of today’s rotation and confirm next steps with ${selectedAccount.firm}.`,
        action: "Review rule status",
        target: "rule-status",
        critical: true,
      }
    }

    if (roomFraction <= DISPLAY_THRESHOLDS.protectFirstRoomFraction) {
      return {
        eyebrow: "Protect first",
        title: `${formatCurrency(room)} of loss room remains`,
        body: "This is the tightest constraint on the account. Reduce exposure before pursuing another objective.",
        action: "Review risk limits",
        target: "rule-status",
        critical: true,
      }
    }

    if (payoutEligibility?.isEligible) {
      return {
        eyebrow: "Best next move",
        title: "Payout request is ready",
        body: `${formatCurrency(payoutEligibility.maxWithdrawable)} is currently available within this account’s verified payout rules.`,
        action: "Review payout",
        target: "payout-status",
        critical: false,
      }
    }

    if (selectedAccount.type === "PA" && payoutEligibility) {
      return {
        eyebrow: "Next payout gate",
        title: payoutEligibility.missingConditions[0] ?? "Continue building the payout buffer",
        body: `${formatCurrency(room)} of loss room remains while this requirement is completed.`,
        action: "See payout checklist",
        target: "payout-status",
        critical: false,
      }
    }

    if (selectedAccount.type === "Eval" && selectedRules.hasProfitTarget) {
      const target = selectedRules.profitTarget
      const remaining = Math.max(0, target - accountStats.totalPnL)
      return {
        eyebrow: "Evaluation objective",
        title: remaining > 0 ? `${formatCurrency(remaining)} to the profit target` : "Profit target reached",
        body: `${formatCurrency(room)} of loss room remains. The objective is progress without compressing the floor buffer.`,
        action: "Review pass rules",
        target: "rule-status",
        critical: false,
      }
    }

    return {
      eyebrow: "Account posture",
      title: "Within current limits",
      body: `${formatCurrency(room)} of loss room remains. No more specific verified objective is available for this account.`,
      action: "Review account rules",
      target: "rule-status",
      critical: false,
    }
  }, [selectedAccount, selectedRules, accountStats, displayAccountStats, payoutEligibility])

  const selectedEvalEligible = useMemo(() => {
    if (!selectedAccount || !selectedRules || selectedAccount.type !== "Eval") return false
    const at = allTrades.filter((t) => t.accountId === selectedAccount.id)
    const ap = allPayouts.filter((p) => p.accountId === selectedAccount.id)
    const stats = getEvalActivationStats(selectedAccount, at, ap)
    return isEvalEligibleForPaActivation(selectedAccount, stats, at, ap)
  }, [selectedAccount, selectedRules, allTrades, allPayouts])

  /** Fourth top metric: qualifying days (PA), profit/consistency (Eval), or trading days (Live). Display-only; counts match rules/payout helpers. */
  const fourthStatMetric = useMemo(() => {
    if (!selectedAccount || !selectedRules || !accountStats) return null
    const rules = selectedRules

    if (selectedAccount.type === "PA") {
      const minReq = rules.minProfitDays
      const minDaily = rules.minDailyProfit

      if (selectedAccount.firm === "Lucid" && payoutEligibility?.firm === "Lucid") {
        const count = payoutEligibility.cycleProfitDays
        return {
          title: "Qualifying Days",
          value: count.toString(),
          change: {
            value: `${count} / ${minReq} required`,
            isPositive: count >= minReq,
          },
          subValue: `$${minDaily.toLocaleString()}+ profit days (this payout cycle)`,
        }
      }

      if (
        selectedAccount.firm === "Tradeify" &&
        payoutEligibility?.firm === "Tradeify" &&
        payoutEligibility.tradeifyProgram === "select_flex"
      ) {
        const count = payoutEligibility.winningDays
        if (count == null) {
          return {
            title: "Winning Days",
            value: "Unavailable",
            change: {
              value: "Cycle count unavailable",
              isPositive: false,
            },
          }
        }
        return {
          title: "Winning Days",
          value: count.toString(),
          change: {
            value: `${count} / ${minReq} required`,
            isPositive: count >= minReq,
          },
          subValue: `$${rules.winningDayThreshold}+ profit days (this cycle)`,
        }
      }

      if (selectedAccount.firm === "Apex") {
        const count = accountDailyData.filter((d) => d.pnl >= rules.minDailyProfit).length
        return {
          title: "Qualifying Days",
          value: count.toString(),
          change: {
            value: `${count} / ${minReq} required`,
            isPositive: count >= minReq,
          },
          subValue: `$${minDaily.toLocaleString()}+ profit days`,
        }
      }
    }

    if (selectedAccount.type === "Eval") {
      const pt = rules.hasProfitTarget ? rules.profitTarget : null

      if (rules.hasProfitTarget && pt != null && pt > 0) {
        return {
          title: "Profit Target",
          value: formatCurrency(pt),
          change: {
            value: `${formatCurrency(Math.max(0, pt - accountStats.totalPnL))} remaining`,
            isPositive: accountStats.totalPnL >= pt,
          },
          subValue: `${Math.max(0, Math.min(100, (accountStats.totalPnL / pt) * 100)).toFixed(0)}% complete`,
        }
      }

      if (rules.hasConsistency && consistencyInfo) {
        return {
          title: "Consistency",
          value: consistencyInfo.isValid ? "Compliant" : "Review",
          change: {
            value: `${rules.consistencyPercent}% largest-day vs total profit`,
            isPositive: consistencyInfo.isValid,
          },
        }
      }

      if (rules.minTradingDays > 0) {
        return {
          title: "Trading Days",
          value: accountStats.tradingDays.toString(),
          change: {
            value: `${rules.minTradingDays} required`,
            isPositive: accountStats.tradingDays >= rules.minTradingDays,
          },
        }
      }

      return {
        title: "Days Traded",
        value: accountStats.tradingDays.toString(),
        change: {
          value: "Days with executed trades",
          isPositive: accountStats.tradingDays > 0,
        },
      }
    }

    if (
      selectedAccount.type === "Live" &&
      rules.minProfitDays > 0 &&
      rules.minDailyProfit > 0
    ) {
      const count = accountDailyData.filter((d) => d.pnl >= rules.minDailyProfit).length
      return {
        title: "Qualifying Days",
        value: count.toString(),
        change: {
          value: `${count} / ${rules.minProfitDays} required`,
          isPositive: count >= rules.minProfitDays,
        },
        subValue: `$${rules.minDailyProfit.toLocaleString()}+ profit days`,
      }
    }

    return {
      title: "Trading Days",
      value: accountStats.tradingDays.toString(),
      change: {
        value: "Days with trades",
        isPositive: accountStats.tradingDays > 0,
      },
    }
  }, [
    selectedAccount,
    selectedRules,
    accountStats,
    accountDailyData,
    payoutEligibility,
    consistencyInfo,
  ])

  // Total cash withdrawn across all accounts
  const totalCashWithdrawn = useMemo(() => {
    return allPayouts.reduce((sum, p) => sum + p.amount, 0)
  }, [allPayouts])

  /** Portfolio summary for the accounts page — remaining room, not cash totals. */
  const accountsOverview = useMemo(() => {
    if (filteredValidAccounts.length === 0) return null
    const workspace = scopeDecisionWorkspace(filteredValidAccounts, allTrades, allPayouts)
    if (workspace.accounts.length === 0) return null
    return getAccountsOverview(workspace.accounts, workspace.trades, workspace.payouts)
  }, [filteredValidAccounts, allTrades, allPayouts])

  const handleSelectAccount = (account: Account) => {
    setSelectedAccountId(account.id)
    setViewMode("detail")
    if (typeof window !== "undefined") window.history.pushState({}, "", `/accounts?account=${account.id}`)
  }

  const handleBack = () => {
    setViewMode("accounts")
    setSelectedAccountId(null)
    if (typeof window !== "undefined") window.history.pushState({}, "", "/accounts")
  }

  // CREATE handlers
  const handleAddAccount = async (accountData: Omit<Account, "id">) => {
    setIsSaving(true)
    try {
      const result = await createAccount({
        name: accountData.name,
        firm: accountData.firm,
        type: accountData.type,
        drawdownType: accountData.drawdownType,
        accountSize: accountData.accountSize,
        quantity: accountData.quantity ?? 1,
        startingBalance: accountData.startingBalance,
        profitTarget: accountData.profitTarget,
        maxDrawdown: accountData.maxDrawdown,
        dailyLossLimit: accountData.dailyLossLimit,
        program: accountData.program ?? null,
        legacyFiftyKTarget: accountData.legacyFiftyKTarget,
        hasDailyLossLimit: accountData.hasDailyLossLimit,
        topstepPayoutPath: accountData.topstepPayoutPath ?? null,
        alphaTier: accountData.alphaTier ?? null,
      })

      if (result.error) throw result.error
      if (result.data) {
        setAccounts([...accounts, result.data])
        toast({ title: "Account created", description: `${result.data.name} has been added.` })
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create account", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTrade = async (
    tradeData: { date: string; symbol: string; pnl: number; notes?: string },
    meta: TradeMeta = {},
    accountIds: string[] = [],
  ) => {
    if (accountIds.length === 0) return
    setIsSaving(true)
    const created: Trade[] = []
    const failed: string[] = []
    try {
      for (const accountId of accountIds) {
        const result = await createTrade({ ...tradeData, accountId }, meta)
        if (result.error || !result.data) {
          const name = accounts.find((a) => a.id === accountId)?.name ?? accountId
          failed.push(name)
        } else {
          created.push(result.data)
        }
      }
      if (created.length > 0) {
        setAllTrades((prev) => [...prev, ...created])
      }
      const symbol = tradeData.symbol
      if (failed.length === 0) {
        toast({
          title: created.length === 1 ? "Trade added" : "Trades added",
          description:
            created.length === 1
              ? `${symbol} trade recorded.`
              : `${symbol} logged on ${created.length} accounts.`,
        })
      } else if (created.length > 0) {
        toast({
          title: "Partial save",
          description: `${symbol} logged on ${created.length} of ${accountIds.length} accounts. Failed: ${failed.join(", ")}`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: `Failed to create ${symbol} trade${accountIds.length > 1 ? "s" : ""}.`,
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create trade", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddPayout = async (payoutData: { date: string; amount: number; notes?: string }) => {
    if (!selectedAccount || !selectedRules) return

    setIsSaving(true)
    try {
      const accountPayoutCount = allPayouts.filter((p) => p.accountId === selectedAccount.id).length
      const splitPercent = selectedRules.payoutSplit
      const hasFirmSplit = splitPercent > 0 && splitPercent < 1

      const result = await createPayout({
        accountId: selectedAccount.id,
        date: payoutData.date,
        amount: payoutData.amount,
        payoutNumber: accountPayoutCount + 1,
        notes: payoutData.notes,
        traderReceived: hasFirmSplit ? payoutData.amount * splitPercent : undefined,
        firmSplit: hasFirmSplit ? payoutData.amount * (1 - splitPercent) : undefined,
        payoutSplitPercent: hasFirmSplit ? splitPercent : undefined,
      })

      if (result.error) throw result.error
      if (result.data) {
        setAllPayouts([...allPayouts, result.data])
        toast({ title: "Payout recorded", description: `$${payoutData.amount.toLocaleString()} withdrawal added.` })
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create payout", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // UPDATE handlers
  const handleUpdateTrade = async (
    tradeId: string,
    updates: { date: string; accountId: string; symbol: string; pnl: number; notes?: string },
    meta: TradeMeta = {},
  ) => {
    setIsSaving(true)
    try {
      const result = await updateTrade(
        tradeId,
        {
          date: updates.date,
          accountId: updates.accountId,
          symbol: updates.symbol,
          pnl: updates.pnl,
          notes: updates.notes ?? null,
        },
        meta,
      )

      if (result.error) throw result.error
      if (result.data) {
        setAllTrades(allTrades.map(t => t.id === tradeId ? result.data! : t))
        setEditingTrade(null)
        toast({ title: "Trade updated", description: "Your changes have been saved." })
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update trade", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateAccount = async (accountId: string, updates: {
    name: string
    firm: Firm
    type: AccountType
    status: "Active" | "Inactive" | "Breached" | "Passed"
    drawdownType: DrawdownType
    accountSize: number
    quantity: number
    startingBalance: number
    maxDrawdown: number
    dailyLossLimit: number | null
    profitTarget?: number | null
    program?: TradeifyProgram | null
    hasDailyLossLimit?: boolean
    topstepPayoutPath?: TopstepPayoutPath | null
    alphaTier?: AlphaTier | null
    riskSymbol?: string | null
    riskContracts?: number | null
    riskStopTicks?: number | null
  }) => {
    setIsSaving(true)
    try {
      const result = await updateAccount(accountId, {
        name: updates.name,
        firm: updates.firm,
        type: updates.type,
        status: updates.status,
        drawdownType: updates.drawdownType,
        accountSize: updates.accountSize,
        quantity: updates.quantity,
        startingBalance: updates.startingBalance,
        maxDrawdown: updates.maxDrawdown,
        dailyLossLimit: updates.dailyLossLimit,
        profitTarget: updates.profitTarget ?? null,
        program: updates.program,
        hasDailyLossLimit: updates.hasDailyLossLimit,
        topstepPayoutPath: updates.topstepPayoutPath,
        alphaTier: updates.alphaTier,
        riskSymbol: updates.riskSymbol,
        riskContracts: updates.riskContracts,
        riskStopTicks: updates.riskStopTicks,
      })

      if (result.error) throw result.error
      if (result.data) {
        setAccounts(accounts.map(a => a.id === accountId ? result.data! : a))
        setEditingAccount(null)
        toast({ title: "Account updated", description: "Your changes have been saved." })
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update account", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // DELETE handlers
  const handleDeleteTrade = async () => {
    if (!deletingTrade) return

    setIsSaving(true)
    try {
      const result = await deleteTrade(deletingTrade.id)

      if (result.error) throw result.error
      
      setAllTrades(allTrades.filter(t => t.id !== deletingTrade.id))
      setDeletingTrade(null)
      toast({ title: "Trade deleted", description: "The trade has been removed." })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete trade", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletingAccount) return

    setIsSaving(true)
    try {
      const result = await deleteAccount(deletingAccount.id)

      if (result.error) throw result.error
      
      setAccounts(accounts.filter(a => a.id !== deletingAccount.id))
      setAllTrades(allTrades.filter(t => t.accountId !== deletingAccount.id))
      setAllPayouts(allPayouts.filter(p => p.accountId !== deletingAccount.id))
      setDeletingAccount(null)
      
      // If we were viewing this account, go back to accounts list
      if (selectedAccountId === deletingAccount.id) {
        setViewMode("accounts")
        setSelectedAccountId(null)
      }
      
      toast({ title: "Account deleted", description: "The account and all related data have been removed." })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete account", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleManualIntradaySave = async (params: {
    manualIntradayFloor: number
    manualDrawdownRemaining: number
  }) => {
    if (!selectedAccount) return
    setIsSaving(true)
    try {
      const result = await updateAccount(selectedAccount.id, {
        manualIntradayFloor: params.manualIntradayFloor,
        manualDrawdownRemaining: params.manualDrawdownRemaining,
        manualDrawdownUpdatedAt: new Date().toISOString(),
      })
      if (result.error) throw result.error
      if (result.data) {
        setAccounts((prev) => prev.map((a) => (a.id === selectedAccount.id ? result.data! : a)))
        toast({ title: "Saved", description: "Intraday drawdown updated." })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not save",
        variant: "destructive",
      })
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const handleManualIntradayClear = async () => {
    if (!selectedAccount) return
    setIsSaving(true)
    try {
      const result = await updateAccount(selectedAccount.id, {
        manualIntradayFloor: null,
        manualDrawdownRemaining: null,
        manualDrawdownUpdatedAt: null,
      })
      if (result.error) throw result.error
      if (result.data) {
        setAccounts((prev) => prev.map((a) => (a.id === selectedAccount.id ? result.data! : a)))
        toast({ title: "Cleared", description: "Manual intraday override removed." })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not clear",
        variant: "destructive",
      })
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const handleActivatePa = async ({
    name,
    activatedAtIso,
    activationStartDate,
    tradeifyProgram,
    topstepPayoutPath,
  }: {
    name: string
    activatedAtIso: string
    activationStartDate: string
    tradeifyProgram?: "select_flex" | "select_daily"
    topstepPayoutPath?: TopstepPayoutPath
  }) => {
    if (!activatePaEval) return
    const evalAccount = activatePaEval
    setIsSaving(true)
    try {
      const updates = buildEvalToPaConversionUpdates(evalAccount, name, activatedAtIso, activationStartDate, tradeifyProgram, topstepPayoutPath)
      const result = await updateAccount(evalAccount.id, updates)
      if (result.error) throw result.error
      await loadData()
      setActivatePaOpen(false)
      setActivatePaEval(null)
      toast({ title: "Performance account activated", description: `${updates.name} is now a funded account. PA metrics use trades on or after ${activationStartDate}.` })
    } catch (err) {
      toast({ title: "Activation failed", description: err instanceof Error ? err.message : "Could not activate PA", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen premium-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] px-8 py-7">
            <div className="rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] p-3">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--text)]" />
          </div>
          <p className="text-sm text-slate-300">Loading your accounts...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && accounts.length === 0) {
    return (
      <div className="min-h-screen premium-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="h-8 w-8 text-[var(--text)]" />
          <p className="text-[var(--text)]">{error}</p>
          <Button variant="outline" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen premium-shell">
      <AccountsModalLayer
        accounts={accounts}
        instrumentSpecs={instrumentSpecs}
        isSaving={isSaving}
        editingTrade={editingTrade}
        setEditingTrade={setEditingTrade}
        onUpdateTrade={handleUpdateTrade}
        deletingTrade={deletingTrade}
        setDeletingTrade={setDeletingTrade}
        onDeleteTrade={handleDeleteTrade}
        editingAccount={editingAccount}
        setEditingAccount={setEditingAccount}
        onUpdateAccount={handleUpdateAccount}
        deletingAccount={deletingAccount}
        setDeletingAccount={setDeletingAccount}
        onDeleteAccount={handleDeleteAccount}
        selectedAccount={selectedAccount}
        currentBalance={accountStats?.currentBalance}
        estimatedFloor={accountStats?.activeEodFloor ?? accountStats?.minBalance}
        estimatedDrawdownRemaining={accountStats?.drawdownRemaining}
        manualIntradayOpen={manualIntradayModalOpen}
        setManualIntradayOpen={setManualIntradayModalOpen}
        manualIntradayMode={manualIntradayModalMode}
        onManualSave={handleManualIntradaySave}
        onManualClear={handleManualIntradayClear}
        activatePaOpen={activatePaOpen}
        setActivatePaOpen={setActivatePaOpen}
        activatePaEval={activatePaEval}
        setActivatePaEval={setActivatePaEval}
        onActivatePa={handleActivatePa}
      />

      {/* Error toast */}
      {error && accounts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-4 py-3 text-[var(--text)]">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--muted)] hover:text-[var(--text)]">
            ×
          </button>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}

      <AppShell
        eyebrow={viewMode === "accounts" ? "Portfolio control" : `${selectedAccount?.firm ?? "Account"} · ${selectedAccount?.type ?? ""}`}
        title={viewMode === "accounts" ? "Accounts" : selectedAccount?.name ?? "Account"}
        description={
          viewMode === "accounts"
            ? "Know which accounts can be traded, protected, or paid out."
            : selectedAccount
              ? selectedRules
                ? `${selectedAccount.drawdownType ?? "EOD"} drawdown · live rule and payout position`
                : "Rule configuration required before account metrics are available"
              : undefined
        }
        leading={viewMode === "detail" ? (
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-10 w-10 shrink-0 border border-[var(--hairline)] bg-[var(--raised)]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : undefined}
        actions={viewMode === "accounts" ? <>
          {totalCashWithdrawn > 0 && (
            <div className="mr-1 hidden border-r border-[var(--hairline)] pr-4 sm:block">
              <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Withdrawn</p>
              <p className="mt-1 font-mono text-sm font-medium">{formatCurrency(totalCashWithdrawn)}</p>
            </div>
          )}
          {accounts.length > 0 && (
            <>
              <ScreenshotImportModal
                accounts={accounts}
                selectedAccountId={accounts[0]?.id ?? ""}
                existingTrades={allTrades}
                onImported={async (result) => {
                  const refreshed = await fetchTrades()
                  if (refreshed.error) throw refreshed.error
                  setAllTrades(refreshed.data ?? [])
                  toast({
                    title: result.insertedCount > 0 ? "Trading history imported" : "No new rows imported",
                    description: [
                      result.insertedCount > 0
                        ? `${result.insertedCount} reviewed row${result.insertedCount === 1 ? "" : "s"} added.`
                        : null,
                      result.duplicateCount > 0
                        ? `${result.duplicateCount} duplicate${result.duplicateCount === 1 ? " was" : "s were"} skipped.`
                        : null,
                      result.usedCompatibilityMode
                        ? "Core P&L was saved; apply the latest database migration to retain full import metadata."
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" "),
                  })
                }}
              />
              <AddTradeModal
                accounts={accounts}
                selectedAccountId={accounts[0]?.id ?? ""}
                userDefaultRiskProfile={userRiskProfile}
                onAddTrade={handleAddTrade}
              />
            </>
          )}
          <AddAccountModal
            onAddAccount={handleAddAccount}
            requestedOpen={onboardingAccountRequested}
            onOpenChange={(open) => {
              setOnboardingAccountRequested(open)
              if (!open && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("onboarding") === "account") {
                window.history.replaceState({}, "", "/accounts")
              }
            }}
          />
        </> : selectedAccount ? <>
          {accounts.length > 1 && <select
            aria-label="Select account"
            value={selectedAccount.id}
            onChange={(event) => {
              setSelectedAccountId(event.target.value)
              if (typeof window !== "undefined") window.history.pushState({}, "", `/accounts?account=${event.target.value}`)
            }}
            className="h-10 max-w-[220px] rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] px-3 text-xs text-white outline-none focus:border-[var(--faint)]"
          >
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>}
          {selectedAccount.type === "Eval" && selectedEvalEligible && (
            <Button
              size="sm"
              className="bg-white text-black hover:bg-white/90"
              onClick={() => {
                setActivatePaEval(selectedAccount)
                setActivatePaOpen(true)
              }}
            >
              Activate PA
            </Button>
          )}
          <ScreenshotImportModal
            accounts={accounts}
            selectedAccountId={selectedAccount.id}
            existingTrades={allTrades}
            onImported={async (result) => {
              const refreshed = await fetchTrades()
              if (refreshed.error) throw refreshed.error
              setAllTrades(refreshed.data ?? [])
              toast({
                title: result.insertedCount > 0 ? "Trading history imported" : "No new rows imported",
                description: [
                  result.insertedCount > 0
                    ? `${result.insertedCount} reviewed row${result.insertedCount === 1 ? "" : "s"} added.`
                    : null,
                  result.duplicateCount > 0
                    ? `${result.duplicateCount} duplicate${result.duplicateCount === 1 ? " was" : "s were"} skipped.`
                    : null,
                  result.usedCompatibilityMode
                    ? "Core P&L was saved; apply the latest database migration to retain full import metadata."
                    : null,
                ]
                  .filter(Boolean)
                  .join(" "),
              })
            }}
          />
          <AddTradeModal
            accounts={accounts}
            selectedAccountId={selectedAccount.id}
            userDefaultRiskProfile={userRiskProfile}
            onAddTrade={handleAddTrade}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 border border-[var(--hairline)] bg-[var(--raised)]">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setEditingAccount(selectedAccount)}><Pencil className="mr-2 h-4 w-4" />Edit Account</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeletingAccount(selectedAccount)} className="font-semibold"><Trash2 className="mr-2 h-4 w-4" />Delete Account</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </> : undefined}
      >
        <DemoDataBanner accounts={accounts} />
        {viewMode === "accounts" ? (
          <AccountsPortfolioView
            accountFilter={accountFilter}
            onFilterChange={setAccountFilter}
            accounts={filteredAccounts}
            resolvedRules={resolvedRulesByAccount}
            overview={accountsOverview}
            configurationIssueCount={configurationIssueCount}
            trades={allTrades}
            payouts={allPayouts}
            instrumentSpecs={instrumentSpecs}
            userRiskProfile={userRiskProfile}
            onSelect={handleSelectAccount}
            onEdit={setEditingAccount}
            onDelete={setDeletingAccount}
            onActivate={(account) => { setActivatePaEval(account); setActivatePaOpen(true) }}
            onAddAccount={handleAddAccount}
          />
        ) : (
          selectedAccount && !selectedRules ? (
            <div className="rounded-[2px] border border-[var(--hairline)] border-l-2 border-l-[var(--text)] bg-[var(--surface)] p-6 sm:p-8">
              <p className="text-[9px] font-medium uppercase tracking-[0.17em] text-[var(--muted)]">Account unavailable</p>
              <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em]">Rule configuration required</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                This account does not match a supported firm program and size. No floor, target, consistency, or payout value will be shown until the settings are corrected.
              </p>
              <Button type="button" className="mt-6" onClick={() => setEditingAccount(selectedAccount)}>
                Edit account settings
              </Button>
            </div>
          ) : selectedAccount &&
          accountStats && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <AccountQuantityBadge account={selectedAccount} className="text-xs" />
                {formatRepresentativeTrackingHelper(selectedAccount) && (
                  <span className="text-[11px] text-[var(--muted)]">{formatRepresentativeTrackingHelper(selectedAccount)}</span>
                )}
              </div>

              <div className="sticky top-0 z-20 mb-5 flex gap-1 border border-[var(--hairline)] bg-[var(--surface)] p-1" role="tablist" aria-label="Account detail sections">
                {([
                  ["overview", "Overview", "Balance and next action"],
                  ["rules", "Rules & payouts", "Limits and withdrawal status"],
                  ["history", "History", `${accountTrades.length} trades`],
                ] as const).map(([value, label, helper]) => <button key={value} type="button" role="tab" aria-selected={detailSection === value} onClick={() => setDetailSection(value)} className={cn("min-w-0 flex-1 rounded-[2px] px-3 py-2.5 text-left transition-colors", detailSection === value ? "bg-white text-black" : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-white")}>
                  <span className="block text-xs font-medium sm:text-sm">{label}</span>
                  <span className={cn("mt-0.5 hidden text-[9px] sm:block", detailSection === value ? "text-black/60" : "text-[var(--faint)]")}>{helper}</span>
                </button>)}
              </div>

              {detailSection === "overview" && <>
              {accountDirective && (
                <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.7fr)]">
                  <AccountTrajectory account={selectedAccount} data={accountDailyData} stats={displayAccountStats!} />
                  <div className={cn(
                    "flex min-h-[280px] flex-col justify-between rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] p-6",
                    accountDirective.critical && "border-l-4 border-l-white",
                  )}>
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.17em] text-[var(--muted)]">{accountDirective.eyebrow}</p>
                      <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.035em]">{accountDirective.title}</h2>
                      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{accountDirective.body}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-8 w-full justify-between"
                      onClick={() => setDetailSection("rules")}
                    >
                      {accountDirective.action}
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </Button>
                  </div>
                </div>
              )}

              {/* TOP ROW: Stats Cards */}
              <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--hairline)] lg:grid-cols-5 [&>*]:border-0">
                <MetricsCard
                  className="order-1 lg:order-none"
                  title="Account Balance"
                  value={formatCurrency(accountStats.currentBalance)}
                  change={{
                    value: `${formatCurrency(Math.abs(accountStats.totalPnL))} total`,
                    isPositive: accountStats.totalPnL >= 0,
                  }}
                />
                <MetricsCard
                  className="order-3 lg:order-2"
                  title={getFloorDisplayTitle(selectedAccount)}
                  value={formatCurrency(
                    displayAccountStats!.activeEodFloor ?? displayAccountStats!.minBalance,
                  )}
                  status={{
                    label: getFloorMetricStatusLabel(selectedAccount, {
                      isTradingDayComplete: accountStats.isTradingDayComplete,
                    }),
                    isGood: displayAccountStats!.isSafe,
                  }}
                  subValue={
                    shouldShowEodProjectedFloorSubValue(selectedAccount, {
                      isTradingDayComplete: accountStats.isTradingDayComplete,
                      projectedEodFloor: accountStats.projectedEodFloor,
                      activeEodFloor: accountStats.activeEodFloor,
                    })
                      ? `Projected: ${formatCurrency(accountStats.projectedEodFloor)}`
                      : undefined
                  }
                  titleAction={
                    selectedAccount.drawdownType === "Intraday" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[var(--muted)] hover:text-[var(--text)]"
                        title="Edit intraday floor"
                        onClick={() => {
                          setManualIntradayModalMode("floor")
                          setManualIntradayModalOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : undefined
                  }
                />
                <MetricsCard
                  className="order-2 lg:order-3"
                  title="Total PnL"
                  value={formatPnL(accountStats.totalPnL)}
                  change={{
                    value: `${accountTrades.length} trades`,
                    isPositive: accountStats.totalPnL >= 0,
                  }}
                />
                {fourthStatMetric && (
                  <MetricsCard
                    className="order-4 lg:order-4"
                    title={fourthStatMetric.title}
                    value={fourthStatMetric.value}
                    change={fourthStatMetric.change}
                    subValue={fourthStatMetric.subValue}
                  />
                )}
                <MetricsCard
                  className="order-5 col-span-2 lg:order-5 lg:col-span-1"
                  title="Drawdown Remaining"
                  value={formatCurrency(Math.max(0, displayAccountStats!.drawdownRemaining))}
                  change={{
                    value: `of ${formatCurrency(selectedRules!.maxDrawdown)}${selectedAccountHeadroom ? tradesSuffix(selectedAccountHeadroom) : ""}`,
                    isPositive:
                      displayAccountStats!.drawdownRemaining >
                      selectedRules!.maxDrawdown * DISPLAY_THRESHOLDS.metricPositiveRoomFraction,
                  }}
                  subValue={
                    selectedAccount.drawdownType === "Intraday" && hasIntradayManualDrawdown(selectedAccount)
                      ? "Manually updated from Tradovate."
                      : lossEndsAccountText(displayAccountStats!.drawdownRemaining)
                  }
                  titleAction={
                    selectedAccount.drawdownType === "Intraday" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[var(--muted)] hover:text-[var(--text)]"
                        title="Edit drawdown remaining"
                        onClick={() => {
                          setManualIntradayModalMode("remaining")
                          setManualIntradayModalOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : undefined
                  }
                />
              </div>
              </>}

              {detailSection === "rules" && <div id="rule-status" className={cn(
                "mb-6 grid items-start gap-4",
                selectedAccount.type === "PA" && payoutEligibility && selectedRules!.hasPayouts
                  ? "xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.75fr)]"
                  : "grid-cols-1",
              )}>
                <RuleEnginePanel
                  account={selectedAccount}
                  dailyData={accountDailyData}
                  stats={displayAccountStats!}
                  consistencyInfo={consistencyInfo}
                  instrumentSpecs={instrumentSpecs}
                  userDefaultRiskProfile={userRiskProfile}
                  lucidCycleQualifyingDays={
                    selectedAccount.firm === "Lucid" &&
                    selectedAccount.type === "PA" &&
                    payoutEligibility?.firm === "Lucid"
                      ? payoutEligibility.cycleProfitDays
                      : selectedAccount.firm === "Tradeify" &&
                          payoutEligibility?.firm === "Tradeify" &&
                          payoutEligibility.tradeifyProgram === "select_flex"
                        ? payoutEligibility.winningDays
                        : undefined
                  }
                />
                {selectedAccount.type === "PA" && payoutEligibility && selectedRules!.hasPayouts && (
                  <div id="payout-status">
                    <PayoutStatusPanel
                      account={selectedAccount}
                      eligibility={payoutEligibility}
                      payouts={accountPayouts}
                      onAddPayout={handleAddPayout}
                    />
                  </div>
                )}
              </div>}

              {detailSection === "history" && <div className="space-y-4">
                <TradingCalendar account={selectedAccount} dailyData={accountDailyData} trades={accountTrades} />
                <TradeHistoryTable trades={accountTrades} onEditTrade={setEditingTrade} onDeleteTrade={setDeletingTrade} />
              </div>}
            </>
          )
        )}
      </AppShell>
    </div>
  )
}
