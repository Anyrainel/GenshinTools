import {
  ArtifactManagerError,
  fetchArtifacts,
  getResult,
  pollStatus,
  submitEquipJob,
  submitJob,
} from "@/lib/artifact-manager/client";
import {
  applyEquipResults,
  applyJobResults,
  replaceArtifactsFromSnapshot,
} from "@/lib/artifact-manager/storeSync";
import type {
  EquipPayload,
  ManagePayload,
  ResultResponse,
  SubmitResponse,
} from "@/lib/artifact-manager/types";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useCallback, useEffect, useRef, useState } from "react";

export type JobPhase =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "submitted"; jobId: string }
  | { type: "running"; jobId: string; completed: number; total: number }
  | { type: "completed"; result: ResultResponse }
  | { type: "error"; message: string };

export type JobInput =
  | { type: "manage"; payload: ManagePayload }
  | { type: "equip"; payload: EquipPayload };

const POLL_INTERVAL = 1000;

export function useArtifactManagerJob(port = 8765) {
  const [phase, setPhase] = useState<JobPhase>({ type: "idle" });
  const jobInputRef = useRef<JobInput | null>(null);
  const jobIdRef = useRef<string | null>(null);
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

  const applyManageSync = useCallback(
    async (result: ResultResponse) => {
      const input = jobInputRef.current;
      if (input?.type !== "manage") return;

      const account = getActiveAccount(useAccountStore.getState());
      if (account) {
        const updated = applyJobResults(
          account.data,
          input.payload,
          result.results
        );
        useAccountStore.getState().addOrUpdateAccount(account.id, {
          data: updated,
        });
        console.log(
          "[manager] Applied lock sync:",
          result.results.length,
          "results"
        );
      }

      // Fetch and apply full artifact snapshot
      if (result.summary.aborted === 0) {
        try {
          const snapshot = await fetchArtifacts(port);
          if (snapshot && mountedRef.current) {
            console.log(
              "[manager] Snapshot fetched:",
              snapshot.length,
              "artifacts,",
              snapshot.filter((a) => a.lock).length,
              "locked"
            );
            const freshAccount = getActiveAccount(useAccountStore.getState());
            if (freshAccount) {
              const updated = replaceArtifactsFromSnapshot(
                freshAccount.data,
                snapshot
              );
              useAccountStore
                .getState()
                .addOrUpdateAccount(freshAccount.id, { data: updated });
              console.log(
                "[manager] Snapshot applied:",
                updated.extraArtifacts.length,
                "extra,",
                updated.characters.length,
                "characters"
              );
            }
          } else {
            console.log("[manager] No snapshot available");
          }
        } catch (e) {
          console.log("[manager] Snapshot fetch failed:", e);
        }
      }
    },
    [port]
  );

  const applyEquipSync = useCallback((result: ResultResponse) => {
    const input = jobInputRef.current;
    if (input?.type !== "equip") return;

    const account = getActiveAccount(useAccountStore.getState());
    if (account) {
      const updated = applyEquipResults(
        account.data,
        input.payload,
        result.results
      );
      useAccountStore.getState().addOrUpdateAccount(account.id, {
        data: updated,
      });
      console.log(
        "[manager] Applied equip sync:",
        result.results.filter((r) => r.status === "success").length,
        "equipped"
      );
    }
    // No snapshot fetch for equip jobs — the API doesn't produce one
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

          const jobId = jobIdRef.current;
          if (!jobId) {
            setPhase({ type: "error", message: "Lost job ID" });
            return;
          }

          const result = await getResult(jobId, port);
          if (!mountedRef.current) return;

          const input = jobInputRef.current;
          if (input?.type === "manage") {
            await applyManageSync(result);
          } else if (input?.type === "equip") {
            applyEquipSync(result);
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
  }, [stopPolling, port, applyManageSync, applyEquipSync]);

  const submit = useCallback(
    async (input: JobInput) => {
      jobInputRef.current = input;
      jobIdRef.current = null;
      setPhase({ type: "submitting" });

      try {
        let response: SubmitResponse;
        if (input.type === "manage") {
          const total =
            input.payload.request.lock.length +
            input.payload.request.unlock.length;
          if (total === 0) {
            setPhase({ type: "idle" });
            return;
          }
          response = await submitJob(input.payload.request, port);
        } else {
          if (input.payload.request.equip.length === 0) {
            setPhase({ type: "idle" });
            return;
          }
          response = await submitEquipJob(input.payload.request, port);
        }
        if (!mountedRef.current) return;
        jobIdRef.current = response.jobId;
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
    [startPolling, port]
  );

  const reset = useCallback(() => {
    stopPolling();
    jobInputRef.current = null;
    jobIdRef.current = null;
    setPhase({ type: "idle" });
  }, [stopPolling]);

  return { phase, submit, reset };
}
