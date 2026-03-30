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
import type { Instruction, ResultResponse } from "@/lib/artifact-manager/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ArtifactManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Build instructions when user clicks the action button */
  buildInstructions: () => Instruction[];
  /** Label for the action button, e.g. t.ui("manager.applyToGame") */
  actionLabel: string;
}

const DEFAULT_PORT = 8765;

export function ArtifactManagerDialog({
  open,
  onOpenChange,
  buildInstructions,
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
    const instructions = buildInstructions();
    if (instructions.length > 0) {
      submit(instructions);
    }
  }, [buildInstructions, submit]);

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
          {/* Port + Connection Status */}
          {phase.type === "idle" && (
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
            <Button disabled={!isReady} onClick={handleAction}>
              {actionLabel}
            </Button>
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
  const hasProblems =
    summary.not_found > 0 || summary.errors > 0 || summary.aborted > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {hasProblems ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        )}
        <span className="text-sm font-medium">
          {hasProblems
            ? t.ui("manager.completedWithIssues")
            : t.ui("manager.allApplied")}
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
        (r) =>
          r.detail && r.status !== "success" && r.status !== "already_correct"
      ) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {t.ui("manager.showDetails")}
          </summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {result.results
              .filter(
                (r) =>
                  r.detail &&
                  r.status !== "success" &&
                  r.status !== "already_correct"
              )
              .map((r) => (
                <li key={r.id} className="text-muted-foreground">
                  <span className="font-mono">{r.id}</span>: {r.detail}
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
