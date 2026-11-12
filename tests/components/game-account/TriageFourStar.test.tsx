import { fireEvent, screen, within } from "@testing-library/react";
import type { ArtifactManagerJobConfig } from "@/components/shared/ArtifactManagerDialog";
import { DEFAULT_TRIAGE_SETTINGS } from "@/domain/game-account/triage/constants";
import type { ArtifactData } from "@/domain/models";
import { TriageView } from "@/pages/game-account/TriageView";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useTriageStore } from "@/stores/useTriageStore";
import { render } from "../../utils/render";

vi.mock("@/components/shared/ArtifactManagerDialog", () => ({
  ArtifactManagerDialog: ({
    open,
    job,
  }: {
    open: boolean;
    job: ArtifactManagerJobConfig;
  }) =>
    open ? (
      <output data-testid="manager-payload">
        {JSON.stringify(job.build())}
      </output>
    ) : null,
}));

function artifact(id: string, rarity: 4 | 5, lock: boolean): ArtifactData {
  return {
    id,
    setKey: rarity === 4 ? "instructor" : "emblem_of_severed_fate",
    slotKey: "flower",
    rarity,
    level: 0,
    lock,
    mainStatKey: "hp",
    substats: {},
  };
}

function openProtectedTab(name = /^Protected/): void {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("four-star artifacts in triage", () => {
  beforeEach(() => {
    localStorage.setItem("app_language", "en");
    useAccountStore.getState().clearAccounts();
    useAccountStore.getState().addOrUpdateAccount(0, {
      data: {
        characters: [],
        extraWeapons: [],
        extraArtifacts: [
          artifact("four-locked", 4, true),
          artifact("four-unlocked", 4, false),
          artifact("five-locked", 5, true),
        ],
      },
    });
    useBuildsStore.getState().clearAll();
    useBuildsStore.setState({
      enabledResolvedBuildGroups: [
        { characterId: "hu_tao", builds: [], weapons: [] },
      ],
    });
    useTriageStore.getState().setSettings({
      ...DEFAULT_TRIAGE_SETTINGS,
      highLevelProtection: false,
      equippedProtection: false,
      setSlotKeep: 0,
    });
  });

  afterEach(() => localStorage.removeItem("app_language"));

  it.each([
    {
      language: "en",
      protectedTab: /^Protected/,
      reason: "4-star artifacts are not evaluated for locking yet",
      fodder: "Fodder",
      inventory: "3 artifacts in inventory:",
    },
    {
      language: "zh",
      protectedTab: /^保护区不参与/,
      reason: "4星目前不参与锁定判断",
      fodder: "狗粮",
      inventory: "共 3 个圣遗物：",
    },
  ])(
    "shows both lock states in the protected zone in $language",
    ({ language, protectedTab, reason, fodder, inventory }) => {
      localStorage.setItem("app_language", language);
      render(<TriageView />);

      expect(screen.getByText(inventory)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: new RegExp(`1\\s*${fodder}`) })
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: protectedTab })).toHaveTextContent(
        "2"
      );
      openProtectedTab(protectedTab);
      expect(screen.getAllByText(reason)).toHaveLength(2);
      expect(
        within(screen.getByRole("tabpanel")).queryByText(fodder, {
          exact: true,
        })
      ).not.toBeInTheDocument();
    }
  );

  it("keeps unsupported rarity visible through quality/result filters and out of manager instructions", () => {
    render(<TriageView />);

    fireEvent.click(screen.getByRole("button", { name: /Apply to Game/i }));
    const payload = JSON.parse(
      screen.getByTestId("manager-payload").textContent!
    );
    expect(payload.lockIds).toEqual([]);
    expect(payload.unlockIds).toEqual(["five-locked"]);

    fireEvent.click(screen.getByRole("button", { name: /Fodder/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /filter by lock result/i })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Locked by flex rules" })
    );

    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "2"
    );
    openProtectedTab();
    expect(
      screen.getAllByText("4-star artifacts are not evaluated for locking yet")
    ).toHaveLength(2);
  });

  it("still applies inventory set and slot filters to protected four-star artifacts", () => {
    render(<TriageView />);
    openProtectedTab();

    fireEvent.click(
      screen.getByRole("button", { name: /filter by artifact set/i })
    );
    fireEvent.click(screen.getByRole("button", { name: "Instructor" }));
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "2"
    );
    fireEvent.click(screen.getByRole("button", { name: "Instructor" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Emblem of Severed Fate" })
    );
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "0"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Emblem of Severed Fate" })
    );
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "2"
    );

    fireEvent.click(screen.getByRole("button", { name: /filter by slot/i }));
    fireEvent.click(screen.getByRole("button", { name: /Plume/ }));
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "0"
    );
  });
});
