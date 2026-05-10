import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BackupApiError,
  type BackupQuotaExceededPayload,
  type BackupUploadQuota,
} from "@/cloud/apiClient";
import type { CloudBackupMetadataSnapshot } from "@/cloud/backupMetadata";
import {
  buildManualBackupMetadataRows,
  downloadManualBackupSelection,
  isCloudMetadataCacheStale,
  type PendingManualBackupAction,
  previewManualBackupAction,
  readCloudMetadataCache,
  refreshManualBackupMetadata,
  uploadManualBackupSelection,
} from "@/cloud/manualBackupController";
import { createCloudBackupApiClient } from "@/cloud/session";
import type { CloudSyncRunResult } from "@/cloud/syncClient";
import type { CloudPartitionId } from "@/cloud/types";
import { CloudBackupMetadataTable } from "@/components/account/CloudBackupMetadataTable";
import { ManualBackupChoiceDialog } from "@/components/account/ManualBackupChoiceDialog";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useCloudSyncMetadataStore } from "@/stores/useCloudSyncMetadataStore";

type Operation = "checking" | "upload" | "download" | null;
type MetadataStatus = "idle" | "loading" | "refreshing";
type Notice = {
  title: string;
  message: string;
};

export default function CloudBackupPage() {
  const { t } = useLanguage();
  const {
    isAuthenticated,
    isLoading: isAccountLoading,
    account,
    ensureSession,
    signIn,
  } = useAppSession();
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState<Notice | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [pendingAction, setPendingAction] =
    useState<PendingManualBackupAction | null>(null);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<
    Set<CloudPartitionId>
  >(new Set());
  const [metadataStatus, setMetadataStatus] = useState<MetadataStatus>("idle");
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [cloudMetadata, setCloudMetadata] =
    useState<CloudBackupMetadataSnapshot | null>(null);
  const [uploadQuota, setUploadQuota] = useState<BackupUploadQuota | null>(
    null
  );
  const [backupAuthExpired, setBackupAuthExpired] = useState(false);
  const partitionsById = useCloudSyncMetadataStore(
    (state) => state.partitionsById
  );
  const apiClient = useMemo(() => createCloudBackupApiClient(), []);
  const sessionUserId = account?.id ?? null;

  const partitionMeta = useMemo(
    () => Object.values(partitionsById),
    [partitionsById]
  );
  const metadataRows = buildManualBackupMetadataRows(
    partitionMeta,
    cloudMetadata
  );
  const canUseCloudBackup = isAuthenticated && !backupAuthExpired;

  const withAppSessionRetry = useCallback(
    async <T,>(run: () => Promise<T>): Promise<T> => {
      try {
        return await run();
      } catch (error) {
        if (!isBackupUnauthenticatedError(error)) throw error;
        const session = await ensureSession();
        if (!session) throw error;
        setBackupAuthExpired(false);
        return run();
      }
    },
    [ensureSession]
  );

  const refreshCloudMetadata = useCallback(
    async (status: MetadataStatus = "refreshing") => {
      if (!sessionUserId) return;
      setMetadataStatus(status);
      setMetadataError(null);
      try {
        const snapshot = await withAppSessionRetry(() =>
          refreshManualBackupMetadata(apiClient, sessionUserId)
        );
        setCloudMetadata(snapshot);
        setUploadQuota(snapshot.quota);
        setBackupAuthExpired(false);
      } catch (error) {
        setUploadQuotaFromError(error, setUploadQuota);
        if (isBackupUnauthenticatedError(error)) {
          setBackupAuthExpired(true);
          setCloudMetadata(null);
          setUploadQuota(null);
          setMetadataError(null);
          return;
        }
        const message = formatBackupError(error, t);
        setMetadataError(message);
      } finally {
        setMetadataStatus("idle");
      }
    },
    [apiClient, sessionUserId, t, withAppSessionRetry]
  );

  const handleSignIn = async () => {
    try {
      await signIn("/account/cloud-backup");
    } catch (signInError) {
      toast.error(
        signInError instanceof Error ? signInError.message : String(signInError)
      );
    }
  };

  useEffect(() => {
    if (!sessionUserId) {
      setCloudMetadata(null);
      setMetadataError(null);
      setUploadQuota(null);
      return;
    }
    const cached = readCloudMetadataCache(sessionUserId);
    if (cached) {
      setCloudMetadata(cached);
      setUploadQuota(cached.quota);
      if (isCloudMetadataCacheStale(cached)) {
        void refreshCloudMetadata("refreshing");
      }
      return;
    }
    void refreshCloudMetadata("loading");
  }, [refreshCloudMetadata, sessionUserId]);

  useEffect(() => {
    if (operation === null) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [operation]);

  const beginUploadToCloud = async () => {
    setOperation("checking");
    setLastError(null);
    setLastNotice(null);
    try {
      const pending = await withAppSessionRetry(() =>
        previewManualBackupAction("upload", apiClient)
      );
      updateUploadQuota(pending.syncResult.quota, setUploadQuota);
      const manualPlan = pending.plan;
      if (manualPlan.choices.length > 0) {
        setPendingAction(pending);
        setSelectedChoiceIds(new Set());
        return;
      }
      if (manualPlan.automaticPartitionIds.length === 0) {
        setLastNotice({
          title: t.ui("accountSystem.uploadStatus"),
          message: t.ui("accountSystem.uploadNotice.noLocalChanges"),
        });
        return;
      }
      setOperation("upload");
      const result = await withAppSessionRetry(() =>
        uploadManualBackupSelection(apiClient, pending, [])
      );
      if (result.status === "uploaded") {
        updateUploadQuota(result.result.quota, setUploadQuota);
      }
      setOperation(null);
      if (result.status === "skipped") {
        setLastNotice({
          title: t.ui("accountSystem.uploadStatus"),
          message: t.ui("accountSystem.uploadNotice.noLocalChanges"),
        });
        return;
      }
      await refreshCloudMetadata();
      toast.success(t.ui("accountSystem.statusToast.uploaded"));
    } catch (error) {
      setUploadQuotaFromError(error, setUploadQuota);
      if (isBackupUnauthenticatedError(error)) {
        setBackupAuthExpired(true);
      }
      const message = formatBackupError(error, t);
      setLastError(message);
      toast.error(message);
    } finally {
      setOperation(null);
    }
  };

  const beginDownloadFromCloud = async () => {
    setOperation("checking");
    setLastError(null);
    setLastNotice(null);
    try {
      const pending = await withAppSessionRetry(() =>
        previewManualBackupAction("download", apiClient)
      );
      updateUploadQuota(pending.syncResult.quota, setUploadQuota);
      const syncResult = pending.syncResult;
      if (syncResult.status === "unsupported") {
        setLastNotice({
          title: t.ui("accountSystem.restoreStatus"),
          message: restoreNotice(syncResult.status, t),
        });
        return;
      }
      const manualPlan = pending.plan;
      if (manualPlan.choices.length > 0) {
        setPendingAction(pending);
        setSelectedChoiceIds(new Set());
        return;
      }
      if (manualPlan.automaticPartitionIds.length === 0) {
        setLastNotice({
          title: t.ui("accountSystem.restoreStatus"),
          message: restoreNotice(syncResult.status, t),
        });
        return;
      }
      await applyCloudDownload(syncResult, manualPlan.automaticPartitionIds);
    } catch (error) {
      if (isBackupUnauthenticatedError(error)) {
        setBackupAuthExpired(true);
      }
      const message = formatBackupError(error, t);
      setLastError(message);
      toast.error(message);
    } finally {
      setOperation(null);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const choiceIds = [...selectedChoiceIds];
    setPendingAction(null);
    setSelectedChoiceIds(new Set());
    if (pendingAction.direction === "upload") {
      await uploadSelectedShards(pendingAction, choiceIds);
      return;
    }
    await applyCloudDownload(pendingAction.syncResult, [
      ...pendingAction.plan.automaticPartitionIds,
      ...choiceIds,
    ]);
  };

  const togglePendingChoice = (
    id: CloudPartitionId,
    checked: boolean
  ): void => {
    setSelectedChoiceIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const uploadSelectedShards = async (
    pending: PendingManualBackupAction,
    selectedIds: CloudPartitionId[]
  ) => {
    const hasUploadWork =
      pending.plan.automaticPartitionIds.length > 0 || selectedIds.length > 0;
    if (hasUploadWork) {
      setOperation("upload");
    }
    setLastError(null);
    setLastNotice(null);
    try {
      const result = await withAppSessionRetry(() =>
        uploadManualBackupSelection(apiClient, pending, selectedIds)
      );
      if (result.status === "uploaded") {
        updateUploadQuota(result.result.quota, setUploadQuota);
      }
      setOperation(null);
      if (result.status === "skipped") {
        setLastNotice({
          title: t.ui("accountSystem.uploadStatus"),
          message: t.ui("accountSystem.manualChoice.allSkipped"),
        });
        return;
      }
      await refreshCloudMetadata();
      toast.success(t.ui("accountSystem.statusToast.uploaded"));
    } catch (error) {
      setUploadQuotaFromError(error, setUploadQuota);
      if (isBackupUnauthenticatedError(error)) {
        setBackupAuthExpired(true);
      }
      const message = formatBackupError(error, t);
      setLastError(message);
      toast.error(message);
    } finally {
      setOperation(null);
    }
  };

  const applyCloudDownload = async (
    syncResult: CloudSyncRunResult,
    partitionIds: CloudPartitionId[]
  ) => {
    setLastError(null);
    setLastNotice(null);
    try {
      if (partitionIds.length === 0) {
        setLastNotice({
          title: t.ui("accountSystem.restoreStatus"),
          message: t.ui("accountSystem.manualChoice.allSkipped"),
        });
        return;
      }
      setOperation("download");
      const applied = await withAppSessionRetry(() =>
        downloadManualBackupSelection(apiClient, syncResult, partitionIds)
      );
      setOperation(null);
      toast.success(
        t
          .ui("accountSystem.restoreApplied")
          .replace("{0}", String(applied.appliedSections.length))
      );
      await refreshCloudMetadata();
    } catch (error) {
      if (isBackupUnauthenticatedError(error)) {
        setBackupAuthExpired(true);
      }
      const message = formatBackupError(error, t);
      setLastError(message);
      toast.error(message);
    } finally {
      setOperation(null);
    }
  };

  return (
    <PageLayout>
      <ScrollLayout>
        <div className="space-y-4">
          <section className="rounded-xl bg-card/30 border border-border overflow-hidden shadow-lg">
            <div className="border-b border-border/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold">
                  {t.ui("accountSystem.cloudBackup")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.ui("accountSystem.cloudBackupDesc")}
                </p>
              </div>
              {operation !== null && <OperationBadge operation={operation} />}
            </div>

            <div className="p-4 space-y-4">
              {!isAccountLoading && (!isAuthenticated || backupAuthExpired) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {t.ui("accountSystem.signInRequired")}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        {backupAuthExpired
                          ? t.ui("accountSystem.cloudSessionExpiredDesc")
                          : t.ui("accountSystem.signInRequiredDesc")}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSignIn()}
                        disabled={isAccountLoading}
                      >
                        {t.ui("accountSystem.signIn")}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {metadataError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {t.ui("accountSystem.metadataFailed")}
                  </AlertTitle>
                  <AlertDescription>{metadataError}</AlertDescription>
                </Alert>
              )}

              <CloudBackupMetadataTable
                rows={metadataRows}
                checkedAt={cloudMetadata?.checkedAt}
                loading={metadataStatus !== "idle"}
                onRefresh={() => void refreshCloudMetadata()}
              />

              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void beginUploadToCloud()}
                  disabled={
                    !canUseCloudBackup ||
                    isAccountLoading ||
                    operation !== null ||
                    uploadQuota?.remaining === 0
                  }
                >
                  <CloudUpload
                    className={cn(
                      "h-4 w-4",
                      operation === "upload" && "animate-spin"
                    )}
                  />
                  {t.ui("accountSystem.uploadToCloud")}
                </Button>
                <Button
                  type="button"
                  onClick={() => void beginDownloadFromCloud()}
                  disabled={
                    !canUseCloudBackup || isAccountLoading || operation !== null
                  }
                >
                  <CloudDownload
                    className={cn(
                      "h-4 w-4",
                      operation === "download" && "animate-spin"
                    )}
                  />
                  {t.ui("accountSystem.downloadFromCloud")}
                </Button>
              </div>

              {uploadQuota && (
                <p className="text-center text-sm text-muted-foreground">
                  {t
                    .ui("accountSystem.uploadQuota")
                    .replace("{0}", String(uploadQuota.used))
                    .replace("{1}", String(uploadQuota.limit))}
                </p>
              )}

              {lastError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.ui("accountSystem.syncFailed")}</AlertTitle>
                  <AlertDescription>{lastError}</AlertDescription>
                </Alert>
              )}

              {lastNotice && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>{lastNotice.title}</AlertTitle>
                  <AlertDescription>{lastNotice.message}</AlertDescription>
                </Alert>
              )}
            </div>
          </section>
        </div>
      </ScrollLayout>
      <ManualBackupChoiceDialog
        action={pendingAction}
        selectedChoiceIds={selectedChoiceIds}
        busy={operation !== null}
        onToggleChoice={togglePendingChoice}
        onCancel={() => {
          setPendingAction(null);
          setSelectedChoiceIds(new Set());
        }}
        onConfirm={() => void confirmPendingAction()}
      />
    </PageLayout>
  );
}

