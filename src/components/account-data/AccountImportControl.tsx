import { Loader2, Upload } from "lucide-react";
import { useEffect, useState } from "react";

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
import type { GOODData } from "@/lib/goodConversion";

interface AccountImportControlProps {
  onLocalImport: (data: GOODData) => void;
  onUidImport: (uid: string, clearData: boolean) => Promise<void>;
  initialUid?: string;
  disabled?: boolean;
}

export function AccountImportControl({
  onLocalImport,
  onUidImport,
  initialUid,
  disabled = false,
}: AccountImportControlProps) {
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const handleUidImport = async () => {
    if (!uidInput) return;

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
            <DialogTitle>{t.ui("accountData.importDialogTitle")}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-4 py-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-semibold block mb-1 text-foreground">
                    {t.ui("accountData.importHelpGood")}
                  </span>
                  <span>
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
                  </span>
                </div>
                <div>
                  <span className="font-semibold block mb-1 text-foreground">
                    {t.ui("accountData.importHelpUid")}
                  </span>
                  <span>{t.ui("accountData.importHelpUidDesc")}</span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* UID Import Section */}
          <div className="pt-4 border-t space-y-3">
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

            <Button
              variant="outline"
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

          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
