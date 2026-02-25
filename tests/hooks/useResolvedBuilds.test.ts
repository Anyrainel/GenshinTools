import type { Build, BuildPayloadV5 } from "@/data/types";
import {
  useAllResolvedBuilds,
  useResolvedBuilds,
} from "@/hooks/useResolvedBuilds";
import {
  getCachedPreset,
  loadPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/artifact-builds/buildPresetRegistry", () => ({
  getCachedPreset: vi.fn(() => null),
  loadPreset: vi.fn(() => Promise.resolve(null)),
}));

const mockGetCachedPreset = vi.mocked(getCachedPreset);
const mockLoadPreset = vi.mocked(loadPreset);

function makeBuild(id: string, characterId: string, name: string): Build {
  return {
    id,
    characterId,
    name,
    visible: true,
    composition: "4pc",
    artifactSet: "gladiators_finale",
    sands: ["atk%"],
    goblet: ["pyro%"],
    circlet: ["cr"],
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
    ],
  };
}

function makePreset(
  buildIds: string[],
  characterBuilds: Record<string, string[]>,
  builds: Record<string, Build>
): BuildPayloadV5 {
  return {
    version: 5,
    author: "test",
    description: "test",
    builds: Object.fromEntries(buildIds.map((id) => [id, builds[id]!])),
    characterBuilds,
    characterWeapons: {},
    computeOptions: {},
  };
}

beforeEach(() => {
  useBuildsStore.getState().clearAll();
  vi.clearAllMocks();
  mockGetCachedPreset.mockReturnValue(null);
  mockLoadPreset.mockResolvedValue(null as unknown as BuildPayloadV5);
});

describe("useResolvedBuilds", () => {
  it("returns empty array when no preset and no local builds", () => {
    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));
    expect(result.current).toEqual([]);
  });

  it("returns local builds for character when no preset", () => {
    const state = useBuildsStore.getState();
    state.newBuild("hu_tao");

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));
    expect(result.current.length).toBe(1);
    expect(result.current[0]!.characterId).toBe("hu_tao");
    expect(result.current[0]!.source).toBe("custom");
  });

  it("returns preset builds when preset loaded and no local overrides", async () => {
    const b1 = makeBuild("preset-1", "hu_tao", "Preset Build");
    const preset = makePreset(
      ["preset-1"],
      { hu_tao: ["preset-1"] },
      { "preset-1": b1 }
    );
    mockGetCachedPreset.mockReturnValue(preset);
    mockLoadPreset.mockResolvedValue(preset);

    useBuildsStore.setState({
      activePresetId: "test-preset",
      characterToBuildIds: { hu_tao: ["preset-1"] },
    });

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(0);
    });
    expect(result.current[0]!.id).toBe("preset-1");
    expect(result.current[0]!.source).toBe("preset");
  });

  it("filters out presetDeletedBuildIds", async () => {
    const b1 = makeBuild("preset-1", "hu_tao", "Preset");
    const preset = makePreset(
      ["preset-1"],
      { hu_tao: ["preset-1"] },
      { "preset-1": b1 }
    );
    mockGetCachedPreset.mockReturnValue(preset);
    mockLoadPreset.mockResolvedValue(preset);

    useBuildsStore.setState({
      activePresetId: "test-preset",
      characterToBuildIds: { hu_tao: ["preset-1"] },
      presetDeletedBuildIds: ["preset-1"],
    });

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));

    await waitFor(() => {
      expect(mockLoadPreset).toHaveBeenCalled();
    });
    expect(result.current).toEqual([]);
  });
});

describe("useAllResolvedBuilds", () => {
  it("returns empty array when no characters", () => {
    const { result } = renderHook(() => useAllResolvedBuilds());
    expect(result.current).toEqual([]);
  });

  it("returns groups for characters with builds", async () => {
    const state = useBuildsStore.getState();
    state.newBuild("hu_tao");

    const { result } = renderHook(() => useAllResolvedBuilds());
    expect(result.current.length).toBe(1);
    expect(result.current[0]!.characterId).toBe("hu_tao");
    expect(result.current[0]!.builds.length).toBe(1);
  });

  it("skips hidden characters", async () => {
    const state = useBuildsStore.getState();
    state.newBuild("hu_tao");
    state.setCharacterHidden("hu_tao", true);

    const { result } = renderHook(() => useAllResolvedBuilds());
    expect(result.current).toEqual([]);
  });

  it("updates when hiddenCharacters toggled", async () => {
    const state = useBuildsStore.getState();
    state.newBuild("hu_tao");

    const { result, rerender } = renderHook(() => useAllResolvedBuilds());
    expect(result.current.length).toBe(1);

    act(() => {
      useBuildsStore.getState().setCharacterHidden("hu_tao", true);
    });
    rerender();
    await waitFor(() => {
      expect(result.current.length).toBe(0);
    });
  });
});
