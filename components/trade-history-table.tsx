"use client"

import { useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { Trade } from "@/lib/types"

interface TradeHistoryTableProps {
  trades: Trade[]
  onEditTrade?: (trade: Trade) => void
  onDeleteTrade?: (trade: Trade) => void
}

export function TradeHistoryTable({ trades, onEditTrade, onDeleteTrade }: TradeHistoryTableProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  // Sort trades by date descending, then by created order
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return 0
    })
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
              <TableHead className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider px-3 sm:px-4 hidden sm:table-cell">Notes</TableHead>
              {(onEditTrade || onDeleteTrade) && (
                <TableHead className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider px-3 sm:px-4 w-12"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTrades.map((trade) => (
              <TableRow
                key={trade.id}
                className="border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <TableCell className="font-medium py-2.5 sm:py-3.5 px-3 sm:px-4 text-xs sm:text-sm">
                  {formatDate(trade.date)}
                </TableCell>
                <TableCell className="px-3 sm:px-4">
                  <span className="font-mono font-semibold text-xs sm:text-sm">{trade.symbol}</span>
                </TableCell>
                <TableCell className="text-right py-2.5 sm:py-3.5 px-3 sm:px-4">
                  <span className={cn(
                    "font-mono font-semibold text-xs sm:text-sm",
                    trade.pnl > 0 ? "text-emerald-500" : trade.pnl < 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {trade.pnl > 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className="px-3 sm:px-4 hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                    {trade.notes || "—"}
                  </span>
                </TableCell>
                {(onEditTrade || onDeleteTrade) && (
                  <TableCell className="px-3 sm:px-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {onEditTrade && (
                          <DropdownMenuItem onClick={() => onEditTrade(trade)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Trade
                          </DropdownMenuItem>
                        )}
                        {onDeleteTrade && (
                          <DropdownMenuItem 
                            onClick={() => onDeleteTrade(trade)}
                            className="text-red-500 focus:text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Trade
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
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
