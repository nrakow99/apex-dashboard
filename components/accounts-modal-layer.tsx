"use client"

import type { ComponentProps, Dispatch, SetStateAction } from "react"
import { EditTradeModal } from "@/components/edit-trade-modal"
import { EditAccountModal } from "@/components/edit-account-modal"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { ActivatePaModal } from "@/components/activate-pa-modal"
import { ManualIntradayDrawdownModal } from "@/components/manual-intraday-drawdown-modal"
import type { Account, InstrumentSpec, Trade } from "@/lib/types"
import { hasIntradayManualDrawdown } from "@/lib/intraday-manual-drawdown"
import { cn, formatPnL, pnlColorClass } from "@/lib/utils"

type EditTradeSave = ComponentProps<typeof EditTradeModal>["onSave"]
type EditAccountSave = ComponentProps<typeof EditAccountModal>["onSave"]
type ManualSave = ComponentProps<typeof ManualIntradayDrawdownModal>["onSave"]
type ActivateConfirm = ComponentProps<typeof ActivatePaModal>["onConfirm"]

interface AccountsModalLayerProps {
  accounts: Account[]
  instrumentSpecs: InstrumentSpec[]
  isSaving: boolean
  editingTrade: Trade | null
  setEditingTrade: Dispatch<SetStateAction<Trade | null>>
  onUpdateTrade: EditTradeSave
  deletingTrade: Trade | null
  setDeletingTrade: Dispatch<SetStateAction<Trade | null>>
  onDeleteTrade: () => Promise<void>
  editingAccount: Account | null
  setEditingAccount: Dispatch<SetStateAction<Account | null>>
  onUpdateAccount: EditAccountSave
  deletingAccount: Account | null
  setDeletingAccount: Dispatch<SetStateAction<Account | null>>
  onDeleteAccount: () => Promise<void>
  selectedAccount: Account | null
  currentBalance?: number
  estimatedFloor?: number
  estimatedDrawdownRemaining?: number
  manualIntradayOpen: boolean
  setManualIntradayOpen: Dispatch<SetStateAction<boolean>>
  manualIntradayMode: ComponentProps<typeof ManualIntradayDrawdownModal>["initialMode"]
  onManualSave: ManualSave
  onManualClear: () => Promise<void>
  activatePaOpen: boolean
  setActivatePaOpen: Dispatch<SetStateAction<boolean>>
  activatePaEval: Account | null
  setActivatePaEval: Dispatch<SetStateAction<Account | null>>
  onActivatePa: ActivateConfirm
}

export function AccountsModalLayer({
  accounts,
  instrumentSpecs,
  isSaving,
  editingTrade,
  setEditingTrade,
  onUpdateTrade,
  deletingTrade,
  setDeletingTrade,
  onDeleteTrade,
  editingAccount,
  setEditingAccount,
  onUpdateAccount,
  deletingAccount,
  setDeletingAccount,
  onDeleteAccount,
  selectedAccount,
  currentBalance,
  estimatedFloor,
  estimatedDrawdownRemaining,
  manualIntradayOpen,
  setManualIntradayOpen,
  manualIntradayMode,
  onManualSave,
  onManualClear,
  activatePaOpen,
  setActivatePaOpen,
  activatePaEval,
  setActivatePaEval,
  onActivatePa,
}: AccountsModalLayerProps) {
  return (
    <>
      <EditTradeModal trade={editingTrade} accounts={accounts} open={!!editingTrade} onOpenChange={(open) => !open && setEditingTrade(null)} onSave={onUpdateTrade} isSaving={isSaving} />
      <DeleteConfirmationModal
        open={!!deletingTrade}
        onOpenChange={(open) => !open && setDeletingTrade(null)}
        title="Delete this trade?"
        description="This action cannot be undone."
        itemDetails={deletingTrade && <div className="space-y-1"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Symbol:</span><span className="font-mono font-semibold">{deletingTrade.symbol}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Date:</span><span>{new Date(deletingTrade.date).toLocaleDateString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Net P&amp;L:</span><span className={cn("font-mono font-semibold", pnlColorClass(deletingTrade.pnl))}>{formatPnL(deletingTrade.pnl)}</span></div></div>}
        onConfirm={onDeleteTrade}
        isDeleting={isSaving}
      />
      <EditAccountModal account={editingAccount} open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)} onSave={onUpdateAccount} isSaving={isSaving} instrumentSpecs={instrumentSpecs} />
      <DeleteConfirmationModal
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        title="Delete this account?"
        description="This action cannot be undone."
        warningText="Deleting this account will also delete all trades and payouts linked to it."
        itemDetails={deletingAccount && <div className="space-y-1"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Account:</span><span className="font-semibold">{deletingAccount.name}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Type:</span><span>{deletingAccount.type}</span></div></div>}
        onConfirm={onDeleteAccount}
        isDeleting={isSaving}
        confirmText="Delete Account"
      />
      {selectedAccount?.drawdownType === "Intraday" && currentBalance != null && estimatedFloor != null && estimatedDrawdownRemaining != null && <ManualIntradayDrawdownModal open={manualIntradayOpen} onOpenChange={setManualIntradayOpen} currentBalance={currentBalance} initialMode={manualIntradayMode} estimatedFloor={estimatedFloor} estimatedDrawdownRemaining={estimatedDrawdownRemaining} hasManualOverride={hasIntradayManualDrawdown(selectedAccount)} onSave={onManualSave} onClearManual={onManualClear} isSaving={isSaving} />}
      <ActivatePaModal open={activatePaOpen} onOpenChange={(open) => { setActivatePaOpen(open); if (!open) setActivatePaEval(null) }} evalAccount={activatePaEval} isSubmitting={isSaving} onConfirm={onActivatePa} />
    </>
  )
}
