import { Radio } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScannerSync } from "@/contexts/ScannerSyncContext";

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
    confirm: t.ui("continuous.confirm"),
    synced: t.ui("continuous.synced"),
    disabled: t.ui("continuous.disabled"),
    unsupported: t.ui("continuous.unsupported"),
    failed: t.ui("continuous.failed"),
    disconnected: t.ui("continuous.disconnected"),
    invalid: t.ui("continuous.invalid"),
  }[sync.status];
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 font-semibold">
            <Radio className="h-4 w-4 text-primary" aria-hidden />
            GGScanner
          </h3>
          <Label
            htmlFor={`${id}-enabled`}
            className="block cursor-pointer text-sm"
          >
            {t.ui("continuous.title")}
          </Label>
        </div>
        <Switch
          id={`${id}-enabled`}
          checked={enabled}
          disabled={!account}
          onCheckedChange={setEnabled}
        />
      </div>
      {enabled && account && (
        <div role="status" className="space-y-2 break-words">
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
          {sync.status === "confirm" && (
            <Button size="sm" onClick={sync.confirm}>
              {t.ui("continuous.approve").replace("{0}", account.name)}
            </Button>
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
      {!account && <p>{t.ui("continuous.noAccount")}</p>}
      {enabled && account && (
        <p>{t.ui("continuous.safety").replace("{0}", account.name)}</p>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-medium">
          {t.ui("continuous.connection")}
        </summary>
        <div className="mt-3 flex items-center gap-3">
          <Label htmlFor={`${id}-port`}>{t.ui("manager.port")}</Label>
          <Input
            id={`${id}-port`}
            className="h-8 w-24"
            inputMode="numeric"
            value={portInput}
            disabled={enabled}
            onChange={(event) => setPortInput(event.target.value)}
            onBlur={commitPort}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t.ui("continuous.limits")}
        </p>
      </details>
    </section>
  );
}
