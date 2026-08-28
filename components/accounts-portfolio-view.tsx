"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { AccountCard } from "@/components/account-card"
import { AccountsOverviewRow } from "@/components/accounts-overview-row"
import { AddAccountModal } from "@/components/add-account-modal"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getEvalActivationStats, isEvalEligibleForPaActivation } from "@/lib/pa-activation"
import type { AccountsOverview } from "@/lib/accounts-overview"
import type { AccountRules } from "@/lib/rules"
import type { Account, AccountType, InstrumentSpec, Payout, RiskProfile, Trade } from "@/lib/types"

export function AccountsPortfolioView({
  accountFilter,
  onFilterChange,
  accounts,
  resolvedRules,
  overview,
  configurationIssueCount,
  trades,
  payouts,
  instrumentSpecs,
  userRiskProfile,
  onSelect,
  onEdit,
  onDelete,
  onActivate,
  onAddAccount,
}: {
  accountFilter: AccountType | "All"
  onFilterChange: (value: AccountType | "All") => void
  accounts: Account[]
  resolvedRules: Map<string, AccountRules | null>
  overview: AccountsOverview | null
  configurationIssueCount: number
  trades: Trade[]
  payouts: Payout[]
  instrumentSpecs: InstrumentSpec[]
  userRiskProfile: RiskProfile | null
  onSelect: (account: Account) => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
  onActivate: (account: Account) => void
  onAddAccount: (account: Omit<Account, "id">) => void | Promise<void>
}) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Tabs value={accountFilter} onValueChange={(value) => onFilterChange(value as AccountType | "All")}>
          <TabsList><TabsTrigger value="All">All</TabsTrigger><TabsTrigger value="Eval">Eval</TabsTrigger><TabsTrigger value="PA">Funded</TabsTrigger><TabsTrigger value="Live">Live</TabsTrigger></TabsList>
        </Tabs>
        <p className="text-xs text-[var(--muted)]">{accounts.length} account{accounts.length === 1 ? "" : "s"}</p>
      </div>

      {overview && <AccountsOverviewRow overview={overview} />}

      {configurationIssueCount > 0 && <div className="mb-4 rounded-[2px] border border-[var(--hairline)] border-l-2 border-l-[var(--text)] bg-[var(--raised)] px-4 py-3"><p className="text-sm font-medium text-[var(--text)]">{configurationIssueCount} account{configurationIssueCount === 1 ? " is" : "s are"} excluded from risk totals</p><p className="mt-1 text-xs text-[var(--muted)]">Update the account settings before relying on its floor, rule, or payout values.</p></div>}

      {accounts.length > 0 ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{accounts.map((account) => {
        if (!resolvedRules.get(account.id)) {
          return <div key={account.id} className="flex min-h-[240px] flex-col justify-between rounded-[2px] border border-[var(--hairline)] border-l-2 border-l-[var(--text)] bg-[var(--surface)] p-5 sm:p-6"><div><p className="text-base font-semibold text-[var(--text)]">{account.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{account.firm} · {account.type}</p><h3 className="mt-8 text-lg font-medium text-[var(--text)]">Rule configuration required</h3><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Risk, floor, and payout figures are unavailable until this account’s settings match a supported firm program and size.</p></div><Button type="button" variant="outline" className="mt-6" onClick={() => onEdit(account)}>Edit account settings</Button></div>
        }
        const accountTrades = trades.filter((trade) => trade.accountId === account.id)
        const accountPayouts = payouts.filter((payout) => payout.accountId === account.id)
        const activationStats = getEvalActivationStats(account, accountTrades, accountPayouts)
        const eligibleForPa = account.type === "Eval" && isEvalEligibleForPaActivation(account, activationStats, accountTrades, accountPayouts)
        return <AccountCard key={account.id} account={account} trades={trades} payouts={payouts} instrumentSpecs={instrumentSpecs} userDefaultRiskProfile={userRiskProfile} onClick={() => onSelect(account)} onActivatePa={eligibleForPa ? () => onActivate(account) : undefined} menuSlot={<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 border border-[var(--hairline)] bg-[var(--raised)] text-[var(--muted)] hover:border-[var(--faint)] hover:text-white"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><DropdownMenuItem onClick={() => onEdit(account)}><Pencil className="mr-2 h-4 w-4" />Edit Account</DropdownMenuItem><DropdownMenuItem onClick={() => onDelete(account)} className="font-semibold"><Trash2 className="mr-2 h-4 w-4" />Delete Account</DropdownMenuItem></DropdownMenuContent></DropdownMenu>} />
      })}</div> : <div className="rounded-[2px] border border-[var(--hairline)] bg-[var(--surface)] py-14 text-center sm:py-20"><div className="mb-3 flex justify-center"><div className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)]"><span className="text-lg font-bold text-white">P</span></div></div><p className="mb-1 text-lg font-semibold text-[var(--text)]">No accounts yet</p><p className="mx-auto mb-6 max-w-xs text-sm text-[var(--muted)]">Add your first prop account to start tracking rules, payouts, and performance.</p><AddAccountModal onAddAccount={onAddAccount} /></div>}
    </>
  )
}
