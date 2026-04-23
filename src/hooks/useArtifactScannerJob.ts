import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IGOODArtifact,
  IGOODCharacter,
  IGOODWeapon,
} from "@/lib/account-data/import/goodConversion";
import {
  ArtifactManagerError,
  fetchArtifacts,
  fetchCharacters,
  fetchWeapons,
  getResult,
  pollStatus,
  submitScanJob,
} from "@/lib/account-data/manager/client";
import type {
  ScanProgress,
  ScanRequest,
  ScanSubmitResponse,
} from "@/lib/account-data/manager/types";

export type CategoryOutcome<T> =
  | { status: "success"; data: T[] }
  | { status: "aborted" }
  | { status: "error"; message: string };

export interface ScanOutcome {
  characters?: CategoryOutcome<IGOODCharacter>;
  weapons?: CategoryOutcome<IGOODWeapon>;
  artifacts?: CategoryOutcome<IGOODArtifact>;
}

export type ScanJobPhase =
  | { type: "idle" }
  | { type: "submitting"; targets: ScanRequest }
  | { type: "submitted"; jobId: string; targets: ScanRequest }
  | {
      type: "running";
      jobId: string;
      targets: ScanRequest;
      scanProgress: ScanProgress;
    }
  | { type: "fetching"; jobId: string; targets: ScanRequest }
  | {
      type: "completed";
      jobId: string;
      targets: ScanRequest;
      outcome: ScanOutcome;
    }
  | { type: "error"; message: string };

const POLL_INTERVAL = 1000;

export function useArtifactScannerJob(port = 8765) {
  const [phase, setPhase] = useState<ScanJobPhase>({ type: "idle" });
  const targetsRef = useRef<ScanRequest | null>(null);
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

  const fetchScanOutcome = useCallback(
    async (jobId: string, targets: ScanRequest): Promise<ScanOutcome> => {
      // /result tells us which categories succeeded vs aborted.
      // Only the categories the user requested appear in results.
      const resultStatuses: Partial<
        Record<"characters" | "weapons" | "artifacts", "success" | "aborted">
      > = {};
      let resultError: string | undefined;
      try {
        const result = await getResult(jobId, port);
        for (const entry of result.results) {
          if (
            entry.id === "characters" ||
            entry.id === "weapons" ||
            entry.id === "artifacts"
          ) {
            resultStatuses[entry.id] =
              entry.status === "success" ? "success" : "aborted";
          }
        }
      } catch (e) {
        resultError =
          e instanceof ArtifactManagerError
            ? `HTTP ${e.status}: ${e.body}`
            : "unreachable";
      }

      // Helper: resolve one category into a CategoryOutcome.
      const resolveCategory = async <T>(
        status: "success" | "aborted" | undefined,
        fetcher: () => Promise<T[] | null>
      ): Promise<CategoryOutcome<T>> => {
        if (status === "aborted") return { status: "aborted" };
        if (status === undefined) {
          // No /result entry — either /result failed or the server omitted it.
          if (resultError) {
            return {
              status: "error",
              message: `Could not read /result (${resultError})`,
            };
          }
          return { status: "aborted" };
        }
        try {
          const data = await fetcher();
          if (data === null) return { status: "aborted" };
          return { status: "success", data };
        } catch (e) {
          const msg =
            e instanceof ArtifactManagerError
              ? `HTTP ${e.status}: ${e.body}`
              : "Network error";
          return { status: "error", message: msg };
        }
      };

      const [characters, weapons, artifacts] = await Promise.all([
        targets.characters
          ? resolveCategory<IGOODCharacter>(resultStatuses.characters, () =>
              fetchCharacters(jobId, port)
            )
          : Promise.resolve(undefined),
        targets.weapons
          ? resolveCategory<IGOODWeapon>(resultStatuses.weapons, () =>
              fetchWeapons(jobId, port)
            )
          : Promise.resolve(undefined),
        targets.artifacts
          ? resolveCategory<IGOODArtifact>(resultStatuses.artifacts, () =>
              fetchArtifacts(port, jobId)
            )
          : Promise.resolve(undefined),
      ]);

      return {
        ...(characters && { characters }),
        ...(weapons && { weapons }),
        ...(artifacts && { artifacts }),
      };
    },
    [port]
  );

  const sawRunningRef = useRef(false);

  const pollOnce = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const status = await pollStatus(port);
      if (!mountedRef.current) return;

      const targets = targetsRef.current;
      if (status.state === "running") {
        sawRunningRef.current = true;
        if (!targets) {
          setPhase({ type: "error", message: "Lost job state" });
          return;
        }
        setPhase({
          type: "running",
          jobId: status.jobId,
          targets,
          scanProgress: status.scanProgress ?? {},
        });
      } else if (status.state === "completed") {
        stopPolling();
        const jobId = jobIdRef.current;
        if (!jobId || !targets) {
          setPhase({ type: "error", message: "Lost job state" });
          return;
        }

        setPhase({ type: "fetching", jobId, targets });

        const outcome = await fetchScanOutcome(jobId, targets);
        if (!mountedRef.current) return;
        setPhase({ type: "completed", jobId, targets, outcome });
      } else if (status.state === "idle") {
        // Server has a 1-second pre-start grace where state can still be idle.
        // Only treat as error once we've actually observed the job running.
        if (sawRunningRef.current) {
          stopPolling();
          setPhase({
            type: "error",
            message: "Server returned idle during job execution",
          });
        }
      }
    } catch {
      // Network error during polling — keep polling, server might recover
    }
  }, [port, stopPolling, fetchScanOutcome]);

  const startPolling = useCallback(() => {
    stopPolling();
    sawRunningRef.current = false;
    // Poll immediately so we pick up the first "running" state without waiting
    // a full interval (the submitted → running transition happens within ~1s).
    pollOnce();
    pollTimerRef.current = setInterval(pollOnce, POLL_INTERVAL);
  }, [stopPolling, pollOnce]);

  const submit = useCallback(
    async (targets: ScanRequest) => {
      if (!targets.characters && !targets.weapons && !targets.artifacts) {
        setPhase({ type: "error", message: "No scan targets selected" });
        return;
      }
      targetsRef.current = targets;
      jobIdRef.current = null;
      setPhase({ type: "submitting", targets });
      try {
        const response: ScanSubmitResponse = await submitScanJob(targets, port);
        if (!mountedRef.current) return;
        jobIdRef.current = response.jobId;
        setPhase({ type: "submitted", jobId: response.jobId, targets });
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
    targetsRef.current = null;
    jobIdRef.current = null;
    setPhase({ type: "idle" });
  }, [stopPolling]);

  return { phase, submit, reset };
}
