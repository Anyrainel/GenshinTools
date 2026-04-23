import { Download, Layers, Loader2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import type { ControlHandle } from "@/components/shared/controlHandle";
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

type ImportVariant = "default" | "tier-list" | "team-comp";

interface ImportControlProps<T> {
  options: PresetOption[];
  loadPreset: (path: string) => Promise<T>;
  onApply: (payload: T, preset?: PresetOption) => void;
  variant?: ImportVariant;
  onLocalImport?: (payload: T) => void;
}

/**
 * ImportControl - A dialog-only control for importing data from presets or local files.
 *
 * Usage with ref pattern:
 * ```tsx
 * const importRef = useRef<ControlHandle>(null);
 *
 * const actions: ActionConfig[] = [
 *   { key: "import", icon: Upload, label: "Import", onTrigger: () => importRef.current?.open() },
 * ];
 *
 * <ImportControl ref={importRef} options={presets} loadPreset={load} onApply={apply} />
 * <AppBar actions={actions} />
 * ```
 */
function ImportControlInner<T>(
  {
    options,
    loadPreset,
    onApply,
    variant = "default",
    onLocalImport,
  }: ImportControlProps<T>,
  ref: React.ForwardedRef<ControlHandle>
) {
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetOption | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Expose open() method via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setErrorMessage(null);
      setPickerOpen(true);
    },
  }));

  // Explicitly map keys to avoid dynamic construction for static analysis
  const getMessages = useCallback(() => {
    if (variant === "tier-list") {
      return {
        dialogTitle: t.ui("import.titleTierList"),
        dialogDescription: t.ui("import.dialogDesc"),
        confirmTitle: t.ui("import.confirmTitle"),
        confirmDescription: t.ui("import.confirmTierList"),
        confirmAction: t.ui("import.confirmAction"),
        loadError: t.ui("import.loadErrorTierList"),
        emptyList: t.ui("import.presetEmpty"),
        importFromFile: t.ui("import.fromFile"),
      };
    }

    if (variant === "team-comp") {
      return {
        dialogTitle: t.ui("import.titleTeamComp"),
        dialogDescription: t.ui("import.dialogDesc"),
        confirmTitle: t.ui("import.confirmTitle"),
        confirmDescription: t.ui("import.confirmTeamComp"),
        confirmAction: t.ui("import.confirmAction"),
        loadError: t.ui("import.loadErrorTeamComp"),
        emptyList: t.ui("import.presetEmpty"),
        importFromFile: t.ui("import.fromFile"),
      };
    }

    // Default variant (configure/builds)
    return {
      dialogTitle: t.ui("import.titleBuilds"),
      dialogDescription: t.ui("import.dialogDesc"),
      confirmTitle: t.ui("import.confirmTitle"),
      confirmDescription: t.ui("import.confirmBuilds"),
      confirmAction: t.ui("import.confirmAction"),
      loadError: t.ui("import.presetLoadError"),
      emptyList: t.ui("import.emptyBuildsHint"),
      importFromFile: t.ui("import.fromFile"),
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
      onApply(payload, selectedPreset);
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
        setErrorMessage(t.ui("import.fileLoadError"));
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <>
      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setErrorMessage(null);
        }}
      >
        <DialogContent className="overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{messages.dialogTitle}</DialogTitle>
            <DialogDescription>{messages.dialogDescription}</DialogDescription>
          </DialogHeader>

          {sortedOptions.length > 0 ? (
            <div className="grid gap-2 max-h-80 overflow-y-auto overflow-x-hidden pr-1">
              {sortedOptions.map((option) => (
                <button
                  type="button"
                  key={option.path}
                  className="flex items-center justify-between h-auto min-h-10 py-2 px-3 rounded-md border-l-[3px] border-l-primary border border-border bg-gradient-card hover:bg-accent text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleSelect(option)}
                  disabled={isBusy}
                >
                  <span className="line-clamp-2 text-left mr-2">
                    {option.label}
                  </span>
                  <Layers className="h-4 w-4 shrink-0 text-primary" />
                </button>
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
                className="gap-2 w-full relative overflow-hidden border border-border"
                disabled={isBusy}
              >
                <Download className="w-4 h-4" />
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
        <AlertDialogContent className="overflow-x-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.confirmDescription}
              {selectedPreset && (
                <span className="mt-2 block font-semibold text-primary line-clamp-2">
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

// Use type assertion to preserve generic type parameter with forwardRef
export const ImportControl = forwardRef(ImportControlInner) as <T>(
  props: ImportControlProps<T> & { ref?: React.ForwardedRef<ControlHandle> }
) => React.ReactElement;
