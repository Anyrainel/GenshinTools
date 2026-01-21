import { Trash2 } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";

import type { ControlHandle } from "@/components/layout/AppBar";
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
import { useLanguage } from "@/contexts/LanguageContext";

type ClearAllVariant = "default" | "tier-list";

interface ClearAllControlProps {
  onConfirm: () => void;
  variant?: ClearAllVariant;
}

/**
 * ClearAllControl - A dialog-only control for confirming destructive clear actions.
 *
 * Usage with ref pattern:
 * ```tsx
 * const clearRef = useRef<ControlHandle>(null);
 *
 * const actions: ActionConfig[] = [
 *   { key: "clear", icon: Trash2, label: "Clear", onTrigger: () => clearRef.current?.open() },
 * ];
 *
 * <ClearAllControl ref={clearRef} onConfirm={handleClear} />
 * <AppBar actions={actions} />
 * ```
 */
export const ClearAllControl = forwardRef<ControlHandle, ClearAllControlProps>(
  function ClearAllControl({ onConfirm, variant = "default" }, ref) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    // Expose open() method via ref
    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
    }));

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
      setIsOpen(false);
    };

    return (
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
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
    );
  }
);
