/**
 * Web Worker for auto-tune — handles a single team's computation
 * so multiple teams can run in parallel across workers.
 */
import { preloadGameStats } from "@/lib/gameStatsLoader";
import type { AutoTuneTeamInput, AutoTuneTeamResult } from "./pipeline";
import { autoTuneTeam } from "./pipeline";

export type AutoTuneWorkerRequest = {
  id: number;
  input: AutoTuneTeamInput;
};

export type AutoTuneWorkerResponse =
  | { id: number; result: AutoTuneTeamResult }
  | { id: number; error: string };

self.onmessage = async (e: MessageEvent<AutoTuneWorkerRequest>) => {
  const { id, input } = e.data;
  try {
    await preloadGameStats();
    const result = autoTuneTeam(input);
    self.postMessage({ id, result } satisfies AutoTuneWorkerResponse);
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies AutoTuneWorkerResponse);
  }
};
