import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContinuousInventorySync } from "@/hooks/useContinuousInventorySync";
import {
  ArtifactManagerError,
  type ContinuousSnapshot,
  fetchContinuous,
} from "@/providers/scanner/companion/client";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { useAccountStore } from "@/stores/useAccountStore";

vi.mock("@/providers/scanner/companion/client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/providers/scanner/companion/client")
  >()),
  fetchContinuous: vi.fn(),
}));
vi.mock("@/stores/applyAccountImport", () => ({ applyAccountImport: vi.fn() }));

const snapshot: ContinuousSnapshot = {
  sessionId: "server-1",
  revision: 1,
  updatedAt: 1793900000000,
  data: {
    format: "GOOD",
    version: 3,
    source: "GOODScanner",
    characters: [],
    weapons: [],
    artifacts: [],
  },
};
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
const tick = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useAccountStore.setState({
    activeAccountId: 123456789,
    accounts: {
      123456789: {
        id: 123456789,
        name: "First",
        lastUpdate: 0,
        data: { characters: [], extraWeapons: [], extraArtifacts: [] },
      },
      987654321: {
        id: 987654321,
        name: "Second",
        lastUpdate: 0,
        data: { characters: [], extraWeapons: [], extraArtifacts: [] },
      },
    },
  });
  vi.mocked(fetchContinuous).mockResolvedValue(snapshot);
});
afterEach(() => vi.useRealTimers());

describe("continuous inventory lifecycle", () => {
  it("rejects older revisions even after an unchanged newer snapshot", async () => {
    const view = renderHook(() => useContinuousInventorySync(true, 8765));
    await flush();
    act(() => view.result.current.confirm());
    await tick();
    vi.mocked(fetchContinuous).mockResolvedValue({ ...snapshot, revision: 5 });
    await tick();
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      revision: 3,
      data: { ...snapshot.data, achievements: [81006] },
    });
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("aborts an unfinished request on unmount and ignores its late response", async () => {
    let resolve!: (value: ContinuousSnapshot) => void;
    vi.mocked(fetchContinuous).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = renderHook(() => useContinuousInventorySync(true, 8765));
    const signal = vi.mocked(fetchContinuous).mock.calls[0][1]!;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolve(snapshot);
    });
    await tick();
    expect(applyAccountImport).not.toHaveBeenCalled();
    expect(fetchContinuous).toHaveBeenCalledTimes(1);
  });
  it("requires opt-in and confirmation, then skips repeated content even across revisions", async () => {
    const view = renderHook(
      ({ enabled }) => useContinuousInventorySync(enabled, 8765),
      { initialProps: { enabled: false } }
    );
    expect(fetchContinuous).not.toHaveBeenCalled();
    view.rerender({ enabled: true });
    await flush();
    expect(view.result.current.status).toBe("confirm");
    expect(applyAccountImport).not.toHaveBeenCalled();
    act(() => view.result.current.confirm());
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
    expect(view.result.current.updatedAt).toBe(snapshot.updatedAt);
    vi.mocked(fetchContinuous).mockResolvedValue({ ...snapshot, revision: 2 });
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      revision: 2,
      data: { ...snapshot.data, achievements: [81006] },
    });
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(2);
    expect(applyAccountImport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accountId: 123456789,
        earnedAchievementIds: [81006],
      })
    );
    view.unmount();
    await tick();
    expect(fetchContinuous).toHaveBeenCalledTimes(4);
  });

  it.each([
    [409, "continuous_capture_disabled", "disabled"],
    [503, "continuous_capture_no_data", "waiting"],
    [503, "continuous_capture_failed", "failed"],
    [404, "unknown endpoint", "unsupported"],
  ])(
    "distinguishes HTTP %s %s and retries",
    async (status, error, expected) => {
      vi.mocked(fetchContinuous).mockRejectedValue(
        new ArtifactManagerError(
          status,
          JSON.stringify({ error, details: "capture diagnostic" })
        )
      );
      const view = renderHook(() => useContinuousInventorySync(true, 9123));
      await flush();
      expect(view.result.current.status).toBe(expected);
      expect(view.result.current.details).toBe("capture diagnostic");
      expect(fetchContinuous).toHaveBeenCalledWith(
        9123,
        expect.any(AbortSignal)
      );
      vi.mocked(fetchContinuous).mockResolvedValue(snapshot);
      await tick();
      expect(view.result.current.status).toBe("confirm");
      expect(applyAccountImport).not.toHaveBeenCalled();
      view.unmount();
    }
  );

  it.each(["restart", "login", "network"])(
    "requires confirmation after %s",
    async (cause) => {
      const view = renderHook(() => useContinuousInventorySync(true, 8765));
      await flush();
      act(() => view.result.current.confirm());
      await tick();
      if (cause === "restart")
        vi.mocked(fetchContinuous).mockResolvedValue({
          ...snapshot,
          sessionId: "server-2",
          revision: 1,
        });
      else
        vi.mocked(fetchContinuous).mockRejectedValue(
          cause === "login"
            ? new ArtifactManagerError(
                503,
                '{"error":"continuous_capture_no_data"}'
              )
            : new TypeError("Failed to fetch")
        );
      await tick();
      if (cause !== "restart") {
        expect(view.result.current.status).toBe(
          cause === "login" ? "waiting" : "disconnected"
        );
        vi.mocked(fetchContinuous).mockResolvedValue(snapshot);
        await tick();
      }
      expect(view.result.current.status).toBe("confirm");
      expect(applyAccountImport).toHaveBeenCalledTimes(1);
      view.unmount();
    }
  );

  it("rejects late responses after disable, port changes, profile changes and unmount", async () => {
    let resolve!: (value: ContinuousSnapshot) => void;
    vi.mocked(fetchContinuous).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = renderHook(
      ({ enabled, port }) => useContinuousInventorySync(enabled, port),
      { initialProps: { enabled: true, port: 8765 } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    expect(fetchContinuous).toHaveBeenCalledTimes(1);
    const stale = resolve;
    view.rerender({ enabled: true, port: 9000 });
    await act(async () => {
      stale(snapshot);
    });
    expect(view.result.current.status).toBe("connecting");
    act(() => useAccountStore.getState().setActiveAccount(987654321));
    await act(async () => {
      resolve(snapshot);
    });
    expect(view.result.current.status).toBe("confirm");
    act(() => view.result.current.confirm());
    view.rerender({ enabled: false, port: 9000 });
    await flush();
    expect(view.result.current.status).toBe("off");
    await tick();
    expect(applyAccountImport).not.toHaveBeenCalled();
    view.unmount();
  });
});
