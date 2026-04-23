import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useArtifactManagerConnection } from "@/hooks/useArtifactManagerConnection";
import { useArtifactManagerJob } from "@/hooks/useArtifactManagerJob";
import type { JobInput } from "@/hooks/useArtifactManagerJob";
import type { IGOODArtifact } from "@/lib/account-data/import/goodConversion";
import { fetchArtifacts } from "@/lib/account-data/manager/client";
import {
  type JobAnalysis,
  type SnapshotDiff,
  analyzeManageResults,
  computeSnapshotDiff,
  rebuildAccountFromSnapshot,
} from "@/lib/account-data/manager/storeSync";
import type {
  EquipPayload,
  InstructionStatus,
  ManagePayload,
  ResultResponse,
} from "@/lib/account-data/manager/types";
import { cn } from "@/lib/utils";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type ArtifactManagerJobConfig =
  | { type: "manage"; build: () => ManagePayload }
  | { type: "equip"; build: () => EquipPayload };

interface ArtifactManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: ArtifactManagerJobConfig;
  actionLabel: string;
}

const DEFAULT_PORT = 8765;

const STATUS_LABELS: Record<InstructionStatus, string> = {
  success: "Success",
  already_correct: "Already correct",
  not_found: "Not found in inventory",
  invalid_input: "Invalid input",
  ocr_error: "OCR failed",
  ui_error: "UI interaction failed",
  aborted: "Cancelled",
  skipped: "Skipped",
};

