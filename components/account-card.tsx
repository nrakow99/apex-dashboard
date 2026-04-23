"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Account, Trade, Payout } from "@/lib/types"
import { calculateAccountStats, getConsistencyInfo } from "@/lib/storage"
import { ChevronRight } from "lucide-react"

interface AccountCardProps {
  account: Account
  trades: Trade[]
  payouts: Payout[]
  onClick?: () => void
}

export function AccountCard({ account, trades, payouts, onClick }: AccountCardProps) {
  const stats = calculateAccountStats(account, trades, payouts)
  const consistencyInfo = account.type === "PA" ? getConsistencyInfo(account.id, trades, account, payouts) : null

  const profitProgress = account.profitTarget
    ? Math.min(100, (stats.totalPnL / account.profitTarget) * 100)
    : 0

  return (
    <Card
      className={cn(
        "p-4 sm:p-6 bg-card/50 backdrop-blur border-border/50 cursor-pointer transition-all hover:bg-card/80 hover:border-border group",
        !stats.isSafe && "border-red-500/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4 sm:mb-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base sm:text-lg truncate">{account.name}</h3>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] sm:text-xs px-1.5 sm:px-2",
                account.type === "Eval" && "border-amber-500/50 text-amber-400",
                account.type === "PA" && "border-emerald-500/50 text-emerald-400",
                account.type === "Live" && "border-blue-500/50 text-blue-400"
              )}
            >
              {account.type}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] sm:text-xs px-1.5 sm:px-2",
                account.status === "Active" && "border-emerald-500/50 text-emerald-400",
                account.status === "Passed" && "border-blue-500/50 text-blue-400",
                account.status === "Breached" && "border-red-500/50 text-red-400"
              )}
            >
              {account.status}
            </Badge>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      </div>

      <div className="space-y-4 sm:space-y-5">
        {/* Balance & PnL */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">Balance</div>
            <div className="text-lg sm:text-2xl font-semibold font-mono tracking-tight">
              ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">Net PnL</div>
            <div
              className={cn(
                "text-lg sm:text-2xl font-semibold font-mono tracking-tight",
                stats.totalPnL >= 0 ? "text-emerald-500" : "text-red-500"
              )}
            >
              {stats.totalPnL >= 0 ? "+" : ""}${Math.abs(stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Drawdown */}
        <div>
          <div className="flex justify-between text-[10px] sm:text-[11px] mb-1.5 sm:mb-2">
            <span className="text-muted-foreground uppercase tracking-wider">Drawdown</span>
            <span
              className={cn(
                "font-mono font-medium",
                stats.drawdownRemaining > account.maxDrawdown * 0.5
                  ? "text-emerald-500"
                  : stats.drawdownRemaining > account.maxDrawdown * 0.2
                    ? "text-amber-500"
                    : "text-red-500"
              )}
            >
              ${Math.max(0, stats.drawdownRemaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <Progress
            value={Math.max(0, (stats.drawdownRemaining / account.maxDrawdown) * 100)}
            className={cn(
              "h-2",
              stats.drawdownRemaining > account.maxDrawdown * 0.5 && "[&>div]:bg-emerald-500",
              stats.drawdownRemaining <= account.maxDrawdown * 0.5 &&
                stats.drawdownRemaining > account.maxDrawdown * 0.2 &&
                "[&>div]:bg-amber-500",
              stats.drawdownRemaining <= account.maxDrawdown * 0.2 && "[&>div]:bg-red-500"
            )}
          />
        </div>

        {/* Eval: Profit Target Progress */}
        {account.type === "Eval" && account.profitTarget && (
          <div>
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-muted-foreground uppercase tracking-wider">Profit Goal</span>
              <span className="font-mono">
                ${Math.max(0, stats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${account.profitTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <Progress value={profitProgress} className="h-2" />
          </div>
        )}

        {/* PA: Rule Summary */}
        {account.type === "PA" && consistencyInfo && (
          <div className="flex items-center gap-4 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  stats.tradingDays >= 5 ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
              <span className="text-sm text-muted-foreground">{stats.tradingDays}/5 Days</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  consistencyInfo.isValid ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              <span className="text-sm text-muted-foreground">
                {consistencyInfo.isValid ? "Consistent" : "50% Violated"}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
