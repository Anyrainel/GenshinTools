import { cn } from "@/lib/utils";
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

type ClearAllVariant = "default" | "tier-list";

interface ClearAllControlProps {
  onConfirm: () => void;
  variant?: ClearAllVariant;
  disabled?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderTrigger?: boolean;
}

export function ClearAllControl({
  onConfirm,
  variant = "default",
  disabled = false,
  className,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  renderTrigger = true,
}: ClearAllControlProps) {
  const { t } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledOpen ?? internalOpen;
  const onOpenChange = setControlledOpen ?? setInternalOpen;

  // Variant-based i18n keys
  const messages =
    variant === "tier-list"
      ? {
          title: t.ui("resetConfirmDialog.title"),
          description: t.ui("resetConfirmDialog.message"),
          action: t.ui("resetConfirmDialog.confirm"),
        }
      : {
          title: t.ui("configure.clearAllConfirmTitle"),
          description: t.ui("configure.clearAllConfirmDescription"),
          action: t.ui("configure.clearAllConfirmAction"),
        };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <>
      {renderTrigger && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 text-destructive hover:bg-destructive/30",
            className
          )}
          onClick={() => onOpenChange(true)}
          disabled={disabled}
        >
          <Trash2 className="w-4 h-4" />
          {t.ui("app.clear")}
        </Button>
      )}

      <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {messages.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
