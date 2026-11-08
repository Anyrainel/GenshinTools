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
import { useScannerSyncStore } from "@/stores/useScannerSyncStore";

vi.mock("@/providers/scanner/companion/client", async (original) => ({
  ...(await original<typeof import("@/providers/scanner/companion/client")>()),
  fetchContinuous: vi.fn(),
}));
vi.mock("@/stores/applyAccountImport", () => ({ applyAccountImport: vi.fn() }));
const data = () => ({ characters: [], extraWeapons: [], extraArtifacts: [] });
const snapshot: ContinuousSnapshot = {
  sessionId: "server-1",
  revision: 1,
  updatedAt: 1793900000000,
  data: {
    format: "GOOD",
    version: 3,
    source: "GGScanner",
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
  useScannerSyncStore.setState({ enabledProfileId: null, port: 8765 });
  useAccountStore.setState({
    activeAccountId: 123456789,
    accounts: {
      123456789: { id: 123456789, name: "First", lastUpdate: 0, data: data() },
      987654321: { id: 987654321, name: "Second", lastUpdate: 0, data: data() },
    },
  });
  vi.mocked(applyAccountImport).mockImplementation(
    ({ accountId, data: incoming, name }) => {
      useAccountStore
        .getState()
        .addOrUpdateAccount(accountId, { data: incoming, name });
      return {};
    }
  );
  vi.mocked(fetchContinuous).mockResolvedValue(snapshot);
});
afterEach(() => vi.useRealTimers());
describe("hands-off continuous inventory", () => {
  it("requires opt-in once, applies immediately, and deduplicates unchanged data", async () => {
    const view = renderHook(
      ({ profile }) => useContinuousInventorySync(profile, 8765),
      { initialProps: { profile: null as number | null } }
    );
    expect(fetchContinuous).not.toHaveBeenCalled();
    view.rerender({ profile: 123456789 });
    await flush();
    expect(view.result.current.status).toBe("synced");
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
    vi.mocked(fetchContinuous).mockResolvedValue({ ...snapshot, revision: 2 });
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
    view.unmount();
  });
  it("keeps writing unknown captures to the enabled profile when the active profile changes", async () => {
    const view = renderHook(() => useContinuousInventorySync(123456789, 8765));
    await flush();
    act(() => useAccountStore.getState().setActiveAccount(987654321));
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      revision: 2,
      data: { ...snapshot.data, achievements: [81006] },
    });
    await tick();
    expect(applyAccountImport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accountId: 123456789,
        earnedAchievementIds: [81006],
      })
    );
    expect(view.result.current.routing).toBe("profile");
    view.unmount();
  });
  it("routes detected UIDs to existing or new profiles rather than the fallback", async () => {
    const view = renderHook(() => useContinuousInventorySync(123456789, 8765));
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      revision: 2,
      data: { ...snapshot.data, metadata: { uid: "987654321" } },
    });
    await flush();
    await tick();
    expect(applyAccountImport).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: 987654321 })
    );
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      revision: 3,
      data: {
        ...snapshot.data,
        metadata: { uid: "800000003", nickname: "New account" },
      },
    });
    await tick();
    expect(applyAccountImport).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: 800000003, name: "New account" })
    );
    expect(view.result.current.targetProfileId).toBe(800000003);
    view.unmount();
  });
  it("automatically binds the default when an identified UID has no matching profile", async () => {
    useAccountStore.setState({
      activeAccountId: 0,
      accounts: {
        0: { id: 0, name: "Default Account", data: data(), lastUpdate: 0 },
      },
    });
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      data: {
        ...snapshot.data,
        metadata: { uid: "800000003", nickname: "Player" },
      },
    });
    const view = renderHook(() => useContinuousInventorySync(0, 8765));
    await flush();
    expect(applyAccountImport).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 0,
        promoteToId: 800000003,
        name: "Player",
      })
    );
    view.unmount();
  });
  it("reapplies the current capture after a separate local import without another prompt", async () => {
    const view = renderHook(() => useContinuousInventorySync(123456789, 8765));
    await flush();
    act(() =>
      useAccountStore.getState().addOrUpdateAccount(123456789, { data: data() })
    );
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(2);
    expect(view.result.current.status).toBe("synced");
    view.unmount();
  });
  it("ignores old revisions after a newer unchanged snapshot", async () => {
    const view = renderHook(() => useContinuousInventorySync(123456789, 8765));
    await flush();
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
  it.each(["restart", "login", "network"])(
    "resumes automatically after %s",
    async (cause) => {
      const view = renderHook(() =>
        useContinuousInventorySync(123456789, 8765)
      );
      await flush();
      if (cause === "restart")
        vi.mocked(fetchContinuous).mockResolvedValue({
          ...snapshot,
          sessionId: "server-2",
          data: { ...snapshot.data, achievements: [81006] },
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
        vi.mocked(fetchContinuous).mockResolvedValue({
          ...snapshot,
          sessionId: "new-login",
          data: { ...snapshot.data, achievements: [81006] },
        });
        await tick();
      }
      expect(view.result.current.status).toBe("synced");
      expect(applyAccountImport).toHaveBeenCalledTimes(2);
      view.unmount();
    }
  );
  it.each([
    [409, "continuous_capture_disabled", "disabled"],
    [503, "continuous_capture_no_data", "waiting"],
    [503, "continuous_capture_failed", "failed"],
    [404, "unknown endpoint", "unsupported"],
  ] as const)(
    "shows HTTP %s %s and retries without approval",
    async (status, error, expected) => {
      vi.mocked(fetchContinuous).mockRejectedValue(
        new ArtifactManagerError(
          status,
          JSON.stringify({ error, details: "diagnostic" })
        )
      );
      const view = renderHook(() =>
        useContinuousInventorySync(123456789, 9123)
      );
      await flush();
      expect(view.result.current.status).toBe(expected);
      expect(view.result.current.details).toBe("diagnostic");
      vi.mocked(fetchContinuous).mockResolvedValue(snapshot);
      await tick();
      expect(view.result.current.status).toBe("synced");
      expect(applyAccountImport).toHaveBeenCalledTimes(1);
      view.unmount();
    }
  );
  it("aborts pending work on disable/port/target changes and ignores late responses", async () => {
    let resolve!: (value: ContinuousSnapshot) => void;
    vi.mocked(fetchContinuous).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = renderHook(
      ({ profile, port }) => useContinuousInventorySync(profile, port),
      { initialProps: { profile: 123456789 as number | null, port: 8765 } }
    );
    const signal = vi.mocked(fetchContinuous).mock.calls[0][1]!;
    view.rerender({ profile: null, port: 8765 });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(snapshot));
    expect(applyAccountImport).not.toHaveBeenCalled();
    view.rerender({ profile: 987654321, port: 9123 });
    await flush();
    expect(applyAccountImport).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: 987654321 })
    );
    expect(fetchContinuous).toHaveBeenLastCalledWith(
      9123,
      expect.any(AbortSignal)
    );
    view.unmount();
    await tick();
    expect(fetchContinuous).toHaveBeenCalledTimes(2);
  });
});
