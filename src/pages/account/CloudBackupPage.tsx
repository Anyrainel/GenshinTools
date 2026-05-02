import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  type LucideIcon,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BackupApiError } from "@/cloud/apiClient";
import {
  createCloudBackupApiClient,
  getCloudBackupDevSession,
} from "@/cloud/session";
import {
  applyCloudRestoreAndMarkSynced,
  type CloudSyncRunResult,
  downloadCloudSyncRestorePlan,
  runCloudSyncOnce,
} from "@/cloud/syncClient";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useCloudSyncMetadataStore } from "@/stores/useCloudSyncMetadataStore";

type Operation = "sync" | "restore" | "overwrite" | null;

export default function CloudBackupPage() {
  const { t } = useLanguage();
  const [lastResult, setLastResult] = useState<CloudSyncRunResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const partitionsById = useCloudSyncMetadataStore(
    (state) => state.partitionsById
  );
  const conflictsById = useCloudSyncMetadataStore(
    (state) => state.conflictsById
  );
  const session = getCloudBackupDevSession();

  const conflicts = useMemo(
    () => Object.values(conflictsById),
    [conflictsById]
  );
  const partitionMeta = useMemo(
    () => Object.values(partitionsById),
    [partitionsById]
  );
  const lastSyncedAt = Math.max(
    0,
    ...partitionMeta.map((meta) => meta.lastSyncedAt ?? 0)
  );

  const runManualSync = async (explicitLocalOverwrite?: {
    groupKeys: string[];
  }) => {
    setOperation(explicitLocalOverwrite ? "overwrite" : "sync");
    setLastError(null);
    try {
      const result = await runCloudSyncOnce({
        apiClient: createCloudBackupApiClient(),
        ...(explicitLocalOverwrite ? { explicitLocalOverwrite } : {}),
      });
      setLastResult(result);
      toast.success(statusToast(result.status, t));
    } catch (error) {
      const message = formatBackupError(error);
      setLastError(message);
      toast.error(message);
    } finally {
      setOperation(null);
    }
  };

  const applyCloudChanges = async () => {
    if (!lastResult) return;
    setOperation("restore");
    setLastError(null);
    try {
      const downloaded = await downloadCloudSyncRestorePlan({
        apiClient: createCloudBackupApiClient(),
        syncResult: lastResult,
      });
      const applied = applyCloudRestoreAndMarkSynced({ downloaded });
      toast.success(
        t
          .ui("accountSystem.restoreApplied")
          .replace("{0}", String(applied.appliedSections.length))
      );
      const refreshed = await runCloudSyncOnce({
        apiClient: createCloudBackupApiClient(),
      });
      setLastResult(refreshed);
    } catch (error) {
      const message = formatBackupError(error);
      setLastError(message);
      toast.error(message);
    } finally {
      setOperation(null);
    }
  };

  const overwriteCloudWithLocal = async () => {
    const groupKeys = [
      ...new Set(conflicts.map((conflict) => conflict.groupKey)),
    ];
    if (groupKeys.length === 0) return;
    await runManualSync({ groupKeys });
  };

  const status = lastResult?.status ?? "idle";

  return (
    <PageLayout>
      <ScrollLayout bodyClassName="max-w-5xl">
        <div className="space-y-4">
          <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
            <div className="bg-gradient-select border-b border-border/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold">
                  {t.ui("accountSystem.cloudBackup")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.ui("accountSystem.cloudBackupDesc")}
                </p>
              </div>
              <StatusBadge status={status} />
            </div>

            <div className="p-4 space-y-4">
              {!session && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {t.ui("accountSystem.devSessionRequired")}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        {t.ui("accountSystem.devSessionRequiredDesc")}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/account">
                          {t.ui("accountSystem.openAccount")}
                        </Link>
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {lastError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.ui("accountSystem.syncFailed")}</AlertTitle>
                  <AlertDescription>{lastError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <StatusTile
                  icon={Cloud}
                  label={t.ui("accountSystem.trackedPartitions")}
                  value={String(partitionMeta.length)}
                />
                <StatusTile
                  icon={ShieldAlert}
                  label={t.ui("accountSystem.conflicts")}
                  value={String(conflicts.length)}
                  attention={conflicts.length > 0}
                />
                <StatusTile
                  icon={CheckCircle2}
                  label={t.ui("accountSystem.lastSync")}
                  value={
                    lastSyncedAt
                      ? t.shortDate(new Date(lastSyncedAt))
                      : t.ui("common.none")
                  }
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void runManualSync()}
                  disabled={!session || operation !== null}
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      operation === "sync" && "animate-spin"
                    )}
                  />
                  {t.ui("accountSystem.syncNow")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void applyCloudChanges()}
                  disabled={
                    !session ||
                    operation !== null ||
                    lastResult?.status !== "needs-download"
                  }
                >
                  <CloudDownload className="h-4 w-4" />
                  {t.ui("accountSystem.applyCloudChanges")}
                </Button>
                <Button
                  type="button"
                  variant="destructive-outline"
                  onClick={() => void overwriteCloudWithLocal()}
                  disabled={
                    !session || operation !== null || conflicts.length === 0
                  }
                >
                  <CloudUpload className="h-4 w-4" />
                  {t.ui("accountSystem.keepLocal")}
                </Button>
              </div>
            </div>
          </section>

          {conflicts.length > 0 && (
            <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
              <div className="bg-gradient-select border-b border-border/70 px-4 py-2.5">
                <h2 className="text-sm font-semibold">
                  {t.ui("accountSystem.conflicts")}
                </h2>
              </div>
              <div className="divide-y divide-border">
                {conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{conflict.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {conflict.reason}
                      </div>
                    </div>
                    <Badge variant="outline">{conflict.groupKey}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const variant =
    status === "conflict" || status === "unsupported"
      ? "destructive"
      : status === "needs-download"
        ? "secondary"
        : "default";
  return <Badge variant={variant}>{statusLabel(status, t)}</Badge>;
}

function StatusTile({
  icon: Icon,
  label,
  value,
  attention,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3 flex items-center gap-3">
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          attention ? "text-destructive" : "text-primary"
        )}
      />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function statusLabel(status: string, t: ReturnType<typeof useLanguage>["t"]) {
  switch (status) {
    case "synced":
      return t.ui("accountSystem.status.synced");
    case "uploaded":
      return t.ui("accountSystem.status.uploaded");
    case "needs-download":
      return t.ui("accountSystem.status.needsDownload");
    case "conflict":
      return t.ui("accountSystem.status.conflict");
    case "unsupported":
      return t.ui("accountSystem.status.unsupported");
    default:
      return t.ui("accountSystem.status.idle");
  }
}

function statusToast(
  status: CloudSyncRunResult["status"],
  t: ReturnType<typeof useLanguage>["t"]
) {
  switch (status) {
    case "synced":
      return t.ui("accountSystem.statusToast.synced");
    case "uploaded":
      return t.ui("accountSystem.statusToast.uploaded");
    case "needs-download":
      return t.ui("accountSystem.statusToast.needsDownload");
    case "conflict":
      return t.ui("accountSystem.statusToast.conflict");
    case "unsupported":
      return t.ui("accountSystem.statusToast.unsupported");
  }
}

function formatBackupError(error: unknown): string {
  if (error instanceof BackupApiError) {
    const detail =
      typeof error.payload === "string"
        ? error.payload
        : JSON.stringify(error.payload);
    return `${error.message}${detail ? `: ${detail}` : ""}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
