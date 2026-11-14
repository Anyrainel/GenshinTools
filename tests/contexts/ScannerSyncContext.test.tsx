import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ScannerSyncProvider,
  useScannerSync,
} from "@/contexts/ScannerSyncContext";
import {
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
function Controls() {
  const s = useScannerSync()!;
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={s.enabled}
        onClick={() => s.setEnabled(!s.enabled)}
      >
        Continuous sync
      </button>
      <input
        aria-label="Port"
        value={s.portInput}
        onChange={(e) => s.setPortInput(e.target.value)}
        onBlur={s.commitPort}
      />
    </>
  );
}
function Status() {
  const s = useScannerSync()!;
  return (
    <>
      <output>{s.enabled ? s.sync.status : "off"}</output>
      <span>{s.syncedAccount?.name}</span>
    </>
  );
}
function App({
  showImport = true,
  route = "inventory",
}: {
  showImport?: boolean;
  route?: string;
}) {
  return (
    <ScannerSyncProvider>
      <Status />
      <section key={route}>{showImport && <Controls />}</section>
    </ScannerSyncProvider>
  );
}
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
  useScannerSyncStore.setState({ enabled: false, port: 8765 });
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
        name: "Other",
        lastUpdate: 0,
        data: { characters: [], extraWeapons: [], extraArtifacts: [] },
      },
    },
  });
  vi.mocked(applyAccountImport).mockImplementation(
    ({ accountId, data, name }) => {
      useAccountStore.getState().addOrUpdateAccount(accountId, { data, name });
      return {};
    }
  );
  vi.mocked(fetchContinuous).mockResolvedValue(snapshot);
});
afterEach(() => vi.useRealTimers());
describe("global scanner preference", () => {
  it.each([false, true])(
    "starts in an empty workspace without an import (identified: %s)",
    async (identified) => {
      useAccountStore.setState({ activeAccountId: null, accounts: {} });
      if (identified)
        vi.mocked(fetchContinuous).mockResolvedValue({
          ...snapshot,
          data: { ...snapshot.data, metadata: { uid: "800000003" } },
        });
      const view = render(<App />);
      fireEvent.click(screen.getByRole("switch", { name: "Continuous sync" }));
      expect(fetchContinuous).toHaveBeenCalledWith(
        8765,
        expect.any(AbortSignal)
      );
      await flush();
      const accountId = identified ? 800000003 : 0;
      expect(useScannerSyncStore.getState().enabled).toBe(true);
      expect(Object.keys(useAccountStore.getState().accounts)).toEqual([
        String(accountId),
      ]);
      expect(applyAccountImport).toHaveBeenCalledWith(
        expect.objectContaining({ accountId })
      );
      expect(vi.mocked(applyAccountImport).mock.calls[0][0]).not.toHaveProperty(
        "promoteToId"
      );
      expect(screen.getByRole("status")).toHaveTextContent("synced");
      view.unmount();
    }
  );
  it("keeps polling across closed controls, routes, active profile changes and profile deletion", async () => {
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      data: { ...snapshot.data, metadata: { uid: "123456789" } },
    });
    const view = render(<App />);
    fireEvent.click(screen.getByRole("switch", { name: "Continuous sync" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("synced");
    const signal = vi.mocked(fetchContinuous).mock.calls[0][1]!;
    view.rerender(<App showImport={false} route="archive" />);
    act(() => {
      useAccountStore.getState().setActiveAccount(987654321);
      useAccountStore.getState().deleteAccount(123456789);
    });
    expect(useScannerSyncStore.getState().enabled).toBe(true);
    expect(signal.aborted).toBe(false);
    await tick();
    expect(fetchContinuous).toHaveBeenCalledTimes(2);
    expect(useAccountStore.getState().accounts[123456789]).toBeDefined();
    expect(useAccountStore.getState().activeAccountId).toBe(987654321);
    expect(useScannerSyncStore.getState().enabled).toBe(true);
    view.rerender(<App />);
    fireEvent.click(screen.getByRole("switch", { name: "Continuous sync" }));
    expect(signal.aborted).toBe(true);
    await tick();
    expect(screen.getByRole("status")).toHaveTextContent("off");
    expect(fetchContinuous).toHaveBeenCalledTimes(2);
    view.unmount();
  });
  it("restores global enablement and the custom port after the app remounts", async () => {
    const view = render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "Port" }), {
      target: { value: "9123" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Port" }));
    fireEvent.click(screen.getByRole("switch", { name: "Continuous sync" }));
    await flush();
    view.unmount();
    render(<App />);
    await flush();
    expect(useScannerSyncStore.getState().enabled).toBe(true);
    expect(fetchContinuous).toHaveBeenLastCalledWith(
      9123,
      expect.any(AbortSignal)
    );
    expect(screen.getByRole("status")).toHaveTextContent("synced");
  });
  it("aborts a pending request when globally stopped and ignores its late result", async () => {
    let resolve!: (value: ContinuousSnapshot) => void;
    vi.mocked(fetchContinuous).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = render(<App />);
    fireEvent.click(screen.getByRole("switch", { name: "Continuous sync" }));
    const signal = vi.mocked(fetchContinuous).mock.calls[0][1]!;
    view.rerender(<App showImport={false} />);
    expect(signal.aborted).toBe(false);
    view.rerender(<App />);
    fireEvent.click(screen.getByRole("switch", { name: "Continuous sync" }));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(snapshot));
    await tick();
    expect(applyAccountImport).not.toHaveBeenCalled();
  });
});
