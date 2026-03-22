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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BuildPayloadV5, PresetOption } from "@/data/types";
import { Copy, Download, FileJson, Layers, Loader2 } from "lucide-react";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";

interface BuildImportControlProps {
  options: PresetOption[];
  loadPreset: (path: string) => Promise<BuildPayloadV5>;
  onSubscribe: (id: string, payload: BuildPayloadV5) => void;
  onCopy: (payload: BuildPayloadV5) => void;
}

function BuildImportControlInner(
  { options, loadPreset, onSubscribe, onCopy }: BuildImportControlProps,
  ref: React.ForwardedRef<ControlHandle>
) {
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<PresetOption | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    content: BuildPayloadV5;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      setErrorMessage(null);
      setPickerOpen(true);
      setSelectedOption(null);
      setSelectedFile(null);
    },
  }));

  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }, [options]);

  const handleSelectPreset = (option: PresetOption) => {
    setSelectedOption(option);
    setSelectedFile(null);
    setConfirmOpen(true);
    setPickerOpen(false);
    setErrorMessage(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsBusy(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        // Simple validation or version check could go here
        setSelectedFile({ name: file.name, content });
        setSelectedOption(null);
        setConfirmOpen(true);
        setPickerOpen(false);
      } catch (err) {
        console.error("Failed to parse file", err);
        setErrorMessage(t.ui("import.fileLoadError"));
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset input
  };

  const handleSubscribe = async () => {
    if (!selectedOption) return;

    setIsBusy(true);
    try {
      // Load first to ensure it's valid and get metadata if needed,
      // but mainly we need the payload to pass to the store?
      // Actually store loads it from registry if we set ID.
      // But let's load it here to be safe and maybe pass it if store needs it (store might handle loading).
      // The onSubscribe prop signature I designed takes (id, payload).
      const payload = await loadPreset(selectedOption.path);
      onSubscribe(selectedOption.path, payload);
      setConfirmOpen(false);
    } catch (e) {
      console.error(e);
      setErrorMessage(t.ui("import.presetLoadError"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopy = async () => {
    setIsBusy(true);
    try {
      let payload: BuildPayloadV5;

      if (selectedOption) {
        payload = await loadPreset(selectedOption.path);
      } else if (selectedFile) {
        payload = selectedFile.content;
      } else {
        return;
      }

      onCopy(payload);
      setConfirmOpen(false);
    } catch (e) {
      console.error(e);
      setErrorMessage(t.ui("import.presetLoadError"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      {/* Preset Picker Dialog */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setErrorMessage(null);
        }}
      >
        <DialogContent className="overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{t.ui("import.titleBuilds")}</DialogTitle>
            <DialogDescription>{t.ui("import.dialogDesc")}</DialogDescription>
          </DialogHeader>

          {sortedOptions.length > 0 ? (
            <div className="grid gap-2 max-h-80 overflow-y-auto overflow-x-hidden pr-1">
              {sortedOptions.map((option) => (
                <Button
                  key={option.path}
                  variant="outline"
                  className="justify-between h-auto min-h-10 py-2"
                  onClick={() => handleSelectPreset(option)}
                  disabled={isBusy}
                >
                  <span className="line-clamp-2 text-left mr-2">
                    {option.label}
                  </span>
                  <Layers className="h-4 w-4 shrink-0 text-primary" />
                </Button>
              ))}
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground">
              {t.ui("import.emptyBuildsHint")}
            </div>
          )}

          <div className="pt-4 border-t relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full relative overflow-hidden"
              disabled={isBusy}
            >
              <Download className="w-4 h-4" />
              {t.ui("import.fromFile")}
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isBusy}
              />
            </Button>
          </div>

          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="overflow-x-hidden max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedOption
                ? t.ui("import.confirmTitle")
                : t.ui("import.fileTitle") || "Import File"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block mb-4 font-semibold text-foreground">
                {selectedOption?.label || selectedFile?.name}
              </span>
              {t.ui("import.actionPrompt") ||
                "Choose how you want to import these builds:"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {errorMessage && (
            <div className="text-sm text-destructive mb-4">{errorMessage}</div>
          )}

          <div className="flex flex-col gap-3">
            {/* Option 1: Subscribe (Only for Presets) */}
            {selectedOption && (
              <Button
                variant="default"
                className="w-full justify-start h-auto py-3 px-4 relative"
                onClick={handleSubscribe}
                disabled={isBusy}
              >
                <Layers className="h-5 w-5 mr-3 shrink-0" />
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-semibold">
                    {t.ui("import.actionSubscribe") ||
                      "Use as Baseline (Subscribe)"}
                  </span>
                  <span className="text-xs opacity-80 text-left font-normal">
                    {t.ui("import.actionSubscribeDesc") ||
                      "You will receive updates. Customizations are stored as deltas."}
                  </span>
                </div>
              </Button>
            )}

            {/* Option 2: Copy to Local */}
            <Button
              variant={selectedOption ? "outline" : "default"}
              className="w-full justify-start h-auto py-3 px-4"
              onClick={handleCopy}
              disabled={isBusy}
            >
              <div className="relative flex items-center w-full">
                {selectedOption ? (
                  <Copy className="h-5 w-5 mr-3 shrink-0" />
                ) : (
                  <FileJson className="h-5 w-5 mr-3 shrink-0" />
                )}
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-semibold">
                    {t.ui("import.actionCopy") || "Copy to Local"}
                  </span>
                  <span className="text-xs text-muted-foreground text-left font-normal">
                    {t.ui("import.actionCopyDesc") ||
                      "One-time import. No connection to the original source."}
                  </span>
                </div>
              </div>
            </Button>

            <div className="flex justify-end mt-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={isBusy}
              >
                {t.ui("common.cancel")}
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const BuildImportControl = forwardRef(BuildImportControlInner);
