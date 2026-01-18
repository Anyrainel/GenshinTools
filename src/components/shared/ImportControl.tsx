import { Layers, Loader2, Upload } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PresetOption } from "@/data/types"; // Updated import

interface ImportControlProps<T> {
  options: PresetOption[];
  loadPreset: (path: string) => Promise<T>;
  onApply: (payload: T) => void;
  disabled?: boolean;
  onLocalImport?: (payload: T) => void;
  onUidImport?: (uid: string, clearData: boolean) => Promise<void>; // Updated prop
  initialUid?: string; // New prop for initial UID value
  dialogTitle?: string;
  dialogDescription?: string | ReactNode;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmActionLabel?: string;
  loadErrorText?: string;
  emptyListText?: string;
  hideEmptyList?: boolean;
  importFromFileText?: string;
}

export function ImportControl<T>({
  options,
  loadPreset,
  onApply,
  disabled = false,
  onLocalImport,
  dialogTitle,
  dialogDescription,
  confirmTitle,
  confirmDescription,
  confirmActionLabel,
  loadErrorText,
  emptyListText,
  hideEmptyList,
  importFromFileText,
  onUidImport,
  initialUid, // Destructured here
}: ImportControlProps<T>) {
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetOption | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uidInput, setUidInput] = useState(initialUid || ""); // Initialize with prop
  const [clearData, setClearData] = useState(false);

  // Sync uidInput when initialUid changes (e.g. from store)
  useEffect(() => {
    if (initialUid) {
      setUidInput(initialUid);
    }
  }, [initialUid]);

  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }, [options]);

  const handleSelect = (option: PresetOption) => {
    setSelectedPreset(option);
    setConfirmOpen(true);
    setPickerOpen(false);
    setErrorMessage(null);
  };

  const handleConfirmChange = (open: boolean) => {
    setConfirmOpen(open);
    if (!open) {
      setSelectedPreset(null);
      setErrorMessage(null);
    }
  };

  const handleApply = async () => {
    if (!selectedPreset) return;

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const payload = await loadPreset(selectedPreset.path);
      onApply(payload);
      handleConfirmChange(false);
    } catch (error) {
      console.error("Failed to load preset", error);
      setErrorMessage(loadErrorText || t.ui("configure.presetDialogLoadError"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleLocalImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !onLocalImport) {
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
        setPickerOpen(false);
      } catch (error) {
        console.error("Failed to import data:", error);
        setErrorMessage(
          loadErrorText || t.ui("configure.importDialogLoadError")
        );
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleUidImport = async () => {
    if (!onUidImport || !uidInput) return;

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await onUidImport(uidInput, clearData);
      setPickerOpen(false);
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
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setPickerOpen(true)}
        disabled={disabled || isBusy}
      >
        <Upload className="w-4 h-4" />
        {t.ui("app.import")}
      </Button>

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setErrorMessage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogTitle || t.ui("configure.importDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {dialogDescription || t.ui("configure.importDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {sortedOptions.length > 0 ? (
            <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
              {sortedOptions.map((option) => (
                <Button
                  key={option.path}
                  variant="outline"
                  className="justify-between"
                  onClick={() => handleSelect(option)}
                  disabled={isBusy}
                >
                  <span className="truncate text-left mr-2">
                    {option.label}
                  </span>
                  <Layers className="h-4 w-4 text-primary" />
                </Button>
              ))}
            </div>
          ) : (
            !hideEmptyList && (
              <div className="py-4 text-sm text-muted-foreground">
                {emptyListText || t.ui("configure.presetDialogEmpty")}
              </div>
            )
          )}

          {onLocalImport && (
            <div className="pt-4 border-t space-y-3">
              {/* UID Import Section */}
              {onUidImport && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={t.ui("accountData.uidPlaceholder") || "UID"}
                    value={uidInput}
                    onChange={(e) => setUidInput(e.target.value)}
                    className="flex h-9 flex-1 min-w-[100px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isBusy}
                    onKeyDown={(e) => e.key === "Enter" && handleUidImport()}
                  />
                  <div className="flex items-center space-x-1.5 shrink-0 px-1">
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
                    className="shrink-0"
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t.ui("app.import")
                    )}
                  </Button>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full relative overflow-hidden"
                disabled={isBusy}
              >
                <Upload className="w-4 h-4" />
                {importFromFileText || t.ui("configure.importFromFile")}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleLocalImport}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isBusy}
                />
              </Button>
            </div>
          )}

          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={handleConfirmChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTitle || t.ui("configure.presetConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription || t.ui("configure.presetConfirmDescription")}
              {selectedPreset && (
                <span className="mt-2 block font-semibold text-primary">
                  {selectedPreset.label}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>
              {t.ui("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApply}
              disabled={isBusy}
              className="gap-2"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmActionLabel || t.ui("configure.presetConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
