import { afterEach, describe, expect, it, vi } from "vitest";
import { submitScanJob } from "@/lib/account-data/manager/client";
import {
  createRecentArtifactScanRequest,
  parseRecentArtifactLimit,
} from "@/lib/account-data/manager/scanRequest";

describe("recent artifact scan requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the manager /scan payload for recent artifacts", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          jobId: "job-1",
          targets: { artifacts: true },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitScanJob(createRecentArtifactScanRequest(60), 9876);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:9876/scan",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifacts: true,
          artifactMode: "recent",
          artifactLimit: 60,
        }),
      })
    );
  });

  it("validates recent artifact limits", () => {
    expect(parseRecentArtifactLimit("1")).toBe(1);
    expect(parseRecentArtifactLimit("60")).toBe(60);
    expect(parseRecentArtifactLimit("1000")).toBe(1000);
    expect(parseRecentArtifactLimit(" 12 ")).toBe(12);

    expect(parseRecentArtifactLimit("0")).toBeNull();
    expect(parseRecentArtifactLimit("1001")).toBeNull();
    expect(parseRecentArtifactLimit("1.5")).toBeNull();
    expect(parseRecentArtifactLimit("abc")).toBeNull();
    expect(parseRecentArtifactLimit("")).toBeNull();
  });

  it("rejects invalid recent artifact request limits", () => {
    expect(() => createRecentArtifactScanRequest(0)).toThrow(
      "Recent artifact scan limit"
    );
    expect(() => createRecentArtifactScanRequest(1001)).toThrow(
      "Recent artifact scan limit"
    );
    expect(() => createRecentArtifactScanRequest(1.5)).toThrow(
      "Recent artifact scan limit"
    );
  });
});
