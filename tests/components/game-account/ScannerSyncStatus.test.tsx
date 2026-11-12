import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContinuousInventorySync } from "@/components/game-account/ContinuousInventorySync";
import { ScannerSyncStatus } from "@/components/game-account/ScannerSyncStatus";
import { ScannerSyncProvider } from "@/contexts/ScannerSyncContext";
import {
  ArtifactManagerError,
  type ContinuousSnapshot,
  fetchContinuous,
} from "@/providers/scanner/companion/client";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { useAccountStore } from "@/stores/useAccountStore";
import { useScannerSyncStore } from "@/stores/useScannerSyncStore";

vi.mock("@/contexts/LanguageContext", () => {
  const copy: Record<string, string> = {
    "continuous.port": "Port {0}",
    "continuous.lastSyncSeconds": "Last sync: {0}s ago",
    "continuous.lastSyncMinutes": "Last sync: {0}m ago",
  };
  return {
    useLanguage: () => ({ t: { ui: (key: string) => copy[key] ?? key } }),
  };
});
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

function App({ showImport = true }: { showImport?: boolean }) {
  return (
    <ScannerSyncProvider>
      <ScannerSyncStatus />
      {showImport && <ContinuousInventorySync />}
      <button type="button">Page action</button>
    </ScannerSyncProvider>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T00:00:00Z"));
  vi.clearAllMocks();
  useScannerSyncStore.setState({ enabledProfileId: null, port: 8765 });
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

describe("scanner sync controls", () => {
  it("commits an edited port when starting without blurring the input", async () => {
    render(<App />);
    const port = screen.getByRole("textbox", { name: "manager.port" });
    expect(port).toBeEnabled();
    fireEvent.change(port, { target: { value: "9876" } });
    expect(fetchContinuous).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "continuous.start" }));
    await flush();
    expect(fetchContinuous).toHaveBeenCalledWith(9876, expect.any(AbortSignal));
    expect(port).toBeDisabled();
  });

  it("shows a global status control without automatically opening a dialog, and stops directly", async () => {
    const view = render(<App />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "continuous.start" }));
    await flush();
    const bar = screen.getByRole("region", { name: "continuous.title" });
    expect(within(bar).getByRole("status")).toHaveTextContent(
      "Last sync: 0s ago"
    );
    expect(bar).toHaveTextContent("Port 8765");
    expect(within(bar).getAllByRole("button")).toHaveLength(1);
    expect(bar.firstElementChild).toHaveClass("justify-center", "flex-wrap");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page action" })).toBeEnabled();

    view.rerender(<App showImport={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "continuous.stop" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchContinuous).toHaveBeenCalledTimes(1);
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
  });

  it("keeps fast requests visible, holds slow requests, and fades after each response", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "continuous.start" }));
    await flush();
    const bar = screen.getByRole("region", { name: "continuous.title" });
    expect(bar).toHaveAttribute("data-requesting", "false");
    expect(bar).toHaveClass("bg-primary/25", "duration-0");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(bar).toHaveClass(
      "bg-primary/10",
      "duration-[1800ms]",
      "motion-reduce:transition-none"
    );
    let resolve!: (value: ContinuousSnapshot) => void;
    vi.mocked(fetchContinuous).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(bar).toHaveAttribute("data-requesting", "true");
    expect(bar).toHaveClass("bg-primary/25");
    await act(async () => resolve(snapshot));
    expect(bar).toHaveAttribute("data-requesting", "false");
    expect(bar).toHaveClass("bg-primary/25");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(bar).toHaveClass("bg-primary/10");
  });

  it("ticks seconds and minutes since the last successful receipt while showing failures", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "continuous.start" }));
    await flush();
    const bar = screen.getByRole("region", { name: "continuous.title" });
    vi.mocked(fetchContinuous).mockRejectedValue(
      new TypeError("Failed to fetch")
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(bar).toHaveTextContent("Last sync: 5s ago");
    expect(bar).toHaveTextContent("continuous.disconnected");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(55000);
    });
    expect(bar).toHaveTextContent("Last sync: 1m ago");
    fireEvent.click(
      within(bar).getByRole("button", { name: "continuous.stop" })
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it.each([
    [503, "continuous_capture_no_data", "continuous.waiting"],
    [409, "continuous_capture_disabled", "continuous.disabled"],
    [503, "continuous_capture_failed", "continuous.failed"],
  ])(
    "shows a meaningful state before the first success (%s %s)",
    async (status, error, key) => {
      vi.mocked(fetchContinuous).mockRejectedValue(
        new ArtifactManagerError(Number(status), JSON.stringify({ error }))
      );
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "continuous.start" }));
      await flush();
      const bar = screen.getByRole("region", { name: "continuous.title" });
      expect(bar).toHaveTextContent(String(key));
      expect(bar).not.toHaveTextContent("Last sync:");
      expect(bar).toHaveTextContent("Port 8765");
    }
  );
});
