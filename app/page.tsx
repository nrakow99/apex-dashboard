"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { MetricsCard } from "@/components/metrics-card"
import { PerformanceChart } from "@/components/performance-chart"
import { TradeHistoryTable } from "@/components/trade-history-table"
import { TradingCalendar } from "@/components/trading-calendar"
import { RuleEnginePanel } from "@/components/rule-engine-panel"
import { AccountCard } from "@/components/account-card"
import { PayoutStatusPanel } from "@/components/payout-status-panel"
import { AddTradeModal } from "@/components/add-trade-modal"
import { AddAccountModal } from "@/components/add-account-modal"
import { EditTradeModal } from "@/components/edit-trade-modal"
import { EditAccountModal } from "@/components/edit-account-modal"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { ActivatePaModal } from "@/components/activate-pa-modal"
import { LiveClock } from "@/components/live-clock"
import { AccountRangeCard, shouldShowAccountRangeCard } from "@/components/account-range-card"
import {
  ManualIntradayDrawdownModal,
  type ManualDrawdownMode,
} from "@/components/manual-intraday-drawdown-modal"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, LogOut, Loader2, AlertCircle, RefreshCw, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { cn, formatCurrency, formatPnL } from "@/lib/utils"
import {
  getAccountQuantity,
  getPortfolioBalance,
  formatRepresentativeTrackingHelper,
  sumAccountQuantities,
} from "@/lib/account-quantity"
import { AccountQuantityBadge } from "@/components/account-quantity-badge"
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
import {
  fetchAccounts,
  fetchTrades,
  fetchPayouts,
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
import { createClient } from "@/lib/supabase/client"
import type { Trade, Payout, Account, AccountType, DrawdownType, Firm, DailyPnL, TradeifyProgram } from "@/lib/types"
import { migrateLocalTradeMetadata, type TradeMeta } from "@/lib/trade-meta"
import { RiskMetricsCard } from "@/components/risk-metrics-card"

type ViewMode = "accounts" | "detail"

export default function Dashboard() {
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>("accounts")
  const [accountFilter, setAccountFilter] = useState<AccountType | "All">("All")
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [allTrades, setAllTrades] = useState<Trade[]>([])
  const [allPayouts, setAllPayouts] = useState<Payout[]>([])
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

  // Load data from Supabase on mount
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
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

      if (loadedTrades.length > 0) {
        const migrated = await migrateLocalTradeMetadata(loadedTrades, updateTrade)
        if (migrated.length > 0) setAllTrades(migrated)
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

  // Sign out handler
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  // Get selected account
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) ?? null
  }, [accounts, selectedAccountId])

  // Filter accounts by type
  const filteredAccounts = useMemo(() => {
    if (accountFilter === "All") return accounts
    return accounts.filter((a) => a.type === accountFilter)
  }, [accounts, accountFilter])

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
    if (!selectedAccount) return []
    return calculateDailyPnLData(selectedAccount.id, allTrades, selectedAccount, allPayouts)
  }, [selectedAccount, allTrades, allPayouts])

  const accountStats = useMemo(() => {
    if (!selectedAccount) return null
    return calculateAccountStats(selectedAccount, allTrades, allPayouts)
  }, [selectedAccount, allTrades, allPayouts])

  /** Display-only floor/drawdown for intraday manual Tradovate overrides; payout logic uses raw accountStats */
  const displayAccountStats = useMemo(() => {
    if (!selectedAccount || !accountStats) return null
    return applyIntradayManualDrawdownToStats(selectedAccount, accountStats)
  }, [selectedAccount, accountStats])

  const consistencyInfo = useMemo(() => {
    if (!selectedAccount) return null
    const rules = getAccountRules(selectedAccount)
    if (rules.hasConsistency) {
      return getConsistencyInfo(selectedAccount.id, allTrades, selectedAccount, allPayouts)
    }
    // Apex PA: qualifying-day count lives on consistencyInfo (no eval-style consistency card)
    if (selectedAccount.firm === "Apex" && selectedAccount.type === "PA" && rules.minProfitDays > 0) {
      return getConsistencyInfo(selectedAccount.id, allTrades, selectedAccount, allPayouts)
    }
    return null
  }, [selectedAccount, allTrades, allPayouts])

  const payoutEligibility = useMemo(() => {
    if (!selectedAccount || selectedAccount.type !== "PA") return null
    return getPayoutEligibility(selectedAccount.id, allTrades, selectedAccount, allPayouts)
  }, [selectedAccount, allTrades, allPayouts])

  const selectedEvalEligible = useMemo(() => {
    if (!selectedAccount || selectedAccount.type !== "Eval") return false
    const at = allTrades.filter((t) => t.accountId === selectedAccount.id)
    const ap = allPayouts.filter((p) => p.accountId === selectedAccount.id)
    const stats = getEvalActivationStats(selectedAccount, at, ap)
    return isEvalEligibleForPaActivation(selectedAccount, stats, at, ap)
  }, [selectedAccount, allTrades, allPayouts])

  /** Fourth top metric: qualifying days (PA), profit/consistency (Eval), or trading days (Live). Display-only; counts match rules/payout helpers. */
  const fourthStatMetric = useMemo(() => {
    if (!selectedAccount || !accountStats) return null
    const rules = getAccountRules(selectedAccount)

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
        const count = payoutEligibility.winningDays ?? 0
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
      const pt =
        selectedAccount.profitTarget ??
        (rules.hasProfitTarget ? rules.profitTarget : null)

      if (rules.hasProfitTarget && pt != null && pt > 0) {
        return {
          title: "Profit Target",
          value: formatCurrency(accountStats.totalPnL),
          change: {
            value: `of ${formatCurrency(pt)} goal`,
            isPositive: accountStats.totalPnL >= pt,
          },
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
    accountStats,
    accountDailyData,
    payoutEligibility,
    consistencyInfo,
  ])

  // Total cash withdrawn across all accounts
  const totalCashWithdrawn = useMemo(() => {
    return allPayouts.reduce((sum, p) => sum + p.amount, 0)
  }, [allPayouts])

  /** Portfolio summary for accounts overview (display-only aggregates) */
  const accountsOverview = useMemo(() => {
    if (accounts.length === 0) return null
    let totalBalance = 0
    let totalNetPnL = 0
    let evalPassed = 0
    let payoutEligible = 0
    for (const a of accounts) {
      const s = calculateAccountStats(a, allTrades, allPayouts)
      totalBalance += getPortfolioBalance(s.currentBalance, a)
      totalNetPnL += s.totalPnL
      if (a.type === "Eval" && a.status === "Passed") evalPassed++
      if (a.type === "PA") {
        const el = getPayoutEligibility(a.id, allTrades, a, allPayouts)
        if (el.isEligible) payoutEligible++
      }
    }
    return {
      totalBalance,
      totalNetPnL,
      accountCount: sumAccountQuantities(accounts),
      cardCount: accounts.length,
      evalPassed,
      payoutEligible,
    }
  }, [accounts, allTrades, allPayouts])

  const handleSelectAccount = (account: Account) => {
    setSelectedAccountId(account.id)
    setViewMode("detail")
  }

  const handleBack = () => {
    setViewMode("accounts")
    setSelectedAccountId(null)
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
    tradeData: { date: string; accountId: string; symbol: string; pnl: number; notes?: string },
    meta: TradeMeta = {},
  ) => {
    setIsSaving(true)
    try {
      const result = await createTrade(tradeData, meta)

      if (result.error) throw result.error
      if (result.data) {
        setAllTrades([...allTrades, result.data])
        toast({ title: "Trade added", description: `${result.data.symbol} trade recorded.` })
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create trade", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddPayout = async (payoutData: { date: string; amount: number; notes?: string }) => {
    if (!selectedAccount) return

    setIsSaving(true)
    try {
      const accountPayoutCount = allPayouts.filter((p) => p.accountId === selectedAccount.id).length
      const isLucid = selectedAccount.firm === "Lucid"
      const splitPercent = isLucid ? 0.9 : 1.0

      const result = await createPayout({
        accountId: selectedAccount.id,
        date: payoutData.date,
        amount: payoutData.amount,
        payoutNumber: accountPayoutCount + 1,
        notes: payoutData.notes,
        traderReceived: isLucid ? payoutData.amount * splitPercent : undefined,
        firmSplit: isLucid ? payoutData.amount * (1 - splitPercent) : undefined,
        payoutSplitPercent: isLucid ? splitPercent : undefined,
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen premium-shell flex items-center justify-center">
        <div className="glass-card rounded-3xl px-8 py-7 flex flex-col items-center gap-3">
            <div className="rounded-full border border-[#536878]/25 bg-[#536878]/[0.08] p-3 shadow-[0_0_28px_-16px_rgba(83,104,120,0.45)]">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
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
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-red-500">{error}</p>
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
      {/* Edit Trade Modal */}
      <EditTradeModal
        trade={editingTrade}
        accounts={accounts}
        open={!!editingTrade}
        onOpenChange={(open) => !open && setEditingTrade(null)}
        onSave={handleUpdateTrade}
        isSaving={isSaving}
      />

      {/* Delete Trade Modal */}
      <DeleteConfirmationModal
        open={!!deletingTrade}
        onOpenChange={(open) => !open && setDeletingTrade(null)}
        title="Delete this trade?"
        description="This action cannot be undone."
        itemDetails={deletingTrade && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Symbol:</span>
              <span className="font-mono font-semibold">{deletingTrade.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date:</span>
              <span>{new Date(deletingTrade.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Net PnL:</span>
              <span className={cn(
                "font-mono font-semibold",
                deletingTrade.pnl >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {deletingTrade.pnl >= 0 ? "+" : ""}${deletingTrade.pnl.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        onConfirm={handleDeleteTrade}
        isDeleting={isSaving}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        account={editingAccount}
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        onSave={handleUpdateAccount}
        isSaving={isSaving}
      />

      {/* Delete Account Modal */}
      <DeleteConfirmationModal
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        title="Delete this account?"
        description="This action cannot be undone."
        warningText="Deleting this account will also delete all trades and payouts linked to it."
        itemDetails={deletingAccount && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Account:</span>
              <span className="font-semibold">{deletingAccount.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span>{deletingAccount.type}</span>
            </div>
          </div>
        )}
        onConfirm={handleDeleteAccount}
        isDeleting={isSaving}
        confirmText="Delete Account"
      />

      {selectedAccount?.drawdownType === "Intraday" && accountStats && (
        <ManualIntradayDrawdownModal
          open={manualIntradayModalOpen}
          onOpenChange={setManualIntradayModalOpen}
          currentBalance={accountStats.currentBalance}
          initialMode={manualIntradayModalMode}
          estimatedFloor={accountStats.activeEodFloor ?? accountStats.minBalance}
          estimatedDrawdownRemaining={accountStats.drawdownRemaining}
          hasManualOverride={hasIntradayManualDrawdown(selectedAccount)}
          onSave={handleManualIntradaySave}
          onClearManual={handleManualIntradayClear}
          isSaving={isSaving}
        />
      )}

      <ActivatePaModal
        open={activatePaOpen}
        onOpenChange={(open) => {
          setActivatePaOpen(open)
          if (!open) setActivatePaEval(null)
        }}
        evalAccount={activatePaEval}
        isSubmitting={isSaving}
        onConfirm={async ({ name, activatedAtIso, activationStartDate, tradeifyProgram }) => {
          if (!activatePaEval) return
          const evalAcc = activatePaEval
          setIsSaving(true)
          try {
            const updates = buildEvalToPaConversionUpdates(
              evalAcc,
              name,
              activatedAtIso,
              activationStartDate,
              tradeifyProgram,
            )
            const result = await updateAccount(evalAcc.id, updates)
            if (result.error) throw result.error

            await loadData()
            setActivatePaOpen(false)
            setActivatePaEval(null)
            toast({
              title: "Performance account activated",
              description: `${updates.name} is now a funded account. PA metrics use trades on or after ${activationStartDate}.`,
            })
          } catch (err) {
            toast({
              title: "Activation failed",
              description: err instanceof Error ? err.message : "Could not activate PA",
              variant: "destructive",
            })
          } finally {
            setIsSaving(false)
          }
        }}
      />

      {/* Error toast */}
      {error && accounts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/10 border border-red-400/30 text-red-300 px-4 py-3 rounded-2xl backdrop-blur-xl flex items-center gap-3">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500/70 hover:text-red-500">
            ×
          </button>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-950/80 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-xl flex items-center gap-2 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}

      <div className="max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-3">
        {viewMode === "accounts" ? (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100">Accounts</h1>
              <div className="flex items-center gap-1.5 sm:gap-4 flex-wrap w-full sm:w-auto [&_button]:h-9">
                {/* Total Cash Withdrawn */}
                {totalCashWithdrawn > 0 && (
                  <div className="text-right pr-3 sm:pr-4 border-r border-white/10">
                    <div className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider">Withdrawn</div>
                    <div className="text-base sm:text-lg font-semibold font-mono text-emerald-500">
                      {formatCurrency(totalCashWithdrawn)}
                    </div>
                  </div>
                )}
                {accounts.length > 0 && (
                  <AddTradeModal
                    accounts={accounts}
                    selectedAccountId={accounts[0]?.id ?? ""}
                    onAddTrade={handleAddTrade}
                  />
                )}
                <AddAccountModal onAddAccount={handleAddAccount} />
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out" className="h-9 w-9 shrink-0 border border-white/10 bg-slate-900/55 hover:bg-slate-800/80">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Account Type Tabs */}
            <Tabs
              value={accountFilter}
              onValueChange={(v) => setAccountFilter(v as AccountType | "All")}
              className="mb-3 sm:mb-4"
            >
              <TabsList>
                <TabsTrigger value="All">All</TabsTrigger>
                <TabsTrigger value="Eval">Eval</TabsTrigger>
                <TabsTrigger value="PA">PA</TabsTrigger>
                <TabsTrigger value="Live">Live</TabsTrigger>
              </TabsList>
            </Tabs>

            {accountsOverview && (
              <div className="mb-2.5 grid grid-cols-2 gap-1.5 sm:mb-5 sm:gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-[#111318]/75 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:px-4 sm:py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Total balance</p>
                  <p className="mt-0.5 font-mono text-base font-semibold tracking-tight text-[#E5E4E2] sm:text-lg">
                    {formatCurrency(accountsOverview.totalBalance)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-[#111318]/75 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:px-4 sm:py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Total net PnL</p>
                  <p
                    className={cn(
                      "mt-0.5 font-mono text-base font-semibold tracking-tight sm:text-lg",
                      accountsOverview.totalNetPnL >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {formatPnL(accountsOverview.totalNetPnL)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-[#111318]/75 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:px-4 sm:py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Accounts</p>
                  <p className="mt-0.5 font-mono text-base font-semibold tracking-tight text-[#E5E4E2] sm:text-lg">
                    {accountsOverview.accountCount}
                  </p>
                  {accountsOverview.cardCount !== accountsOverview.accountCount && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {accountsOverview.cardCount} cards · {accountsOverview.accountCount} accounts
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-[#111318]/75 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:px-4 sm:py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Milestones</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-300 sm:text-sm">
                    <span className="block"><span className="font-mono text-emerald-400/95">{accountsOverview.evalPassed}</span> eval passed</span>
                    <span className="block mt-0.5"><span className="font-mono text-[#E5E4E2]">{accountsOverview.payoutEligible}</span> PA ready</span>
                  </p>
                </div>
              </div>
            )}

            {/* Account Cards Grid */}
            {filteredAccounts.length > 0 ? (
              <div className="grid gap-2.5 sm:gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredAccounts.map((account) => {
                  const tradesForAccount = allTrades.filter((t) => t.accountId === account.id)
                  const payoutsForAccount = allPayouts.filter((p) => p.accountId === account.id)
                  const actStats = getEvalActivationStats(account, tradesForAccount, payoutsForAccount)
                  const eligibleForPa =
                    account.type === "Eval" &&
                    isEvalEligibleForPaActivation(account, actStats, tradesForAccount, payoutsForAccount)
                  return (
                  <AccountCard
                    key={account.id}
                    account={account}
                    trades={allTrades}
                    payouts={allPayouts}
                    onClick={() => handleSelectAccount(account)}
                    onActivatePa={
                      eligibleForPa
                        ? () => {
                            setActivatePaEval(account)
                            setActivatePaOpen(true)
                          }
                        : undefined
                    }
                    menuSlot={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg border border-white/[0.10] bg-[rgba(10,12,16,0.80)] backdrop-blur-sm text-slate-500 hover:text-[#E5E4E2] hover:border-[#536878]/30"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setEditingAccount(account)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingAccount(account)}
                            className="text-red-500 focus:text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-14 sm:py-20 glass-card rounded-[28px] border border-[rgba(83,104,120,0.12)]">
                <div className="mb-3 flex justify-center">
                  <div className="h-10 w-10 rounded-2xl bg-[rgba(83,104,120,0.10)] border border-[rgba(83,104,120,0.20)] flex items-center justify-center">
                    <span className="text-lg font-bold text-[#536878]">P</span>
                  </div>
                </div>
                <p className="text-lg font-semibold text-[#E5E4E2]/70 mb-1">No accounts yet</p>
                <p className="text-sm text-[#E5E4E2]/35 mb-6 max-w-xs mx-auto">
                  Add your first Apex or Lucid account to start tracking rules, payouts, and performance.
                </p>
                <AddAccountModal onAddAccount={handleAddAccount} />
              </div>
            )}
          </>
        ) : (
          selectedAccount &&
          accountStats && (
            <>
              {/* Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-2">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Button variant="ghost" size="icon" onClick={handleBack} className="h-9 w-9 sm:h-10 sm:w-10 lg:h-9 lg:w-9 shrink-0 border border-white/10 bg-slate-900/70">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-3xl lg:text-2xl font-semibold tracking-tight truncate">{selectedAccount.name}</h1>
                      <AccountQuantityBadge account={selectedAccount} className="text-xs" />
                    </div>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {selectedAccount.type} Account
                      {formatRepresentativeTrackingHelper(selectedAccount) && (
                        <span className="block text-[11px] text-[#94AAB8]/90 mt-0.5">
                          {formatRepresentativeTrackingHelper(selectedAccount)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end mt-1 sm:mt-0">
                  <div className="hidden sm:block">
                    <LiveClock />
                  </div>
                  {selectedAccount.type === "Eval" && selectedEvalEligible && (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-emerald-600/90 to-[#536878]/90 hover:from-emerald-500 hover:to-[#536878] shadow-sm shadow-emerald-900/20"
                        onClick={() => {
                          setActivatePaEval(selectedAccount)
                          setActivatePaOpen(true)
                        }}
                      >
                        Activate PA
                      </Button>
                    )}
                  <AddTradeModal
                    accounts={accounts}
                    selectedAccountId={selectedAccount.id}
                    onAddTrade={handleAddTrade}
                  />
                  {/* Account Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 border border-white/[0.10] bg-[rgba(10,12,16,0.70)] text-slate-500 hover:text-[#E5E4E2] hover:border-[#536878]/30"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setEditingAccount(selectedAccount)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Account
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeletingAccount(selectedAccount)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out" className="border border-white/10 bg-slate-900/55 hover:bg-slate-800/80">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* TOP ROW: Stats Cards */}
              <div className="grid gap-1.5 sm:gap-3 lg:gap-2 grid-cols-1 lg:grid-cols-5 mb-2 sm:mb-4 lg:mb-2">
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
                      ? `Projected: ${formatCurrency(accountStats.projectedEodFloor ?? 0)}`
                      : undefined
                  }
                  titleAction={
                    selectedAccount.drawdownType === "Intraday" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-[#E5E4E2]/70"
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
                  className="order-5 lg:order-5"
                  title="Drawdown Remaining"
                  value={formatCurrency(Math.max(0, displayAccountStats!.drawdownRemaining))}
                  change={{
                    value: `of ${formatCurrency(selectedAccount.maxDrawdown)}`,
                    isPositive:
                      displayAccountStats!.drawdownRemaining >
                      selectedAccount.maxDrawdown * 0.5,
                  }}
                  subValue={
                    selectedAccount.drawdownType === "Intraday" &&
                    hasIntradayManualDrawdown(selectedAccount)
                      ? "Manually updated from Tradovate."
                      : undefined
                  }
                  titleAction={
                    selectedAccount.drawdownType === "Intraday" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-[#E5E4E2]/70"
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

              {shouldShowAccountRangeCard(selectedAccount) && (
                <div className="mb-2 sm:mb-4 lg:mb-2">
                  <AccountRangeCard account={selectedAccount} stats={displayAccountStats!} />
                </div>
              )}

              {/* ROW 1.5: Risk Metrics */}
              {accountTrades.length > 0 && (
                <div className="mb-2 sm:mb-4 lg:mb-2">
                  <RiskMetricsCard trades={accountTrades} />
                </div>
              )}

              {/* ROW 2: Full Width Chart */}
              <div className="mb-3 sm:mb-8 lg:mb-[4.25rem]">
                <PerformanceChart
                  data={accountDailyData}
                  account={selectedAccount}
                  stats={displayAccountStats!}
                />
              </div>

              {/* ROW 3: Full Width Rule Status */}
              <div className="mb-2 sm:mb-4">
                <RuleEnginePanel
                  account={selectedAccount}
                  dailyData={accountDailyData}
                  stats={displayAccountStats!}
                  consistencyInfo={consistencyInfo}
                  lucidCycleQualifyingDays={
                    selectedAccount.firm === "Lucid" &&
                    selectedAccount.type === "PA" &&
                    payoutEligibility?.firm === "Lucid"
                      ? payoutEligibility.cycleProfitDays
                      : selectedAccount.firm === "Tradeify" &&
                          payoutEligibility?.firm === "Tradeify" &&
                          payoutEligibility.tradeifyProgram === "select_flex"
                        ? payoutEligibility.winningDays ?? 0
                        : undefined
                  }
                />
              </div>

              {/* ROW 4: Full Width Calendar */}
              <div className="mb-2.5 sm:mb-6 lg:mb-10">
                <TradingCalendar account={selectedAccount} dailyData={accountDailyData} trades={accountTrades} />
              </div>

              {/* ROW 5: Trade History + Payout Status (PA only) */}
              <div className={cn(
                "grid gap-2.5 sm:gap-5",
                selectedAccount.type === "PA" && payoutEligibility ? "lg:grid-cols-[minmax(0,2.2fr)_minmax(320px,1fr)]" : ""
              )}>
                <TradeHistoryTable 
                  trades={accountTrades}
                  onEditTrade={setEditingTrade}
                  onDeleteTrade={setDeletingTrade}
                />
                {selectedAccount.type === "PA" &&
                  payoutEligibility &&
                  getAccountRules(selectedAccount).hasPayouts && (
                  <PayoutStatusPanel
                    account={selectedAccount}
                    eligibility={payoutEligibility}
                    payouts={accountPayouts}
                    onAddPayout={handleAddPayout}
                  />
                )}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
