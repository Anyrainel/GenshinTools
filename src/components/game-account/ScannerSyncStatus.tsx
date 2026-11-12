import { Power, Radio, Settings2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ContinuousInventorySyncDialog } from "@/components/game-account/ContinuousInventorySyncDialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScannerSync } from "@/contexts/ScannerSyncContext";

export function ScannerSyncStatus() {
  const { t } = useLanguage();
  const session = useScannerSync();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const enabled = session?.enabled ?? false;
  useEffect(() => {
    if (!enabled) setDetailsOpen(false);
  }, [enabled]);
  if (!session || !enabled) return null;
  const { sync, account, syncedAccount, setEnabled } = session;
  const target = syncedAccount ?? account;
  const pending = sync.status === "connecting" || sync.status === "waiting";
  const attention = !pending && sync.status !== "synced";
  const Icon = attention ? TriangleAlert : Radio;
  const statusText =
    sync.status === "synced"
      ? t.ui("continuous.active")
      : pending
        ? t.ui("continuous.pending")
        : t.ui("continuous.attention");

  return (
    <>
      <section
        aria-label={t.ui("continuous.title")}
        className="shrink-0 border-b border-primary/30 bg-primary/10 px-3 py-2 sm:px-4"
      >
        <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p
            role="status"
            className="min-w-0 flex-1 truncate text-sm font-medium"
          >
            <span className="block truncate leading-4 sm:inline sm:leading-5">
              GGScanner
            </span>
            <span className="hidden sm:inline"> · </span>
            <span className="block truncate text-xs leading-4 sm:inline sm:text-sm sm:leading-5">
              {statusText}
            </span>
            {target && (
              <span className="hidden sm:inline"> · {target.name}</span>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailsOpen(true)}
          >
            <Settings2 className="hidden h-4 w-4 sm:block" aria-hidden />
            {t.ui("continuous.details")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEnabled(false)}>
            <Power className="h-4 w-4" aria-hidden />
            {t.ui("continuous.stop")}
          </Button>
        </div>
      </section>
      <ContinuousInventorySyncDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
}