export function ArtifactManagerDialog({
  open,
  onOpenChange,
  job,
  actionLabel,
}: ArtifactManagerDialogProps) {
  const { t } = useLanguage();
  const [port, setPort] = useState(DEFAULT_PORT);
  const [portInput, setPortInput] = useState(String(DEFAULT_PORT));
  const [includeLock, setIncludeLock] = useState(true);
  const [includeUnlock, setIncludeUnlock] = useState(true);

  const { connection, refresh } = useArtifactManagerConnection(open, port);
  const { phase, submit, reset } = useArtifactManagerJob(port);

  // Sync port input → port number on blur or enter
  const commitPort = useCallback(() => {
    const n = Number.parseInt(portInput, 10);
    if (n > 0 && n <= 65535) {
      setPort(n);
    } else {
      setPortInput(String(port));
    }
  }, [portInput, port]);

  // Reset job state when dialog closes
  useEffect(() => {
    if (!open && phase.type !== "idle") {
      // Only reset if completed or errored — don't reset running jobs
      if (phase.type === "completed" || phase.type === "error") {
        reset();
      }
    }
  }, [open, phase.type, reset]);

  const isConnected = connection.status === "connected";
  const isReady =
    isConnected &&
    connection.health.enabled &&
    connection.health.gameAlive &&
    !connection.health.busy;
  const isJobActive =
    phase.type === "submitting" ||
    phase.type === "submitted" ||
    phase.type === "running";

  const handleAction = useCallback(() => {
    if (job.type === "manage") {
      const full = job.build();
      const payload: ManagePayload = {
        request: {
          lock: includeLock ? full.request.lock : [],
          unlock: includeUnlock ? full.request.unlock : [],
        },
        lockIds: includeLock ? full.lockIds : [],
        unlockIds: includeUnlock ? full.unlockIds : [],
      };
      const total = payload.request.lock.length + payload.request.unlock.length;
      if (total > 0) {
        submit({ type: "manage", payload });
      }
    } else {
      const payload = job.build();
      if (payload.request.equip.length > 0) {
        submit({ type: "equip", payload });
      }
    }
  }, [job, submit, includeLock, includeUnlock]);

  const applySnapshot = useCallback((snapshot: IGOODArtifact[]) => {
    const account = getActiveAccount(useAccountStore.getState());
    if (account) {
      const { data: updated, artifactIdMap } = rebuildAccountFromSnapshot(
        account.data,
        snapshot
      );
      applyAccountImport({
        accountId: account.id,
        data: updated,
        artifactIdMap,
      });
      console.log(`Synced ${snapshot.length} artifacts from scanner`);
    }
  }, []);

  const handleFetchAndSync = useCallback(async () => {
    try {
      const snapshot = await fetchArtifacts(port);
      if (!snapshot) {
        console.warn("No snapshot available (404/503)");
        return;
      }
      applySnapshot(snapshot);
    } catch (e) {
      console.error("Failed to fetch artifacts:", e);
    }
  }, [port, applySnapshot]);

  const handleClose = useCallback(() => {
    if (phase.type === "completed" || phase.type === "error") {
      reset();
    }
    onOpenChange(false);
  }, [phase.type, reset, onOpenChange]);

  const handleApplySnapshot = useCallback(() => {
    if (phase.type === "completed" && phase.snapshot) {
      applySnapshot(phase.snapshot);
    }
    handleClose();
  }, [phase, applySnapshot, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.ui("manager.title")}</DialogTitle>
          <DialogDescription>
            {t.ui("manager.connectionDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Setup Instructions + Port + Connection Status */}
          {phase.type === "idle" && (
            <div className="space-y-4">
              <SetupInstructions t={t} />
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="manager-port" className="text-xs">
                    {t.ui("manager.port")}
                  </Label>
                  <Input
                    id="manager-port"
                    className="w-24 h-8 text-sm"
                    value={portInput}
                    onChange={(e) => setPortInput(e.target.value)}
                    onBlur={commitPort}
                    onKeyDown={(e) => e.key === "Enter" && commitPort()}
                  />
                </div>
                <ConnectionStatus
                  connection={connection}
                  t={t}
                  onRetry={refresh}
                />
              </div>
              {job.type === "manage" && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="include-lock"
                      checked={includeLock}
                      onCheckedChange={(v) => setIncludeLock(!!v)}
                    />
                    <label htmlFor="include-lock">
                      {t.ui("manager.includeLock")}
                    </label>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="include-unlock"
                      checked={includeUnlock}
                      onCheckedChange={(v) => setIncludeUnlock(!!v)}
                    />
                    <label htmlFor="include-unlock">
                      {t.ui("manager.includeUnlock")}
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Job Progress */}
          {(phase.type === "submitting" || phase.type === "submitted") && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm">
                {phase.type === "submitting"
                  ? t.ui("manager.submitting")
                  : t.ui("manager.waitingForGame")}
              </span>
            </div>
          )}

          {phase.type === "running" && (
            <div className="space-y-3">
              <Progress
                value={(phase.completed / phase.total) * 100}
                className="h-2"
              />
              <p className="text-sm text-muted-foreground">
                {t
                  .ui("manager.processed")
                  .replace("{0}", String(phase.completed))
                  .replace("{1}", String(phase.total))}
              </p>
            </div>
          )}

          {phase.type === "completed" && (
            <JobResultSummary
              result={phase.result}
              input={phase.input}
              snapshot={phase.snapshot}
              t={t}
              onApplySync={handleApplySnapshot}
              onSkipSync={handleClose}
            />
          )}

          {phase.type === "error" && (
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm">{phase.message}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {phase.type === "idle" && (
            <>
              <Button
                disabled={
                  !isReady ||
                  (job.type === "manage" && !includeLock && !includeUnlock)
                }
                onClick={handleAction}
              >
                {actionLabel}
              </Button>
              {import.meta.env.DEV && (
                <Button
                  variant="secondary"
                  disabled={!isConnected}
                  onClick={handleFetchAndSync}
                >
                  {t.ui("manager.syncArtifacts")}
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={handleClose}>
            {isJobActive ? t.ui("manager.minimize") : t.ui("manager.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionStatus({
  connection,
  t,
  onRetry,
}: {
  connection: ReturnType<typeof useArtifactManagerConnection>["connection"];
  t: ReturnType<typeof useLanguage>["t"];
  onRetry: () => void;
}) {
  if (connection.status === "disconnected") {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t.ui("manager.offline")}
        </span>
      </div>
    );
  }

  if (connection.status === "cors-blocked") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-sm text-destructive">
            {t.ui("manager.errorCors")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground ml-3.5">
          {t.ui("manager.errorCorsHint")}
        </p>
      </div>
    );
  }

  if (connection.status === "error") {
    const code = connection.httpStatus;
    let errorText: string;
    if (code === 404) {
      errorText = t.ui("manager.errorNotGOODScanner");
    } else if (code === 403) {
      errorText = t.ui("manager.errorRejected");
    } else if (code === 401) {
      errorText = t.ui("manager.errorAuth");
    } else if (code === 408) {
      errorText = t.ui("manager.errorTimeout");
    } else if (code >= 500) {
      errorText = t.ui("manager.errorServer").replace("{0}", String(code));
    } else {
      errorText = t.ui("manager.errorUnexpected").replace("{0}", String(code));
    }
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-sm text-destructive">{errorText}</span>
        </div>
        {connection.body && (
          <p className="text-xs text-muted-foreground ml-3.5 break-all">
            {connection.body}
          </p>
        )}
      </div>
    );
  }

  const h = connection.health;
  const isReady = h.enabled && h.gameAlive && !h.busy;

  let statusText: string;
  let dotColor: string;
  if (isReady) {
    statusText = t.ui("manager.ready");
    dotColor = "bg-green-500";
  } else if (h.busy) {
    statusText = t.ui("manager.busy");
    dotColor = "bg-yellow-500";
  } else if (!h.gameAlive) {
    statusText = t.ui("manager.gameNotRunning");
    dotColor = "bg-yellow-500";
  } else {
    statusText = t.ui("manager.paused");
    dotColor = "bg-yellow-500";
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      <span className="text-sm">{statusText}</span>
    </div>
  );
}

function JobResultSummary({
  result,
  input,
  snapshot,
  t,
  onApplySync,
  onSkipSync,
}: {
  result: ResultResponse;
  input: JobInput;
  snapshot: IGOODArtifact[] | null;
  t: ReturnType<typeof useLanguage>["t"];
  onApplySync: () => void;
  onSkipSync: () => void;
}) {
  const { summary } = result;

  // Compute analysis for manage jobs
  const analysis: JobAnalysis | null =
    input.type === "manage"
      ? analyzeManageResults(input.payload, result.results)
      : null;

  // Compute snapshot diff if available
  const diff: SnapshotDiff | null = (() => {
    if (!snapshot) return null;
    const account = getActiveAccount(useAccountStore.getState());
    if (!account) return null;
    return computeSnapshotDiff(account.data, snapshot);
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <span className="text-sm font-medium">
          {t.ui("manager.completed").replace("{0}", String(summary.total))}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {summary.success > 0 && (
          <SummaryRow
            label={t.ui("manager.applied")}
            count={summary.success}
            color="text-green-500"
          />
        )}
        {summary.already_correct > 0 && (
          <SummaryRow
            label={t.ui("manager.alreadyCorrect")}
            count={summary.already_correct}
            color="text-muted-foreground"
          />
        )}
        {summary.not_found > 0 && (
          <SummaryRow
            label={t.ui("manager.notFound")}
            count={summary.not_found}
            color="text-yellow-500"
          />
        )}
        {summary.errors > 0 && (
          <SummaryRow
            label={t.ui("manager.errors")}
            count={summary.errors}
            color="text-destructive"
          />
        )}
        {summary.aborted > 0 && (
          <SummaryRow
            label={t.ui("manager.aborted")}
            count={summary.aborted}
            color="text-muted-foreground"
          />
        )}
      </div>

      {/* Discrepancy details for manage jobs */}
      {analysis?.hasDiscrepancies && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {analysis.notFoundCount > 0 && (
            <p>
              {t
                .ui("manager.notFoundInfo")
                .replace("{0}", String(analysis.notFoundCount))}
            </p>
          )}
          {analysis.alreadyCorrectCount > 0 && (
            <p>
              {t
                .ui("manager.alreadyCorrectInfo")
                .replace("{0}", String(analysis.alreadyCorrectCount))}
            </p>
          )}
          {analysis.errorCount > 0 && (
            <p>
              {t
                .ui("manager.errorInfo")
                .replace("{0}", String(analysis.errorCount))}
            </p>
          )}
        </div>
      )}

      {result.results.some(
        (r) => r.status !== "success" && r.status !== "already_correct"
      ) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {t.ui("manager.showDetails")}
          </summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {result.results
              .filter(
                (r) => r.status !== "success" && r.status !== "already_correct"
              )
              .map((r) => (
                <li key={r.id} className="text-muted-foreground">
                  <span className="font-mono">{r.id}</span>:{" "}
                  {STATUS_LABELS[r.status]}
                </li>
              ))}
          </ul>
        </details>
      )}

      {/* Snapshot sync section */}
      {diff && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">
            {t.ui("manager.snapshotAvailable")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t
              .ui("manager.snapshotDiff")
              .replace("{0}", String(diff.snapshotCount))
              .replace("{1}", String(diff.snapshotLocked))
              .replace("{2}", String(diff.localCount))
              .replace("{3}", String(diff.localLocked))}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onApplySync}>
              {t.ui("manager.applyFullSync")}
            </Button>
            <Button size="sm" variant="outline" onClick={onSkipSync}>
              {t.ui("manager.skipSync")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className={color}>{count}</span>
    </>
  );
}

const GOODSCANNER_RELEASES =
  "https://github.com/Anyrainel/GOODScanner/releases";
const GOODSCANNER_PROXY_EXE =
  "https://gh-proxy.org/https://github.com/Anyrainel/GOODScanner/releases/latest/download/GOODScanner.exe";

function SetupInstructions({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
  const link = (
    <a
      href={GOODSCANNER_RELEASES}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-400 hover:underline"
    >
      GOODScanner
      <ExternalLink className="h-3 w-3" />
    </a>
  );

  const step1Parts = t.ui("manager.setupStep1").split("{0}");

  return (
    <div className="space-y-2">
      <ol className="space-y-1.5 text-sm list-decimal list-inside">
        <li>
          {step1Parts[0]}
          {link}
          {step1Parts[1]}
          <div className="flex items-center gap-1.5 mt-1 ml-0">
            <span className="text-xs text-foreground/80">
              {t.ui("import.proxyHint")}
            </span>
            <a
              href={GOODSCANNER_PROXY_EXE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors"
            >
              GOODScanner.exe
              <Download className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </li>
        <li>{t.ui("manager.setupStep2")}</li>
        <li>{t.ui("manager.setupStep3")}</li>
        <li>{t.ui("manager.setupStep4")}</li>
      </ol>
    </div>
  );
}
