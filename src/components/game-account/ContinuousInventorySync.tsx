import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useContinuousInventorySync } from "@/hooks/useContinuousInventorySync";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";

export function ContinuousInventorySync() {
  const { t } = useLanguage();
  const account = useAccountStore(getActiveAccount);
  const [enabled, setEnabled] = useState(false);
  const [port, setPort] = useState(8765);
  const [portInput, setPortInput] = useState("8765");
  const sync = useContinuousInventorySync(enabled && !!account, port);
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
  const summaryStatus =
    sync.status === "synced"
      ? t.ui("continuous.active")
      : sync.status === "connecting" || sync.status === "waiting"
        ? t.ui("continuous.pending")
        : t.ui("continuous.attention");
  return (
    <details className="mx-4 mb-2 shrink-0 rounded-lg border border-border bg-card p-2 text-sm">
      <summary className="cursor-pointer">
        {t.ui("continuous.title")}
        {enabled && account ? ` · ${summaryStatus}` : ""}
      </summary>
      <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox
            id="continuous-enabled"
            checked={enabled && !!account}
            disabled={!account}
            onCheckedChange={(value) => setEnabled(value === true)}
          />
          <Label htmlFor="continuous-enabled">
            {t.ui("continuous.enable")}
          </Label>
          <Label htmlFor="continuous-port">{t.ui("manager.port")}</Label>
          <Input
            id="continuous-port"
            className="h-8 w-24"
            inputMode="numeric"
            value={portInput}
            onChange={(event) => setPortInput(event.target.value)}
            onBlur={() => {
              const value = Number(portInput);
              if (Number.isInteger(value) && value > 0 && value <= 65535)
                setPort(value);
              else setPortInput(String(port));
            }}
          />
        </div>
        <p>
          {t
            .ui("continuous.safety")
            .replace("{0}", account?.name ?? t.ui("accountData.noData"))}
        </p>
        <p className="text-xs text-muted-foreground">
          {t.ui("continuous.limits")}
        </p>
        {enabled && account && (
          <div role="status" className="space-y-1 break-words">
            <p>{statusText}</p>
            {sync.updatedAt !== undefined && (
              <p>
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
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs">
                  {sync.details}
                </pre>
              )}
          </div>
        )}
      </div>
    </details>
  );
}
