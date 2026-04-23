"use client"

import { useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Trade } from "@/lib/types"

interface TradeHistoryTableProps {
  trades: Trade[]
}

interface GroupedTrade {
  date: string
  symbol: string
  totalPnl: number
  tradeCount: number
  winCount: number
  lossCount: number
  winPercent: number
}

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  // Group trades by date + symbol
  const groupedTrades = useMemo((): GroupedTrade[] => {
    const groups: Record<string, Trade[]> = {}
    
    for (const trade of trades) {
      const key = `${trade.date}|${trade.symbol}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(trade)
    }

    const result: GroupedTrade[] = []
    
    for (const [key, groupTrades] of Object.entries(groups)) {
      const [date, symbol] = key.split("|")
      const totalPnl = groupTrades.reduce((sum, t) => sum + t.pnl, 0)
      const winCount = groupTrades.filter((t) => t.pnl > 0).length
      const lossCount = groupTrades.filter((t) => t.pnl < 0).length
      const totalCountForWin = winCount + lossCount
      const winPercent = totalCountForWin > 0 ? Math.round((winCount / totalCountForWin) * 100) : 0
      
      result.push({
        date,
        symbol,
        totalPnl,
        tradeCount: groupTrades.length,
        winCount,
        lossCount,
        winPercent,
      })
    }

    // Sort by date descending
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [trades])

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
        <h2 className="text-base sm:text-lg font-semibold">Trade History</h2>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider px-3 sm:px-4">Date</TableHead>
              <TableHead className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider px-3 sm:px-4">Symbol</TableHead>
              <TableHead className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider text-right px-3 sm:px-4">PnL</TableHead>
              <TableHead className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider text-right px-3 sm:px-4 hidden sm:table-cell">Qty</TableHead>
              <TableHead className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider text-right px-3 sm:px-4 hidden sm:table-cell">Win %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedTrades.map((group, idx) => (
              <TableRow
                key={`${group.date}-${group.symbol}-${idx}`}
                className="border-border/50 hover:bg-muted/50 transition-colors"
              >
                <TableCell className="font-medium py-2.5 sm:py-3.5 px-3 sm:px-4 text-xs sm:text-sm">{formatDate(group.date)}</TableCell>
                <TableCell className="px-3 sm:px-4">
                  <span className="font-mono font-semibold text-xs sm:text-sm">{group.symbol}</span>
                </TableCell>
                <TableCell className="text-right py-2.5 sm:py-3.5 px-3 sm:px-4">
                  <span className={cn(
                    "font-mono font-semibold text-xs sm:text-sm",
                    group.totalPnl > 0 ? "text-emerald-500" : group.totalPnl < 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {group.totalPnl > 0 ? "+" : ""}${group.totalPnl.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm py-2.5 sm:py-3.5 px-3 sm:px-4 hidden sm:table-cell">{group.tradeCount}</TableCell>
                <TableCell className="text-right py-2.5 sm:py-3.5 px-3 sm:px-4 hidden sm:table-cell">
                  <span className={cn(
                    "font-mono font-medium text-xs sm:text-sm",
                    group.winPercent >= 60 ? "text-emerald-500" : 
                    group.winPercent >= 40 ? "text-amber-500" : 
                    group.winPercent > 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {group.winPercent}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {trades.length === 0 && (
        <div className="p-6 sm:p-10 text-center text-sm sm:text-base text-muted-foreground">
          No trades recorded yet
        </div>
      )}
    </Card>
  )
}
