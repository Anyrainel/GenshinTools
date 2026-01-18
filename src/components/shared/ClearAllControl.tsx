import { Trash2 } from "lucide-react";
import { useState } from "react";

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
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface ClearAllControlProps {
  onConfirm: () => void;
  disabled?: boolean;
  dialogTitle?: string;
  dialogDescription?: string;
  confirmActionLabel?: string;
}

export function ClearAllControl({
  onConfirm,
  disabled = false,
  dialogTitle,
  dialogDescription,
  confirmActionLabel,
}: ClearAllControlProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-destructive hover:bg-destructive/30"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Trash2 className="w-4 h-4" />
        {t.ui("app.clear")}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogTitle || t.ui("configure.clearAllConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogDescription ||
                t.ui("configure.clearAllConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {confirmActionLabel || t.ui("configure.clearAllConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
