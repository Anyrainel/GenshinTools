import { act, renderHook } from "@testing-library/react";
import { useArtifactScoreComputation } from "@/hooks/useArtifactScoreComputation";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";

const gameStatReadiness = vi.hoisted(() => ({
  character: false,
  weapon: false,
}));
const scoreWithBuilds = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/data/gameStatsLoader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/gameStatsLoader")>();
  return {
    ...actual,
    characterStatsResource: {
      ...actual.characterStatsResource,
      use: () => (gameStatReadiness.character ? {} : null),
    },
    weaponStatsResource: {
      ...actual.weaponStatsResource,
      use: () => (gameStatReadiness.weapon ? {} : null),
    },
  };
});

vi.mock("@/lib/artifact/scoring/artifactScore", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/artifact/scoring/artifactScore")
    >();
  return { ...actual, scoreWithBuilds };
});

describe("useArtifactScoreComputation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gameStatReadiness.character = false;
    gameStatReadiness.weapon = false;
    scoreWithBuilds.mockClear();
    useAccountStore.getState().clearAccounts();
    useAccountScoreCacheStore.getState().clearAllScores();
    useBuildsStore.getState().clearAll();

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
        {
          characterId: "hu_tao",
          weapons: [],
          builds: [
            {
              id: "hu-tao-build",
              characterId: "hu_tao",
              visible: true,
              name: "Test",
              composition: "4pc",
              artifactSet: "crimson_witch_of_flames",
              substats: [{ stat: "cr", weight: 100 }],
              sandsWeights: [{ stat: "hp%", weight: 100 }],
              gobletWeights: [{ stat: "pyro%", weight: 100 }],
              circletWeights: [{ stat: "cr", weight: 100 }],
              normalizer: 1,
            },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("does not cache a partial score before both CR-budget resources are ready", () => {
    const { rerender } = renderHook(() => useArtifactScoreComputation());

    act(() => vi.advanceTimersByTime(100));
    expect(scoreWithBuilds).not.toHaveBeenCalled();

    gameStatReadiness.character = true;
    rerender();
    act(() => vi.advanceTimersByTime(100));
    expect(scoreWithBuilds).not.toHaveBeenCalled();

    gameStatReadiness.weapon = true;
    rerender();
    act(() => vi.advanceTimersByTime(50));

    expect(scoreWithBuilds).toHaveBeenCalledTimes(1);
  });
});
