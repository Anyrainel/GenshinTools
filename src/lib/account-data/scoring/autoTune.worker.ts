/**
 * Web Worker for autoTuneBuild — keeps the main thread free so the UI
 * spinner can animate while the heavy damage computation runs.
 */
import type { AutoTuneInput, AutoTuneOutput } from "./pipeline";
import { autoTuneBuild } from "./pipeline";

export type AutoTuneWorkerRequest = {
  id: number;
  input: AutoTuneInput;
};

export type AutoTuneWorkerResponse =
  | { id: number; result: AutoTuneOutput }
  | { id: number; error: string };

self.onmessage = (e: MessageEvent<AutoTuneWorkerRequest>) => {
  const { id, input } = e.data;
  try {
    const result = autoTuneBuild(input);
    self.postMessage({ id, result } satisfies AutoTuneWorkerResponse);
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies AutoTuneWorkerResponse);
  }
};
