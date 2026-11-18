import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountManagerDialog } from "@/components/game-account/AccountManagerDialog";
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

function clickSettingsButton() {
  fireEvent.click(screen.getByRole("button", { name: "continuous.import" }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T00:00:00Z"));
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

describe("scanner sync controls", () => {
  it("shows sync settings only after opening Continuous Import in account management", async () => {
    const onClose = vi.fn();
    render(
      <ScannerSyncProvider>
        <AccountManagerDialog
          isOpen
          onClose={onClose}
          pendingImport={null}
          onOpenImportControl={vi.fn()}
          onResolveImport={vi.fn()}
        />
      </ScannerSyncProvider>
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "accountData.addProfile" })
    ).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "manager.port" })
    ).not.toBeInTheDocument();
    clickSettingsButton();
    const settings = screen.getByRole("dialog", { name: "continuous.import" });
    const toggle = within(settings).getByRole("switch", {
      name: "continuous.title",
    });
    expect(toggle).not.toBeChecked();
    expect(
      within(settings).getByRole("textbox", { name: "manager.port" })
    ).toHaveValue("8765");
    expect(within(settings).getByText("continuous.description")).toBeVisible();
    expect(fetchContinuous).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(fetchContinuous).toHaveBeenCalledWith(8765, expect.any(AbortSignal));
    await flush();
    expect(toggle).toBeChecked();
    expect(applyAccountImport).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 0 })
    );
    expect(onClose).not.toHaveBeenCalled();
    clickSettingsButton();
    expect(settings).not.toBeInTheDocument();
    expect(dialog).toBeVisible();
  });

  it("commits an edited port when starting without blurring the input", async () => {
    render(<App />);
    clickSettingsButton();
    const port = screen.getByRole("textbox", { name: "manager.port" });
    expect(port).toBeEnabled();
    expect(port).toHaveValue("8765");
    fireEvent.change(port, { target: { value: "9876" } });
    expect(fetchContinuous).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: "continuous.title" }));
    await flush();
    expect(fetchContinuous).toHaveBeenCalledWith(9876, expect.any(AbortSignal));
    expect(port).toBeDisabled();
  });

  it("keeps status informational and stops only through the settings toggle", async () => {
    const view = render(<App />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    clickSettingsButton();
    fireEvent.click(screen.getByRole("switch", { name: "continuous.title" }));
    clickSettingsButton();
    await flush();
    const bar = screen.getByRole("region", { name: "continuous.title" });
    expect(within(bar).getByRole("status")).toHaveTextContent(
      "Last sync: 0s ago"
    );
    expect(bar).toHaveTextContent("Port 8765");
    expect(within(bar).queryByRole("button")).not.toBeInTheDocument();
    expect(within(bar).queryByRole("switch")).not.toBeInTheDocument();
    expect(bar.firstElementChild).toHaveClass("justify-center", "flex-wrap");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page action" })).toBeEnabled();

    view.rerender(<App showImport={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchContinuous).toHaveBeenCalledTimes(2);
    view.rerender(<App />);
    clickSettingsButton();
    fireEvent.click(screen.getByRole("switch", { name: "continuous.title" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchContinuous).toHaveBeenCalledTimes(2);
    expect(applyAccountImport).toHaveBeenCalledTimes(1);
  });

  it("keeps fast requests visible, holds slow requests, and fades after each response", async () => {
    render(<App />);
    clickSettingsButton();
    fireEvent.click(screen.getByRole("switch", { name: "continuous.title" }));
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
    clickSettingsButton();
    fireEvent.click(screen.getByRole("switch", { name: "continuous.title" }));
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
    fireEvent.click(screen.getByRole("switch", { name: "continuous.title" }));
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
      clickSettingsButton();
      fireEvent.click(screen.getByRole("switch", { name: "continuous.title" }));
      await flush();
      const bar = screen.getByRole("region", { name: "continuous.title" });
      expect(bar).toHaveTextContent(String(key));
      expect(bar).not.toHaveTextContent("Last sync:");
      expect(bar).toHaveTextContent("Port 8765");
    }
  );
});
