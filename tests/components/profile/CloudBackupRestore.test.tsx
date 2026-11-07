import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadManualBackupSelection,
  type PendingManualBackupAction,
  previewManualBackupAction,
  readCloudMetadataCache,
  refreshManualBackupMetadata,
} from "@/contexts/backup/manualBackupController";
import CloudBackupPage from "@/pages/profile/CloudBackupPage";
import type { CloudBackupMetadataSnapshot } from "@/services/backup/backupMetadata";
import { planManualBackupAction } from "@/services/backup/manualBackupFlow";
import { planCloudSync } from "@/services/backup/syncPlanner";
import { render } from "../../utils/render";

vi.mock("@/contexts/AppSessionContext", () => {
  const session = {
    isAuthenticated: true,
    isLoading: false,
    account: { id: "restore-user" },
    ensureSession: vi.fn(),
    signIn: vi.fn(),
  };
  return { useAppSession: () => session };
});

vi.mock("@/contexts/backup/manualBackupController", () => ({
  buildManualBackupMetadataRows: vi.fn(() => []),
  downloadManualBackupSelection: vi.fn(),
  isCloudMetadataCacheStale: vi.fn(() => false),
  previewManualBackupAction: vi.fn(),
  readCloudMetadataCache: vi.fn(),
  refreshManualBackupMetadata: vi.fn(),
  uploadManualBackupSelection: vi.fn(),
}));

