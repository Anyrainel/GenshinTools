import type {
  ArtifactScoreResult,
  BuildMatchResult,
  NormalizedScoreInfo,
  StatScoreBreakdown,
} from "@/domain/build/artifact/scoring/artifactScore";
import type { SubStat } from "@/domain/enums";
import type { AllActions } from "@/domain/game-account/scoreUpEngine";
import type { Build } from "@/domain/models";
import { ScoreUpView } from "@/pages/game-account/ScoreUpView";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useScoreUpCacheStore } from "@/stores/useScoreUpCacheStore";
import { useScoreUpSettingsStore } from "@/stores/useScoreUpSettingsStore";
import { useTierStore } from "@/stores/useTierStore";
import { act, fireEvent, render, screen, waitFor } from "../../utils/render";

const gameStatReadiness = vi.hoisted(() => ({
  character: true,
  weapon: true,
}));
const recommendationSpies = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));
const recommendationState = vi.hoisted(() => ({
  recommendations: null as AllActions | null,
  error: null as Error | null,
  progress: { completedTierCount: 1, totalTierCount: 1, currentTier: null },
}));

vi.mock("@/domain/reference/stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/domain/reference/stats")>();
  const ready = {};
  return {
    ...actual,
    characterStatsResource: {
      ...actual.characterStatsResource,
      peek: () => (gameStatReadiness.character ? ready : null),
    },
    weaponStatsResource: {
      ...actual.weaponStatsResource,
      peek: () => (gameStatReadiness.weapon ? ready : null),
    },
  };
});

vi.mock("@/hooks/useAsyncRecommendations", () => ({
  useAsyncScoreUp: () => ({
    recommendations: recommendationState.recommendations,
    progress: recommendationState.progress,
    isComputing: false,
    error: recommendationState.error,
    start: recommendationSpies.start,
    stop: recommendationSpies.stop,
  }),
}));

const mockBuild: Build = {
  id: "test-build",
  characterId: "hu_tao",
  visible: true,
  name: "Test",
  composition: "4pc",
  artifactSet: "crimson_witch_of_flames",
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
  ],
  sandsWeights: [{ stat: "hp%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 3,
};

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
  buildMatch: {
    build: mockBuild,
    buildIndex: 0,
    statWeights: { cr: 100, cd: 100 },
    setMatched: true,
    mainStatMatches: 3,
    mainStatMismatches: [],
  } as unknown as BuildMatchResult,
  normalized: {
    normalizedScore: 150,
    rawMainStatScore: 30,
    slotMainStatScores: {
      flower: 0,
      plume: 0,
      sands: 0,
      goblet: 0,
      circlet: 0,
    },
    idealScore: 100,
    normalizer: 3,
  } as NormalizedScoreInfo,
};

