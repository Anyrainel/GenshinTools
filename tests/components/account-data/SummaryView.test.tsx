import { SummaryView } from "@/components/account-data/SummaryView";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";
import { render, screen } from "../../utils/render";

const mockScoreResult: ArtifactScoreResult = {
  mainScore: 25,
  subScore: 45,
  slotMainScores: {},
  slotSubScores: {},
  slotMaxSubScores: {},
  statScores: {},
  isComplete: true,
};

describe("SummaryView", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccountData();
    useTierStore.getState().resetTierList();
  });

  it("returns null when no account data", () => {
    const { container } = render(<SummaryView scores={{}} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders tier headings when account data exists", () => {
    // Set up account data
    useAccountStore.getState().setAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          weapon: undefined,
          artifacts: {
            flower: {
              id: "1",
              setKey: "crimson_witch_of_flames",
              slotKey: "flower",
              level: 20,
              rarity: 5,
              lock: false,
              mainStatKey: "hp",
              substats: {},
            },
            plume: {
              id: "2",
              setKey: "crimson_witch_of_flames",
              slotKey: "plume",
              level: 20,
              rarity: 5,
              lock: false,
              mainStatKey: "atk",
              substats: {},
            },
            sands: {
              id: "3",
              setKey: "crimson_witch_of_flames",
              slotKey: "sands",
              level: 20,
              rarity: 5,
              lock: false,
              mainStatKey: "hp%",
              substats: {},
            },
            goblet: {
              id: "4",
              setKey: "crimson_witch_of_flames",
              slotKey: "goblet",
              level: 20,
              rarity: 5,
              lock: false,
              mainStatKey: "pyro%",
              substats: {},
            },
            circlet: {
              id: "5",
              setKey: "crimson_witch_of_flames",
              slotKey: "circlet",
              level: 20,
              rarity: 5,
              lock: false,
              mainStatKey: "cr",
              substats: {},
            },
          },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    });

    // Set up tier assignment
    useTierStore
      .getState()
      .setTierAssignments({ hu_tao: { tier: "S", position: 0 } });

    render(<SummaryView scores={{ hu_tao: mockScoreResult }} />);

    // Should show tier headings
    const headings = screen.getAllByRole("heading");
    expect(headings.length).toBeGreaterThan(0);
  });
});