describe("CloudBackupPage restore confirmation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    const metadata: CloudBackupMetadataSnapshot = {
      schemaVersion: 5,
      checkedAt: Date.now(),
      headSetRev: "head-set",
      quota: {
        period: "2026-11",
        limit: 10,
        used: 1,
        remaining: 9,
        resetsAt: Date.UTC(2026, 11, 1),
      },
      rows: [],
    };
    vi.mocked(readCloudMetadataCache).mockReturnValue(metadata);
    vi.mocked(refreshManualBackupMetadata).mockResolvedValue(metadata);
    vi.mocked(downloadManualBackupSelection).mockResolvedValue({
      appliedSections: ["builds"],
    });
  });

  it("requires both confirmations before replacing newer local data with the older cloud backup", async () => {
    const user = userEvent.setup();
    const pending = pendingDownload();
    vi.mocked(previewManualBackupAction).mockResolvedValue(pending);
    render(<CloudBackupPage />);

    await user.click(screen.getByRole("button", { name: "Download" }));
    const choices = await screen.findByRole("dialog", { name: "Download" });
    expect(within(choices).getByRole("checkbox")).not.toBeChecked();
    expect(
      within(choices).getByText(
        "This browser changed since the last sync; the cloud backup did not."
      )
    ).toBeInTheDocument();
    expect(downloadManualBackupSelection).not.toHaveBeenCalled();

    await user.click(within(choices).getByRole("checkbox"));
    await user.click(within(choices).getByRole("button", { name: "Download" }));

    const warning = await screen.findByRole("alertdialog", {
      name: "Replace local data?",
    });
    expect(warning).toHaveAccessibleDescription(
      "The selected data in this browser will be replaced by the cloud backup. Local changes since that backup will be lost. This cannot be undone."
    );
    expect(downloadManualBackupSelection).not.toHaveBeenCalled();

    await user.click(
      within(warning).getByRole("button", { name: "Replace and download" })
    );

    await waitFor(() => {
      expect(downloadManualBackupSelection).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        pending.syncResult,
        ["builds/all"]
      );
    });
  });

  it("cancels the first confirmation without downloading or retaining the selection", async () => {
    const user = userEvent.setup();
    vi.mocked(previewManualBackupAction).mockResolvedValue(pendingDownload());
    render(<CloudBackupPage />);

    await user.click(screen.getByRole("button", { name: "Download" }));
    const choices = await screen.findByRole("dialog", { name: "Download" });
    await user.click(within(choices).getByRole("checkbox"));
    await user.click(within(choices).getByRole("button", { name: "Cancel" }));

    expect(downloadManualBackupSelection).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download" }));
    const reopened = await screen.findByRole("dialog", { name: "Download" });
    expect(within(reopened).getByRole("checkbox")).not.toBeChecked();
    expect(downloadManualBackupSelection).not.toHaveBeenCalled();
  });

  it("cancels the final confirmation and requires both confirmations again", async () => {
    const user = userEvent.setup();
    vi.mocked(previewManualBackupAction).mockResolvedValue(pendingDownload());
    render(<CloudBackupPage />);

    await user.click(screen.getByRole("button", { name: "Download" }));
    const choices = await screen.findByRole("dialog", { name: "Download" });
    await user.click(within(choices).getByRole("checkbox"));
    await user.click(within(choices).getByRole("button", { name: "Download" }));
    const warning = await screen.findByRole("alertdialog", {
      name: "Replace local data?",
    });
    await user.click(within(warning).getByRole("button", { name: "Cancel" }));

    expect(downloadManualBackupSelection).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Download" }));
    const reopened = await screen.findByRole("dialog", { name: "Download" });
    expect(within(reopened).getByRole("checkbox")).not.toBeChecked();
    await user.click(within(reopened).getByRole("checkbox"));
    await user.click(
      within(reopened).getByRole("button", { name: "Download" })
    );
    expect(
      await screen.findByRole("alertdialog", { name: "Replace local data?" })
    ).toBeInTheDocument();
    expect(downloadManualBackupSelection).not.toHaveBeenCalled();
  });

  it("downloads only automatic categories when the newer local category is left unselected", async () => {
    const user = userEvent.setup();
    const pending = pendingDownload({ includeAutomatic: true });
    vi.mocked(previewManualBackupAction).mockResolvedValue(pending);
    render(<CloudBackupPage />);

    await user.click(screen.getByRole("button", { name: "Download" }));
    const choices = await screen.findByRole("dialog", { name: "Download" });
    const selectable = within(choices)
      .getAllByRole("checkbox")
      .find((checkbox) => !checkbox.hasAttribute("disabled"))!;
    expect(selectable).not.toBeChecked();
    await user.click(within(choices).getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(downloadManualBackupSelection).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        pending.syncResult,
        ["teams/all"]
      );
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps automatic downloads available without overwrite confirmations", async () => {
    const user = userEvent.setup();
    const pending = pendingDownload({
      includeLocal: false,
      includeAutomatic: true,
    });
    vi.mocked(previewManualBackupAction).mockResolvedValue(pending);
    render(<CloudBackupPage />);

    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(downloadManualBackupSelection).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        pending.syncResult,
        ["teams/all"]
      );
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

function pendingDownload({
  includeLocal = true,
  includeAutomatic = false,
}: {
  includeLocal?: boolean;
  includeAutomatic?: boolean;
} = {}): PendingManualBackupAction {
  const plan = planCloudSync({
    localPartitions: includeLocal
      ? [
          {
            namespace: "builds",
            partitionKey: "all",
            schemaVersion: 1,
            contentHash: "new-local-content",
            updatedAt: 1000,
          },
        ]
      : [],
    localMeta: includeLocal
      ? [
          {
            namespace: "builds",
            partitionKey: "all",
            lastSeenRev: "cloud-rev",
            lastAppliedHash: "old-cloud-content",
            updatedAt: 1000,
          },
        ]
      : [],
    remoteHeads: [
      ...(includeLocal
        ? [
            {
              namespace: "builds" as const,
              partitionKey: "all",
              rev: "cloud-rev",
              schemaVersion: 1,
              contentHash: "old-cloud-content",
              updatedAt: 100,
            },
          ]
        : []),
      ...(includeAutomatic
        ? [
            {
              namespace: "teams" as const,
              partitionKey: "all",
              rev: "team-rev",
              schemaVersion: 1,
              contentHash: "team-content",
              updatedAt: 100,
            },
          ]
        : []),
    ],
  });
  return {
    direction: "download",
    syncResult: {
      status: includeAutomatic ? "needs-download" : "synced",
      plan,
      remoteHeads: [],
      uploaded: [],
      headSetRev: "head-set",
    },
    plan: planManualBackupAction(plan, "download"),
  };
}
