import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContinuousInventorySync } from "@/components/game-account/ContinuousInventorySync";
import { ScannerSyncStatus } from "@/components/game-account/ScannerSyncStatus";
import { ScannerSyncProvider } from "@/contexts/ScannerSyncContext";
import {
  type ContinuousSnapshot,
  fetchContinuous,
} from "@/providers/scanner/companion/client";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { useAccountStore } from "@/stores/useAccountStore";
import { useScannerSyncStore } from "@/stores/useScannerSyncStore";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { ui: (key: string) => key } }),
}));
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
      "GGScanner · continuous.active"
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page action" })).toBeEnabled();

    view.rerender(<App showImport={false} />);
    fireEvent.click(
      within(bar).getByRole("button", { name: "continuous.details" })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "manager.close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "continuous.stop" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchContinuous).toHaveBeenCalledTimes(1);
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
  });

  it("keeps details opt-in and closes them when sync is switched off", async () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "continuous.start" }));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    view.rerender(<App showImport={false} />);
    fireEvent.click(screen.getByRole("button", { name: "continuous.details" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "continuous.stop",
      })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    view.rerender(<App />);
    fireEvent.click(screen.getByRole("button", { name: "continuous.start" }));
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
