import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Themed confirm modal — replaces window.confirm across the app. */
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  disabled = false,
  onConfirm,
  onOpenChange,
}: Props) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="rounded-3xl border-none bg-cream text-deep-sage">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-deep-sage">{title}</AlertDialogTitle>
        {description && (
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-full" disabled={disabled}>
          {cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          disabled={disabled}
          onClick={(e) => {
            // Prevent Radix from auto-closing so the parent controls modal state
            // (keeps it open on failure, closes only on success).
            e.preventDefault();
            if (disabled) return;
            onConfirm();
          }}
          className="rounded-full bg-terracotta text-white hover:bg-terracotta/90 disabled:opacity-60"
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;