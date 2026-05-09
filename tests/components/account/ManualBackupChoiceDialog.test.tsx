import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ManualBackupAutomaticItem,
  ManualBackupChoice,
} from "@/cloud/manualBackupFlow";
import type { CloudPartitionId } from "@/cloud/types";
import { ManualBackupChoiceDialog } from "@/components/account/ManualBackupChoiceDialog";
import { render, screen } from "../../utils/render";

describe("ManualBackupChoiceDialog", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps automatic rows locked and selectable rows interactive", async () => {
    const user = userEvent.setup();
    const onToggleChoice = vi.fn();

    render(
      <ManualBackupChoiceDialog
        action={{
          direction: "upload",
          plan: {
            automaticItems: [
              automaticItem("profile.app/all", "profile.app", "upload-local"),
            ],
            choices: [
              choice("builds/all", "builds", "upload-overwrite-cloud"),
              choice("teams/all", "teams", "upload-delete-cloud"),
            ],
          },
        }}
        selectedChoiceIds={new Set<CloudPartitionId>(["builds/all"])}
        busy={false}
        onToggleChoice={onToggleChoice}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("No data conflict")).toBeInTheDocument();
    expect(screen.getByText("Data conflict")).toBeInTheDocument();
    expect(screen.getAllByText("Conflict info")).toHaveLength(2);
    expect(screen.queryByText("What will happen")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Included automatically")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Needs your choice")).not.toBeInTheDocument();
    expect(
      screen.getByText("Only this browser has this data.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Both this browser and the cloud backup changed since the last sync."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The cloud backup has data that this browser no longer has. Selecting it removes the cloud copy."
      )
    ).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[0]).toBeDisabled();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[1]).toBeEnabled();
    expect(checkboxes[2]).toBeChecked();
    expect(checkboxes[2]).toBeEnabled();

    await user.click(checkboxes[1]);
    expect(onToggleChoice).toHaveBeenCalledWith("teams/all", true);
  });

  it("confirms and cancels through the dialog actions", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ManualBackupChoiceDialog
        action={{
          direction: "download",
          plan: {
            automaticItems: [
              automaticItem(
                "profile.game/600000001",
                "profile.game",
                "download-cloud"
              ),
            ],
            choices: [
              choice("builds/all", "builds", "download-overwrite-local"),
            ],
          },
        }}
        selectedChoiceIds={new Set<CloudPartitionId>(["builds/all"])}
        busy={false}
        onToggleChoice={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables row choices and confirmation while busy", () => {
    render(
      <ManualBackupChoiceDialog
        action={{
          direction: "upload",
          plan: {
            automaticItems: [],
            choices: [choice("builds/all", "builds", "upload-overwrite-cloud")],
          },
        }}
        selectedChoiceIds={new Set<CloudPartitionId>(["builds/all"])}
        busy={true}
        onToggleChoice={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });
});

function automaticItem(
  id: CloudPartitionId,
  namespace: ManualBackupAutomaticItem["namespace"],
  kind: ManualBackupAutomaticItem["kind"]
): ManualBackupAutomaticItem {
  return {
    id,
    namespace,
    partitionKey: id.slice(id.indexOf("/") + 1),
    groupKey: `${namespace}:all`,
    reason: "local-only",
    kind,
    recordKinds:
      namespace === "profile.game"
        ? ["characters", "weapons"]
        : ["frozen", "settings"],
  };
}

function choice(
  id: CloudPartitionId,
  namespace: ManualBackupChoice["namespace"],
  kind: ManualBackupChoice["kind"]
): ManualBackupChoice {
  return {
    id,
    namespace,
    partitionKey: id.slice(id.indexOf("/") + 1),
    groupKey: `${namespace}:all`,
    reason: "both-changed",
    kind,
    recordKinds: namespace === "teams" ? ["teams", "teamConfigs"] : ["builds"],
  };
}
