import { AlertCircle, Loader2, Sparkles, Upload } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

import type { ControlHandle } from "@/components/layout/AppBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GOODData } from "@/lib/account-data/goodConversion";

interface AccountImportControlProps {
  onLocalImport: (data: GOODData) => void;
  onUidImport: (uid: string, clearData: boolean) => Promise<void>;
  initialUid?: string;
}

/**
 * AccountImportControl - A dialog-only control for importing account data.
 *
 * Supports both GOOD JSON file import and Enka UID import.
 * Uses ResponsiveDialog for mobile Drawer support.
 *
 * Usage with ref pattern:
 * ```tsx
 * const importRef = useRef<ControlHandle>(null);
 *
 * const actions: ActionConfig[] = [
 *   { key: "import", icon: Upload, label: "Import", onTrigger: () => importRef.current?.open() },
 * ];
 *
 * <AccountImportControl ref={importRef} onLocalImport={...} onUidImport={...} />
 * <AppBar actions={actions} />
 * ```
 */
export const AccountImportControl = forwardRef<
  ControlHandle,
  AccountImportControlProps
>(function AccountImportControl(
  { onLocalImport, onUidImport, initialUid },
  ref
) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uidInput, setUidInput] = useState(initialUid || "");
  const [clearData, setClearData] = useState(false);

  // Sync uidInput when initialUid changes (e.g. from store)
  useEffect(() => {
    if (initialUid) {
      setUidInput(initialUid);
    }
  }, [initialUid]);

  // Expose open() method via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setErrorMessage(null);
      setIsOpen(true);
    },
  }));

  const handleLocalImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        onLocalImport(imported);
        setIsOpen(false);
      } catch (error) {
        console.error("Failed to import data:", error);
        setErrorMessage(t.ui("configure.importDialogLoadError"));
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleUidImport = async () => {
    if (!uidInput) return;

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await onUidImport(uidInput, clearData);
      setIsOpen(false);
    } catch (error: unknown) {
      console.error("UID Import failed", error);
      let message = t.ui("configure.importDialogLoadError");
      if (error instanceof Error) {
        message = error.message;
      }
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setErrorMessage(null);
      }}
    >
      <ResponsiveDialogContent className="md:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("accountData.importDialogTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {t.ui("accountData.importHelpGood")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col gap-5 pt-2">
          {/* GOOD Import Section: Title + Explanation + Action */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="font-semibold block text-foreground text-sm">
                {t.ui("accountData.importHelpGood")}
              </span>
              <p className="text-sm text-muted-foreground">
                {t.ui("accountData.importHelpGoodDesc")}{" "}
                <a
                  href="https://konkers.github.io/irminsul/02-quickstart.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Irminsul
                </a>
                {" / "}
                <a
                  href="https://github.com/taiwenlee/Inventory_Kamera"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Inventory Kamera
                </a>
                .
              </p>
              {/* Benefit callout */}
              <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <Sparkles className="w-4 h-4 text-yellow-500 shrink-0" />
                <span className="text-xs text-yellow-500">
                  {t.ui("accountData.importHelpGoodBenefit")}
                </span>
              </div>
            </div>
            {/* GOOD Import Action */}
            <Button
              size="sm"
              className="gap-2 w-full relative overflow-hidden"
              disabled={isBusy}
            >
              <Upload className="w-4 h-4" />
              {t.ui("accountData.importGOOD")}
              <input
                type="file"
                accept=".json"
                onChange={handleLocalImport}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isBusy}
              />
            </Button>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* UID Import Section: Title + Explanation + Action */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="font-semibold block text-foreground text-sm">
                {t.ui("accountData.importHelpUid")}
              </span>
              <p className="text-sm text-muted-foreground">
                {t.ui("accountData.importHelpUidDesc")}
              </p>
              {/* Limitation callout */}
              <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                <span className="text-xs text-yellow-500">
                  {t.ui("accountData.importHelpUidLimitation")}
                </span>
              </div>
            </div>
            {/* UID Import Action */}
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <input
                type="text"
                placeholder={t.ui("accountData.uidPlaceholder") || "UID"}
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value)}
                className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy}
                onKeyDown={(e) => e.key === "Enter" && handleUidImport()}
              />
              <div className="flex items-center space-x-1.5 shrink-0">
                <Checkbox
                  id="clearData"
                  checked={clearData}
                  onCheckedChange={(c) => setClearData(c as boolean)}
                  disabled={isBusy}
                />
                <Label
                  htmlFor="clearData"
                  className="text-[10px] sm:text-xs font-normal text-muted-foreground cursor-pointer whitespace-nowrap"
                >
                  {t.ui("configure.clearBeforeImport")}
                </Label>
              </div>
              <Button
                size="sm"
                onClick={handleUidImport}
                disabled={!uidInput || isBusy}
                className="flex-grow"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t.ui("app.import")
                )}
              </Button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="text-sm text-destructive px-1 py-2 bg-destructive/10 rounded-md max-h-24 overflow-y-auto break-words mt-4">
            {errorMessage}
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
});
