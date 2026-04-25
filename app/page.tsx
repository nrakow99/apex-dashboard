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
import { LiveClock } from "@/components/live-clock"
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
import { useToast } from "@/hooks/use-toast"
import {
  calculateDailyPnLData,
  calculateAccountStats,
  getConsistencyInfo,
  getPayoutEligibility,
} from "@/lib/storage"
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
import { createClient } from "@/lib/supabase/client"
import type { Trade, Payout, Account, AccountType, DailyPnL } from "@/lib/types"

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

      setAccounts(accountsResult.data ?? [])
      setAllTrades(tradesResult.data ?? [])
      setAllPayouts(payoutsResult.data ?? [])
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
    return allTrades.filter((t) => t.accountId === selectedAccount.id)
  }, [allTrades, selectedAccount])

  const accountPayouts = useMemo(() => {
    if (!selectedAccount) return []
    return allPayouts.filter((p) => p.accountId === selectedAccount.id)
  }, [allPayouts, selectedAccount])

  const accountDailyData = useMemo((): DailyPnL[] => {
    if (!selectedAccount) return []
    return calculateDailyPnLData(selectedAccount.id, allTrades, selectedAccount, allPayouts)
  }, [selectedAccount, allTrades, allPayouts])

  const accountStats = useMemo(() => {
    if (!selectedAccount) return null
    return calculateAccountStats(selectedAccount, allTrades, allPayouts)
  }, [selectedAccount, allTrades, allPayouts])

  const consistencyInfo = useMemo(() => {
    if (!selectedAccount || selectedAccount.type !== "PA") return null
    return getConsistencyInfo(selectedAccount.id, allTrades, selectedAccount, allPayouts)
  }, [selectedAccount, allTrades, allPayouts])

  const payoutEligibility = useMemo(() => {
    if (!selectedAccount || selectedAccount.type !== "PA") return null
    return getPayoutEligibility(selectedAccount.id, allTrades, selectedAccount, allPayouts)
  }, [selectedAccount, allTrades, allPayouts])

  // Total cash withdrawn across all accounts
  const totalCashWithdrawn = useMemo(() => {
    return allPayouts.reduce((sum, p) => sum + p.amount, 0)
  }, [allPayouts])

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
        type: accountData.type,
        startingBalance: accountData.startingBalance,
        profitTarget: accountData.profitTarget,
        maxDrawdown: accountData.maxDrawdown,
        dailyLossLimit: accountData.dailyLossLimit,
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

  const handleAddTrade = async (tradeData: {
    date: string
    accountId: string
    symbol: string
    pnl: number
    notes?: string
  }) => {
    setIsSaving(true)
    try {
      const result = await createTrade(tradeData)

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

      const result = await createPayout({
        accountId: selectedAccount.id,
        date: payoutData.date,
        amount: payoutData.amount,
        payoutNumber: accountPayoutCount + 1,
        notes: payoutData.notes,
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
  const handleUpdateTrade = async (tradeId: string, updates: {
    date: string
    accountId: string
    symbol: string
    pnl: number
    notes?: string
  }) => {
    setIsSaving(true)
    try {
      const result = await updateTrade(tradeId, {
        date: updates.date,
        accountId: updates.accountId,
        symbol: updates.symbol,
        pnl: updates.pnl,
        notes: updates.notes ?? null,
      })

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
    type: AccountType
    status: "Active" | "Inactive" | "Breached" | "Passed"
    startingBalance: number
    maxDrawdown: number
    dailyLossLimit: number
    profitTarget?: number
  }) => {
    setIsSaving(true)
    try {
      const result = await updateAccount(accountId, {
        name: updates.name,
        type: updates.type,
        status: updates.status,
        startingBalance: updates.startingBalance,
        maxDrawdown: updates.maxDrawdown,
        dailyLossLimit: updates.dailyLossLimit,
        profitTarget: updates.profitTarget ?? null,
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading your accounts...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && accounts.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className="min-h-screen bg-background">
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

      {/* Error toast */}
      {error && accounts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500/70 hover:text-red-500">
            ×
          </button>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {viewMode === "accounts" ? (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Accounts</h1>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                {/* Total Cash Withdrawn */}
                {totalCashWithdrawn > 0 && (
                  <div className="text-right pr-3 sm:pr-4 border-r border-border/50">
                    <div className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider">Withdrawn</div>
                    <div className="text-base sm:text-lg font-semibold font-mono text-emerald-500">
                      {formatCurrency(totalCashWithdrawn)}
                    </div>
                  </div>
                )}
                <AddAccountModal onAddAccount={handleAddAccount} />
                {accounts.length > 0 && (
                  <AddTradeModal
                    accounts={accounts}
                    selectedAccountId={accounts[0]?.id ?? ""}
                    onAddTrade={handleAddTrade}
                  />
                )}
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Account Type Tabs */}
            <Tabs
              value={accountFilter}
              onValueChange={(v) => setAccountFilter(v as AccountType | "All")}
              className="mb-6"
            >
              <TabsList className="bg-muted/50">
                <TabsTrigger value="All">All</TabsTrigger>
                <TabsTrigger value="Eval">Eval</TabsTrigger>
                <TabsTrigger value="PA">PA</TabsTrigger>
                <TabsTrigger value="Live">Live</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Account Cards Grid */}
            {filteredAccounts.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAccounts.map((account) => (
                  <div key={account.id} className="relative group">
                    <AccountCard
                      account={account}
                      trades={allTrades}
                      payouts={allPayouts}
                      onClick={() => handleSelectAccount(account)}
                    />
                    {/* Account Actions Menu */}
                    <div className="absolute top-4 right-12 sm:top-6 sm:right-14 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingAccount(account) }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setDeletingAccount(account) }}
                            className="text-red-500 focus:text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-xl text-muted-foreground mb-4">No accounts yet</p>
                <p className="text-muted-foreground mb-6">
                  Create your first account to start tracking your trades
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Button variant="ghost" size="icon" onClick={handleBack} className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">{selectedAccount.name}</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {selectedAccount.type} Account
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 ml-12 sm:ml-0">
                  <LiveClock />
                  <AddTradeModal
                    accounts={accounts}
                    selectedAccountId={selectedAccount.id}
                    onAddTrade={handleAddTrade}
                  />
                  {/* Account Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
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
                  <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* TOP ROW: Stats Cards */}
              <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-5 mb-6 sm:mb-8">
                <MetricsCard
                  title="Account Balance"
                  value={formatCurrency(accountStats.currentBalance)}
                  change={{
                    value: `${formatCurrency(Math.abs(accountStats.totalPnL))} total`,
                    isPositive: accountStats.totalPnL >= 0,
                  }}
                />
                <MetricsCard
                  title="Active EOD Floor"
                  value={formatCurrency(accountStats.activeEodFloor ?? accountStats.minBalance)}
                  status={{
                    label: accountStats.isTradingDayComplete ? "Updated" : "Updates at 2PM",
                    isGood: accountStats.isSafe,
                  }}
                  subValue={
                    !accountStats.isTradingDayComplete && accountStats.projectedEodFloor !== accountStats.activeEodFloor
                      ? `Projected: ${formatCurrency(accountStats.projectedEodFloor ?? 0)}`
                      : undefined
                  }
                />
                <MetricsCard
                  title="Total PnL"
                  value={formatPnL(accountStats.totalPnL)}
                  change={{
                    value: `${accountTrades.length} trades`,
                    isPositive: accountStats.totalPnL >= 0,
                  }}
                />
                <MetricsCard
                  title="Trading Days"
                  value={accountStats.tradingDays.toString()}
                  change={{
                    value: selectedAccount.type === "PA" ? "5 required" : "Active days",
                    isPositive: accountStats.tradingDays >= 5,
                  }}
                />
                <MetricsCard
                  title="Drawdown Remaining"
                  value={formatCurrency(Math.max(0, accountStats.drawdownRemaining))}
                  change={{
                    value: `of ${formatCurrency(selectedAccount.maxDrawdown)}`,
                    isPositive: accountStats.drawdownRemaining > selectedAccount.maxDrawdown * 0.5,
                  }}
                />
              </div>

              {/* ROW 2: Full Width Chart */}
              <div className="mb-6 sm:mb-8">
                <PerformanceChart
                  data={accountDailyData}
                  account={selectedAccount}
                  stats={accountStats}
                />
              </div>

              {/* ROW 3: Full Width Rule Status */}
              <div className="mb-6 sm:mb-8">
                <RuleEnginePanel
                  account={selectedAccount}
                  dailyData={accountDailyData}
                  stats={accountStats}
                  consistencyInfo={consistencyInfo}
                />
              </div>

              {/* ROW 4: Full Width Calendar */}
              <div className="mb-6 sm:mb-8">
                <TradingCalendar dailyData={accountDailyData} trades={accountTrades} />
              </div>

              {/* ROW 5: Trade History + Payout Status (PA only) */}
              <div className={cn(
                "grid gap-6",
                selectedAccount.type === "PA" && payoutEligibility ? "lg:grid-cols-[2fr_1fr]" : ""
              )}>
                <TradeHistoryTable 
                  trades={accountTrades}
                  onEditTrade={setEditingTrade}
                  onDeleteTrade={setDeletingTrade}
                />
                {selectedAccount.type === "PA" && payoutEligibility && (
                  <PayoutStatusPanel
                    accountId={selectedAccount.id}
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
