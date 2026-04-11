import { Button } from "@/components/ui/button";
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
import { fetchArtifacts } from "@/lib/artifact-manager/client";
import { replaceArtifactsFromSnapshot } from "@/lib/artifact-manager/storeSync";
import type {
  EquipPayload,
  InstructionStatus,
  ManagePayload,
  ResultResponse,
} from "@/lib/artifact-manager/types";
import { cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { remapFreezeStoreForImport } from "@/stores/useFreezeStore";
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
      const payload = job.build();
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
  }, [job, submit]);

  // Temporary: fetch artifacts and update store directly
  const handleFetchAndSync = useCallback(async () => {
    try {
      const snapshot = await fetchArtifacts(port);
      if (!snapshot) {
        console.warn("No snapshot available (404/503)");
        return;
      }
      const account = getActiveAccount(useAccountStore.getState());
      if (account) {
        const { data: updated, artifactIdMap } = replaceArtifactsFromSnapshot(
          account.data,
          snapshot
        );
        remapFreezeStoreForImport(artifactIdMap);
        useAccountStore.getState().addOrUpdateAccount(account.id, {
          data: updated,
        });
        console.log(`Synced ${snapshot.length} artifacts from scanner`);
      }
    } catch (e) {
      console.error("Failed to fetch artifacts:", e);
    }
  }, [port]);

  const handleClose = () => {
    if (phase.type === "completed" || phase.type === "error") {
      reset();
    }
    onOpenChange(false);
  };

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
            <JobResultSummary result={phase.result} t={t} />
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
              <Button disabled={!isReady} onClick={handleAction}>
                {actionLabel}
              </Button>
              {import.meta.env.DEV && (
                <Button
                  variant="secondary"
                  disabled={!isConnected}
                  onClick={handleFetchAndSync}
                >
                  Sync artifacts
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

  if (connection.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        <span className="text-sm text-destructive">{connection.message}</span>
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
  t,
}: {
  result: ResultResponse;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const { summary } = result;

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
