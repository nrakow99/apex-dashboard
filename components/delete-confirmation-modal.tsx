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
import { Loader2 } from "lucide-react"

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
          <div className="my-4 p-4 bg-slate-900/55 rounded-xl border border-white/10">
            {itemDetails}
          </div>
        )}

        {warningText && (
          <p className="text-sm text-amber-500 bg-amber-500/10 px-3 py-2 rounded-md border border-amber-500/20">
            {warningText}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
