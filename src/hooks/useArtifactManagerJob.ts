import {
  ArtifactManagerError,
  fetchArtifacts,
  getResult,
  pollStatus,
  submitJob,
} from "@/lib/artifact-manager/client";
import {
  applyJobResults,
  replaceArtifactsFromSnapshot,
} from "@/lib/artifact-manager/storeSync";
import type { Instruction, ResultResponse } from "@/lib/artifact-manager/types";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useCallback, useEffect, useRef, useState } from "react";

export type JobPhase =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "submitted"; jobId: string }
  | { type: "running"; jobId: string; completed: number; total: number }
  | { type: "completed"; result: ResultResponse }
  | { type: "error"; message: string };

const POLL_INTERVAL = 1000;

export function useArtifactManagerJob(port = 8765) {
  const [phase, setPhase] = useState<JobPhase>({ type: "idle" });
  const instructionsRef = useRef<Instruction[]>([]);
  const mountedRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const status = await pollStatus(port);
        if (!mountedRef.current) return;

        if (status.state === "running") {
          setPhase({
            type: "running",
            jobId: status.jobId,
            completed: status.progress.completed,
            total: status.progress.total,
          });
        } else if (status.state === "completed") {
          stopPolling();
          const result = await getResult(port);
          if (!mountedRef.current) return;

          // Sync results to the account store
          const account = getActiveAccount(useAccountStore.getState());
          if (account) {
            let updated = applyJobResults(
              account.data,
              instructionsRef.current,
              result.results
            );

            // If no aborted items, the server did a full scan — fetch snapshot
            if (result.summary.aborted === 0) {
              try {
                const snapshot = await fetchArtifacts(port);
                if (snapshot && mountedRef.current) {
                  updated = replaceArtifactsFromSnapshot(updated, snapshot);
                }
              } catch {
                // Snapshot fetch failed — lock sync already applied above
              }
            }

            useAccountStore.getState().addOrUpdateAccount(account.id, {
              data: updated,
            });
          }

          setPhase({ type: "completed", result });
        } else if (status.state === "idle") {
          stopPolling();
          setPhase({
            type: "error",
            message: "Server returned idle during job execution",
          });
        }
      } catch {
        // Network error during polling — keep polling, server might recover
      }
    }, POLL_INTERVAL);
  }, [stopPolling]);

  const submit = useCallback(
    async (instructions: Instruction[]) => {
      if (instructions.length === 0) return;

      instructionsRef.current = instructions;
      setPhase({ type: "submitting" });

      try {
        const response = await submitJob(instructions, port);
        if (!mountedRef.current) return;
        setPhase({ type: "submitted", jobId: response.jobId });
        startPolling();
      } catch (e) {
        if (!mountedRef.current) return;
        const message =
          e instanceof ArtifactManagerError
            ? e.status === 409
              ? "Another job is already running"
              : e.status === 503
                ? "Artifact manager is paused"
                : `Server error: ${e.body}`
            : "Could not connect to artifact manager";
        setPhase({ type: "error", message });
      }
    },
    [startPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    instructionsRef.current = [];
    setPhase({ type: "idle" });
  }, [stopPolling]);

  return { phase, submit, reset };
}