function OperationBadge({
  operation,
}: {
  operation: Exclude<Operation, null>;
}) {
  const { t } = useLanguage();
  const label =
    operation === "checking"
      ? t.ui("accountSystem.status.checking")
      : operation === "upload"
        ? t.ui("accountSystem.status.uploading")
        : t.ui("accountSystem.status.downloading");
  return <Badge variant="secondary">{label}</Badge>;
}

function restoreNotice(
  status: CloudSyncRunResult["status"],
  t: ReturnType<typeof useLanguage>["t"]
) {
  switch (status) {
    case "synced":
    case "uploaded":
      return t.ui("accountSystem.restoreNotice.noCloudChanges");
    case "conflict":
      return t.ui("accountSystem.restoreNotice.conflict");
    case "unsupported":
      return t.ui("accountSystem.restoreNotice.unsupported");
    case "needs-download":
      return t.ui("accountSystem.statusToast.needsDownload");
  }
}

function formatBackupError(
  error: unknown,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (error instanceof BackupApiError) {
    if (isBackupUnauthenticatedError(error)) {
      return t.ui("accountSystem.cloudSessionExpiredDesc");
    }
    if (isQuotaExceededPayload(error.payload)) {
      return t
        .ui("accountSystem.uploadQuotaExceeded")
        .replace("{0}", String(error.payload.quota.limit));
    }
    if (
      error.status === 503 &&
      error.payload &&
      typeof error.payload === "object" &&
      "error" in error.payload &&
      error.payload.error === "backup_storage_not_configured"
    ) {
      return t.ui("accountSystem.backupUnavailable");
    }
    const detail =
      typeof error.payload === "string"
        ? error.payload
        : JSON.stringify(error.payload);
    return `${error.message}${detail ? `: ${detail}` : ""}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function isBackupUnauthenticatedError(error: unknown): boolean {
  return (
    error instanceof BackupApiError &&
    error.status === 401 &&
    !!error.payload &&
    typeof error.payload === "object" &&
    "error" in error.payload &&
    error.payload.error === "unauthenticated"
  );
}

function updateUploadQuota(
  quota: BackupUploadQuota | undefined,
  setUploadQuota: (quota: BackupUploadQuota) => void
): void {
  if (quota) setUploadQuota(quota);
}

function setUploadQuotaFromError(
  error: unknown,
  setUploadQuota: (quota: BackupUploadQuota) => void
): void {
  if (
    error instanceof BackupApiError &&
    isQuotaExceededPayload(error.payload)
  ) {
    setUploadQuota(error.payload.quota);
  }
}

function isQuotaExceededPayload(
  payload: unknown
): payload is BackupQuotaExceededPayload {
  return (
    !!payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error === "monthly_upload_limit_exceeded" &&
    "quota" in payload &&
    isBackupUploadQuota(payload.quota)
  );
}

function isBackupUploadQuota(value: unknown): value is BackupUploadQuota {
  return (
    !!value &&
    typeof value === "object" &&
    "period" in value &&
    typeof value.period === "string" &&
    "limit" in value &&
    Number.isInteger(value.limit) &&
    "used" in value &&
    Number.isInteger(value.used) &&
    "remaining" in value &&
    Number.isInteger(value.remaining) &&
    "resetsAt" in value &&
    Number.isFinite(value.resetsAt)
  );
}
