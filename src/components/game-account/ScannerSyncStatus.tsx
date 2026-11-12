import { Power, Radio, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScannerSync } from "@/contexts/ScannerSyncContext";
import { cn } from "@/lib/utils";

export function ScannerSyncStatus() {
  const { t } = useLanguage();
  const session = useScannerSync();
  const enabled = session?.enabled ?? false;
  const sync = session?.sync;
  const [now, setNow] = useState(Date.now);
  const [highlightedRequest, setHighlightedRequest] = useState<number>();

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || sync?.requestStartedAt === undefined) return;
    setHighlightedRequest(sync.requestStartedAt);
    if (sync.isRequesting) return;
    // Keep even an immediately resolved request visible before the color fades.
    const timer = setTimeout(() => setHighlightedRequest(undefined), 200);
    return () => clearTimeout(timer);
  }, [enabled, sync?.isRequesting, sync?.requestStartedAt]);

  if (!session || !enabled) return null;
  const { account, syncedAccount, setEnabled, port } = session;
  const target = syncedAccount ?? account;
  const attention = !["off", "connecting", "waiting", "synced"].includes(
    session.sync.status
  );
  const Icon = attention ? TriangleAlert : Radio;
  const highlighted =
    session.sync.isRequesting ||
    (session.sync.requestStartedAt !== undefined &&
      highlightedRequest === session.sync.requestStartedAt);
  const statusText = {
    off: t.ui("continuous.connecting"),
    connecting: t.ui("continuous.connecting"),
    waiting: t.ui("continuous.waiting"),
    synced: "",
    disabled: t.ui("continuous.disabled"),
    unsupported: t.ui("continuous.unsupported"),
    failed: t.ui("continuous.failed"),
    disconnected: t.ui("continuous.disconnected"),
    invalid: t.ui("continuous.invalid"),
  }[session.sync.status];
  const seconds = Math.max(
    0,
    Math.floor((now - (session.sync.lastSyncedAt ?? now)) / 1000)
  );
  const lastSync =
    seconds < 60
      ? t.ui("continuous.lastSyncSeconds").replace("{0}", String(seconds))
      : t
          .ui("continuous.lastSyncMinutes")
          .replace("{0}", String(Math.floor(seconds / 60)));

  return (
    <section
      aria-label={t.ui("continuous.title")}
      data-requesting={session.sync.isRequesting}
      className={cn(
        "shrink-0 border-b border-primary/30 px-3 py-2 transition-colors ease-out motion-reduce:transition-none sm:px-4",
        highlighted
          ? "bg-primary/25 duration-0"
          : "bg-primary/10 duration-[1800ms]"
      )}
    >
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <div
          role="status"
          aria-live="off"
          className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs font-medium sm:text-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            GGScanner
          </span>
          <span>{t.ui("continuous.port").replace("{0}", String(port))}</span>
          {session.sync.lastSyncedAt !== undefined && (
            <time dateTime={new Date(session.sync.lastSyncedAt).toISOString()}>
              {lastSync}
            </time>
          )}
          {statusText && <span className="break-words">{statusText}</span>}
          {target && <span className="break-all">{target.name}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEnabled(false)}>
          <Power className="h-4 w-4" aria-hidden />
          {t.ui("continuous.stop")}
        </Button>
      </div>
    </section>
  );
}
