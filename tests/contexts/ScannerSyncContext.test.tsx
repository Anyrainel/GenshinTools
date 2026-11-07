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
    source: "GGScanner",
    characters: [],
    weapons: [],
    artifacts: [],
  },
};

function ImportControls() {
  const session = useScannerSync();
  if (!session) throw new Error("Missing scanner sync provider");
  return (
    <>
      <button type="button" onClick={() => session.setEnabled(true)}>
        Enable
      </button>
      <button type="button" onClick={session.sync.confirm}>
        Approve
      </button>
      <input
        aria-label="Port"
        value={session.portInput}
        onChange={(event) => session.setPortInput(event.target.value)}
        onBlur={session.commitPort}
      />
    </>
  );
}

function GlobalStatus() {
  const session = useScannerSync();
  if (!session) throw new Error("Missing scanner sync provider");
  return (
    <>
      <output>{session.enabled ? session.sync.status : "off"}</output>
      <button type="button" onClick={() => session.setEnabled(false)}>
        Turn off
      </button>
    </>
  );
}

function App({
  showImport,
  route = "inventory",
}: {
  showImport: boolean;
  route?: string;
}) {
  return (
    <ScannerSyncProvider>
      <GlobalStatus />
      <section key={route}>{showImport && <ImportControls />}</section>
    </ScannerSyncProvider>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
}

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
    },
  });
  vi.mocked(fetchContinuous).mockResolvedValue(snapshot);
});

afterEach(() => vi.useRealTimers());

describe("app-scoped scanner sync", () => {
  it("keeps pending approval and active polling across closed imports and route changes", async () => {
    const view = render(<App showImport />);
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("confirm");

    view.rerender(<App showImport={false} route="archive" />);
    await tick();
    expect(screen.getByRole("status")).toHaveTextContent("confirm");
    expect(applyAccountImport).not.toHaveBeenCalled();

    view.rerender(<App showImport route="archive" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("synced");

    view.rerender(<App showImport={false} route="builds" />);
    vi.mocked(fetchContinuous).mockResolvedValue({
      ...snapshot,
      revision: 2,
      data: { ...snapshot.data, achievements: [81006] },
    });
    await tick();
    expect(applyAccountImport).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("synced");

    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    const polls = vi.mocked(fetchContinuous).mock.calls.length;
    await tick();
    expect(fetchContinuous).toHaveBeenCalledTimes(polls);
    expect(screen.getByRole("status")).toHaveTextContent("off");
  });

  it("aborts a pending request when the global stop control is used and ignores its late response", async () => {
    let resolve!: (value: ContinuousSnapshot) => void;
    vi.mocked(fetchContinuous).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = render(<App showImport />);
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    const signal = vi.mocked(fetchContinuous).mock.calls[0][1]!;
    view.rerender(<App showImport={false} route="builds" />);
    expect(signal.aborted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(snapshot));
    await tick();
    expect(fetchContinuous).toHaveBeenCalledTimes(1);
    expect(applyAccountImport).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("off");
  });

  it("uses a custom port across reopened controls and starts a fresh app session disabled", async () => {
    const view = render(<App showImport />);
    const port = screen.getByRole("textbox", { name: "Port" });
    fireEvent.change(port, { target: { value: "9123" } });
    fireEvent.blur(port);
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    await flush();
    expect(fetchContinuous).toHaveBeenCalledWith(9123, expect.any(AbortSignal));

    view.rerender(<App showImport={false} />);
    view.rerender(<App showImport />);
    expect(screen.getByRole("textbox", { name: "Port" })).toHaveValue("9123");
    view.unmount();
    render(<App showImport />);
    expect(screen.getByRole("status")).toHaveTextContent("off");
    expect(screen.getByRole("textbox", { name: "Port" })).toHaveValue("8765");
    await tick();
    expect(fetchContinuous).toHaveBeenCalledTimes(1);
  });
});
