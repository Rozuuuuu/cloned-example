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
        <AlertDialogCancel className="rounded-full">{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="rounded-full bg-terracotta text-white hover:bg-terracotta/90"
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;