import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { JobPhase } from "@/hooks/useArtifactManagerJob";
import type { ResultResponse } from "@/lib/artifact-manager/types";
import { CheckCircle2, AlertTriangle, Loader2, XCircle } from "lucide-react";

interface JobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: JobPhase;
  onReset: () => void;
}

export function JobDialog({ open, onOpenChange, phase, onReset }: JobDialogProps) {
  const handleClose = () => {
    if (phase.type === "completed" || phase.type === "error") {
      onReset();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Artifact Manager</DialogTitle>
          <DialogDescription>
            {phase.type === "submitting" && "Sending instructions..."}
            {phase.type === "submitted" && "Job accepted, starting..."}
            {phase.type === "running" && "Applying changes in game..."}
            {phase.type === "completed" && "Job complete"}
            {phase.type === "error" && "Error"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {(phase.type === "submitting" || phase.type === "submitted") && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm">
                {phase.type === "submitting"
                  ? "Connecting to artifact manager..."
                  : "Waiting for game interaction to begin..."}
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
                {phase.completed} / {phase.total} artifacts processed
              </p>
            </div>
          )}

          {phase.type === "completed" && (
            <JobResultSummary result={phase.result} />
          )}

          {phase.type === "error" && (
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm">{phase.message}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {phase.type === "running" ? "Minimize" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobResultSummary({ result }: { result: ResultResponse }) {
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
          {hasProblems ? "Completed with issues" : "All changes applied"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {summary.success > 0 && (
          <SummaryRow label="Applied" count={summary.success} color="text-green-500" />
        )}
        {summary.already_correct > 0 && (
          <SummaryRow label="Already correct" count={summary.already_correct} color="text-muted-foreground" />
        )}
        {summary.not_found > 0 && (
          <SummaryRow label="Not found" count={summary.not_found} color="text-yellow-500" />
        )}
        {summary.errors > 0 && (
          <SummaryRow label="Errors" count={summary.errors} color="text-destructive" />
        )}
        {summary.aborted > 0 && (
          <SummaryRow label="Aborted" count={summary.aborted} color="text-muted-foreground" />
        )}
      </div>

      {result.results.some(
        (r) => r.detail && r.status !== "success" && r.status !== "already_correct",
      ) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Show details
          </summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {result.results
              .filter(
                (r) =>
                  r.detail &&
                  r.status !== "success" &&
                  r.status !== "already_correct",
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
