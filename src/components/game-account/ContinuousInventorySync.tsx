import { Power, Radio } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScannerSync } from "@/contexts/ScannerSyncContext";
import { cn } from "@/lib/utils";

export function ContinuousInventorySync() {
  const { t } = useLanguage();
  const id = useId();
  const session = useScannerSync();
  if (!session) return null;
  const {
    enabled,
    setEnabled,
    portInput,
    setPortInput,
    commitPort,
    account,
    sync,
  } = session;
  const statusText = {
    off: t.ui("continuous.off"),
    connecting: t.ui("continuous.connecting"),
    waiting: t.ui("continuous.waiting"),
    synced: t.ui("continuous.synced"),
    disabled: t.ui("continuous.disabled"),
    unsupported: t.ui("continuous.unsupported"),
    failed: t.ui("continuous.failed"),
    disconnected: t.ui("continuous.disconnected"),
    invalid: t.ui("continuous.invalid"),
  }[sync.status];
  return (
    <section className="space-y-4 text-left text-sm">
      <div className="flex w-full items-center justify-between gap-3">
        <Label htmlFor={`${id}-port`}>{t.ui("manager.port")}</Label>
        <Input
          id={`${id}-port`}
          className="h-9 w-28 border-border"
          inputMode="numeric"
          value={portInput}
          disabled={enabled}
          onChange={(event) => setPortInput(event.target.value)}
          onBlur={commitPort}
        />
      </div>
      <Button
        variant={enabled ? "secondary" : "default"}
        className={cn(
          "h-11 w-full",
          !enabled &&
            "bg-golden text-golden-foreground hover:bg-golden/90 focus-visible:ring-golden/50"
        )}
        onClick={() => {
          if (!enabled) commitPort();
          setEnabled(!enabled);
        }}
      >
        {enabled ? (
          <Power className="h-4 w-4" aria-hidden />
        ) : (
          <Radio className="h-4 w-4" aria-hidden />
        )}
        {enabled ? t.ui("continuous.stop") : t.ui("continuous.start")}
      </Button>
      {enabled && account && (
        <div
          role="status"
          className="space-y-2 rounded-lg border border-border bg-muted p-3 break-words"
        >
          <p>{statusText}</p>
          {sync.updatedAt !== undefined && (
            <p className="text-xs text-muted-foreground">
              {t
                .ui("continuous.updated")
                .replace("{0}", new Date(sync.updatedAt).toLocaleString())}
            </p>
          )}
          {!!sync.warnings && (
            <p>
              {t
                .ui("scanner.syncWarnings")
                .replace("{0}", String(sync.warnings))}
            </p>
          )}
          {sync.details &&
            sync.status !== "waiting" &&
            sync.status !== "disabled" && (
              <details className="text-xs">
                <summary className="cursor-pointer">
                  {t.ui("continuous.details")}
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                  {sync.details}
                </pre>
              </details>
            )}
        </div>
      )}
      {account && (
        <p>{t.ui("continuous.target").replace("{0}", account.name)}</p>
      )}
      {enabled && session.syncedAccount && sync.routing === "uid" && (
        <p>
          {t.ui("continuous.routed").replace("{0}", session.syncedAccount.name)}
        </p>
      )}
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-medium">
          {t.ui("continuous.details")}
        </summary>
        <p className="mt-3 text-xs text-muted-foreground">
          {t.ui("continuous.limits")}
        </p>
      </details>
    </section>
  );
}
