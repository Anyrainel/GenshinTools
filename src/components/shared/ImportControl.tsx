import { Layers, Loader2, Upload } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PresetOption } from "@/data/types";

type ImportVariant = "default" | "tier-list";

interface ImportControlProps<T> {
  options: PresetOption[];
  loadPreset: (path: string) => Promise<T>;
  onApply: (payload: T) => void;
  variant?: ImportVariant;
  disabled?: boolean;
  onLocalImport?: (payload: T) => void;
}

export function ImportControl<T>({
  options,
  loadPreset,
  onApply,
  variant = "default",
  disabled = false,
  onLocalImport,
}: ImportControlProps<T>) {
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetOption | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Variant-based i18n keys
  const getMessages = useCallback(() => {
    const prefix = variant === "tier-list" ? "tierList" : "configure";
    return {
      dialogTitle: t.ui(`${prefix}.importDialogTitle`),
      dialogDescription: t.ui(`${prefix}.importDialogDescription`),
      confirmTitle: t.ui(`${prefix}.presetConfirmTitle`),
      confirmDescription: t.ui(`${prefix}.presetConfirmDescription`),
      confirmAction: t.ui(`${prefix}.presetConfirmAction`),
      loadError: t.ui(`${prefix}.presetDialogLoadError`),
      emptyList: t.ui("configure.presetDialogEmpty"),
      importFromFile: t.ui(`${prefix}.importFromFile`),
    };
  }, [variant, t]);

  const messages = getMessages();

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
      setErrorMessage(messages.loadError);
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
        setErrorMessage(t.ui("configure.importDialogLoadError"));
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
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
            <DialogTitle>{messages.dialogTitle}</DialogTitle>
            <DialogDescription>{messages.dialogDescription}</DialogDescription>
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
            <div className="py-4 text-sm text-muted-foreground">
              {messages.emptyList}
            </div>
          )}

          {onLocalImport && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full relative overflow-hidden"
                disabled={isBusy}
              >
                <Upload className="w-4 h-4" />
                {messages.importFromFile}
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
            <AlertDialogTitle>{messages.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.confirmDescription}
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
              {messages.confirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
