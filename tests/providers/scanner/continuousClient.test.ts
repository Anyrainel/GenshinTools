import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArtifactManagerError,
  fetchContinuous,
} from "@/providers/scanner/companion/client";

const snapshot = {
  sessionId: "session",
  revision: 1,
  updatedAt: 1793900000000,
  data: { format: "GOOD", version: 3, artifacts: [] },
};
afterEach(() => vi.unstubAllGlobals());

describe("continuous scanner endpoint", () => {
  it("uses the manager address, disables caching and accepts inventory without achievements", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(snapshot)));
    vi.stubGlobal("fetch", request);
    expect(await fetchContinuous(9001)).toEqual(snapshot);
    expect(request).toHaveBeenCalledWith(
      "http://127.0.0.1:9001/continuous",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
  });
  it.each([
    null,
    { ...snapshot, revision: -1 },
    { ...snapshot, updatedAt: "yesterday" },
    { ...snapshot, data: { ...snapshot.data, format: "HSR-Scanner" } },
    { ...snapshot, data: { ...snapshot.data, artifacts: "invalid" } },
    { ...snapshot, data: { ...snapshot.data, metadata: { uid: 800000003 } } },
    { ...snapshot, data: { ...snapshot.data, metadata: { uid: "bad" } } },
    {
      ...snapshot,
      data: { ...snapshot.data, metadata: { uid: "800000003", nickname: 123 } },
    },
  ])("rejects malformed snapshots", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(response)))
    );
    await expect(fetchContinuous()).rejects.toThrow(
      "Invalid continuous inventory response"
    );
  });
  it("retains HTTP status and diagnostics", async () => {
    const body = JSON.stringify({
      error: "continuous_capture_failed",
      details: "Decoder initialization failed",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 503 }))
    );
    await expect(fetchContinuous()).rejects.toEqual(
      new ArtifactManagerError(503, body)
    );
  });
  it("passes caller cancellation through to fetch", async () => {
    const controller = new AbortController();
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(snapshot)));
    vi.stubGlobal("fetch", request);
    await fetchContinuous(8765, controller.signal);
    const signal = request.mock.calls[0][1].signal as AbortSignal;
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});