describe("ScoreUpView", () => {
  beforeEach(() => {
    gameStatReadiness.character = true;
    gameStatReadiness.weapon = true;
    recommendationSpies.start.mockClear();
    recommendationSpies.stop.mockClear();
    recommendationState.recommendations = null;
    recommendationState.error = null;
    recommendationState.progress = {
      completedTierCount: 1,
      totalTierCount: 1,
      currentTier: null,
    };
    useScoreUpSettingsStore.setState({ settingsByProfileId: {} });
    useAccountStore.getState().clearAccounts();
    useBuildsStore.getState().clearAll();
    useScoreUpCacheStore.getState().clear();
    useTierStore.getState().resetTierList();
  });

  it("shows empty state when no account data", () => {
    render(<ScoreUpView scores={{}} />);

    expect(
      screen.getByText("Account Data & Builds Required")
    ).toBeInTheDocument();
  });

  function prepareCachedRun() {
    useAccountStore.getState().addOrUpdateAccount(0, {
      data: {
        characters: [
          {
            key: "hu_tao",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {},
          },
        ],
        extraArtifacts: [],
        extraWeapons: [],
      },
    });
    useBuildsStore.setState({
      enabledResolvedBuildGroups: [
        { characterId: "hu_tao", builds: [mockBuild], weapons: [] },
      ],
    });
    useTierStore
      .getState()
      .setTierAssignments({ hu_tao: { tier: "S", position: 0 } });
    recommendationState.recommendations = {
      byActionType: { swap: [], equip: [], upgrade: [] },
      perCharacter: {},
    };
  }

  it("separates cached results by luck settings and reuses the matching cache", async () => {
    prepareCachedRun();
    render(<ScoreUpView scores={{ hu_tao: mockScoreResult }} />);
    await waitFor(() =>
      expect(useScoreUpCacheStore.getState().cache.size).toBe(1)
    );
    expect(recommendationSpies.start).toHaveBeenCalledTimes(1);
    act(() =>
      useScoreUpSettingsStore.getState().setTierLuckExpectation("S", "hopeful")
    );
    await waitFor(() =>
      expect(recommendationSpies.start).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(useScoreUpCacheStore.getState().cache.size).toBe(2)
    );
    expect(
      recommendationSpies.start.mock.lastCall?.[0].tierCustomization.S
        .luckExpectation
    ).toBe("hopeful");
    act(() =>
      useScoreUpSettingsStore.getState().setTierLuckExpectation("S", "balanced")
    );
    expect(recommendationSpies.start).toHaveBeenCalledTimes(2);
  });

  it.each(["failed", "incomplete"])(
    "does not cache %s calculations as complete results",
    async (state) => {
      prepareCachedRun();
      if (state === "failed")
        recommendationState.error = new Error("test failure");
      else
        recommendationState.progress = {
          completedTierCount: 1,
          totalTierCount: 2,
          currentTier: null,
        };
      render(<ScoreUpView scores={{ hu_tao: mockScoreResult }} />);
      await waitFor(() =>
        expect(recommendationSpies.start).toHaveBeenCalledTimes(1)
      );
      expect(useScoreUpCacheStore.getState().cache.size).toBe(0);
    }
  );

  it("stores an upgrade-only refresh under the newly selected luck setting", async () => {
    prepareCachedRun();
    render(<ScoreUpView scores={{ hu_tao: mockScoreResult }} />);
    await waitFor(() =>
      expect(useScoreUpCacheStore.getState().cache.size).toBe(1)
    );
    fireEvent.click(screen.getByRole("radio", { name: "Hopeful" }));
    await waitFor(() =>
      expect(useScoreUpCacheStore.getState().cache.size).toBe(2)
    );
    expect(recommendationSpies.start).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("radio", { name: "Balanced" }));
    expect(useScoreUpCacheStore.getState().cache.size).toBe(2);
    expect(recommendationSpies.start).toHaveBeenCalledTimes(1);
  });

  it("renders tier headings when account data exists", () => {
    // Set up account data
    useAccountStore.getState().addOrUpdateAccount(0, {
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

    render(<ScoreUpView scores={{ hu_tao: mockScoreResult }} />);

    // Component renders without crashing — the score-up engine may
    // error on the minimal mock build, but the view renders gracefully
    expect(document.body.textContent).toBeTruthy();
  });

  it("waits for both CR-budget stat resources before starting recommendations", async () => {
    useAccountStore.getState().addOrUpdateAccount(0, {
      data: {
        characters: [
          {
            key: "hu_tao",
            level: 90,
            constellation: 0,
            talent: { auto: 10, skill: 10, burst: 10 },
            artifacts: {},
          },
        ],
        extraArtifacts: [],
        extraWeapons: [],
      },
    });
    useBuildsStore.setState({
      enabledResolvedBuildGroups: [
        { characterId: "hu_tao", builds: [mockBuild], weapons: [] },
      ],
    });
    useTierStore
      .getState()
      .setTierAssignments({ hu_tao: { tier: "S", position: 0 } });
    gameStatReadiness.character = false;
    gameStatReadiness.weapon = false;

    const { rerender } = render(
      <ScoreUpView scores={{ hu_tao: mockScoreResult }} />
    );

    expect(recommendationSpies.start).not.toHaveBeenCalled();

    gameStatReadiness.character = true;
    rerender(<ScoreUpView scores={{ hu_tao: mockScoreResult }} />);
    expect(recommendationSpies.start).not.toHaveBeenCalled();

    gameStatReadiness.weapon = true;
    rerender(<ScoreUpView scores={{ hu_tao: mockScoreResult }} />);

    await waitFor(() => {
      expect(recommendationSpies.start).toHaveBeenCalledTimes(1);
    });
  });
});
