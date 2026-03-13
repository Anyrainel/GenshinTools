import { RecommendationView } from "@/components/account-data/RecommendationView";
import type { SubStat } from "@/data/types";
import type {
  ArtifactScoreResult,
  StatScoreBreakdown,
} from "@/lib/account-data/artifactScore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";
import { render, screen } from "../../utils/render";

const mockScoreResult: ArtifactScoreResult = {
  substatScore: {
    subScore: 45,
    statCount: 0,
    slotSubScores: { flower: 0, plume: 0, sands: 0, goblet: 0, circlet: 0 },
    slotMaxSubScores: { flower: 0, plume: 0, sands: 0, goblet: 0, circlet: 0 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statScores: {} as Record<SubStat, StatScoreBreakdown>,
    isComplete: true,
  },
  buildMatch: null,
  normalized: null,
};

describe("RecommendationView", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccounts();
    useTierStore.getState().resetTierList();
  });

  it("returns null when no account data", () => {
    const { container } = render(<RecommendationView scores={{}} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders tier headings when account data exists", () => {
    // Set up account data
    useAccountStore.getState().addOrUpdateAccount("default", {
      data: {
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
      },
    });

    // Set up tier assignment
    useTierStore
      .getState()
      .setTierAssignments({ hu_tao: { tier: "S", position: 0 } });

    render(<RecommendationView scores={{ hu_tao: mockScoreResult }} />);

    // The new UI uses tab-based layout (Upgrade/Reroll/Farm tabs)
    // With no buildMatch, no recommendations are generated, so the "no recommendations" message shows
    expect(screen.getByText(/No recommendations|无推荐/)).toBeInTheDocument();
  });
});
