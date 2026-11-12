import { fireEvent, screen, within } from "@testing-library/react";
import type { ArtifactManagerJobConfig } from "@/components/shared/ArtifactManagerDialog";
import { DEFAULT_TRIAGE_SETTINGS } from "@/domain/game-account/triage/constants";
import type { ArtifactData, Build } from "@/domain/models";
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

function artifact(
  id: string,
  rarity: 4 | 5,
  lock: boolean,
  overrides: Partial<ArtifactData> = {}
): ArtifactData {
  return {
    id,
    setKey: "emblem_of_severed_fate",
    slotKey: "flower",
    rarity,
    level: 0,
    lock,
    mainStatKey: "hp",
    substats: {},
    ...overrides,
  };
}

const instructorBuild: Build = {
  id: "instructor-build",
  characterId: "hu_tao",
  name: "Instructor",
  visible: true,
  composition: "4pc",
  artifactSet: "instructor",
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "atk%", weight: 100 },
  ],
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 1,
};

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
          artifact("native-four-to-lock", 4, false, {
            setKey: "instructor",
            substats: { cr: 3.11, cd: 6.22, "atk%": 4.66 },
            totalRolls: 3,
          }),
          artifact("native-four-to-unlock", 4, true, {
            setKey: "instructor",
            substats: { def: 13, atk: 11 },
            totalRolls: 2,
          }),
          artifact("variant-four-locked", 4, true),
          artifact("variant-four-unlocked", 4, false),
          artifact("five-locked", 5, true),
        ],
      },
    });
    useBuildsStore.getState().clearAll();
    useBuildsStore.setState({
      enabledResolvedBuildGroups: [
        { characterId: "hu_tao", builds: [instructorBuild], weapons: [] },
      ],
    });
    useTriageStore.getState().setSettings({
      ...DEFAULT_TRIAGE_SETTINGS,
      highLevelProtection: false,
      equippedProtection: false,
      setSlotKeep: 0,
      ownedOnly: false,
    });
  });

  afterEach(() => localStorage.removeItem("app_language"));

  it.each([
    {
      language: "en",
      protectedTab: /^Protected/,
      reason: "4-star variants of 5-star sets are excluded",
      fodder: "Fodder",
      inventory: "5 artifacts in inventory:",
    },
    {
      language: "zh",
      protectedTab: /^保护区不参与/,
      reason: "五星套装的四星版本不参与锁定判断",
      fodder: "狗粮",
      inventory: "共 5 个圣遗物：",
    },
  ])(
    "shows excluded four-star variants in the protected zone in $language",
    ({ language, protectedTab, reason, fodder, inventory }) => {
      localStorage.setItem("app_language", language);
      render(<TriageView />);

      expect(screen.getByText(inventory)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: new RegExp(`2\\s*${fodder}`) })
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

  it("sends native four-star decisions to the manager while leaving excluded variants untouched", () => {
    render(<TriageView />);

    fireEvent.click(screen.getByRole("button", { name: /Apply to Game/i }));
    const payload = JSON.parse(
      screen.getByTestId("manager-payload").textContent!
    );
    expect(payload.lockIds).toEqual(["native-four-to-lock"]);
    expect(new Set(payload.unlockIds)).toEqual(
      new Set(["native-four-to-unlock", "five-locked"])
    );
    expect(payload.request.lock).toHaveLength(1);
    expect(payload.request.lock[0]).toMatchObject({
      setKey: "Instructor",
      rarity: 4,
    });
    expect(payload.request.unlock).toHaveLength(2);
  });

  it("keeps excluded variants visible through quality and result filters", () => {
    render(<TriageView />);

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
      screen.getAllByText("4-star variants of 5-star sets are excluded")
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
      "0"
    );
    fireEvent.click(screen.getByRole("button", { name: "Instructor" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Emblem of Severed Fate" })
    );
    expect(screen.getByRole("tab", { name: /^Protected/ })).toHaveTextContent(
      "2"
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
