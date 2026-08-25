"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

interface DeleteConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  warningText?: string
  itemDetails?: React.ReactNode
  onConfirm: () => Promise<void>
  isDeleting?: boolean
  confirmText?: string
}

export function DeleteConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  warningText,
  itemDetails,
  onConfirm,
  isDeleting = false,
  confirmText = "Delete",
}: DeleteConfirmationModalProps) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {itemDetails && (
          <div className="my-4 rounded-[2px] border border-[var(--hairline)] bg-[var(--raised)] p-4">
            {itemDetails}
          </div>
        )}

        {warningText && (
          <p className="flex items-start gap-2 text-sm font-medium text-[var(--text)] bg-[var(--raised)] px-3 py-2 rounded-[2px] border border-[var(--hairline)]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            {warningText}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {confirmText}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
