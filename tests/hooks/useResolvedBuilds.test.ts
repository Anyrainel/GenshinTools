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
    sandsWeights: [{ stat: "atk%", weight: 100 }],
    gobletWeights: [{ stat: "pyro%", weight: 100 }],
    circletWeights: [{ stat: "cr", weight: 100 }],
    normalizer: 0,
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

  it("marks local override of preset build as 'modified'", async () => {
    const b1 = makeBuild("preset-1", "hu_tao", "Preset Original");
    const preset = makePreset(
      ["preset-1"],
      { hu_tao: ["preset-1"] },
      { "preset-1": b1 }
    );
    mockGetCachedPreset.mockReturnValue(preset);
    mockLoadPreset.mockResolvedValue(preset);

    // Set up store with preset and a local override
    useBuildsStore.setState({
      activePresetId: "test-preset",
      characterToBuildIds: { hu_tao: ["preset-1"] },
      builds: {
        "preset-1": { ...b1, name: "User Modified" },
      },
    });

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));

    await waitFor(() => {
      expect(result.current.length).toBe(1);
    });
    expect(result.current[0]!.source).toBe("modified");
    expect(result.current[0]!.name).toBe("User Modified");
  });

  it("falls back to preset version after revert (local override removed)", async () => {
    const b1 = makeBuild("preset-1", "hu_tao", "Preset Original");
    const preset = makePreset(
      ["preset-1"],
      { hu_tao: ["preset-1"] },
      { "preset-1": b1 }
    );
    mockGetCachedPreset.mockReturnValue(preset);
    mockLoadPreset.mockResolvedValue(preset);

    // Start with a modified build
    useBuildsStore.setState({
      activePresetId: "test-preset",
      characterToBuildIds: { hu_tao: ["preset-1"] },
      builds: {
        "preset-1": { ...b1, name: "User Modified" },
      },
    });

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));

    await waitFor(() => {
      expect(result.current.length).toBe(1);
      expect(result.current[0]!.source).toBe("modified");
    });

    // Simulate revert: remove local override, keep ordering
    act(() => {
      useBuildsStore.getState().revertBuild("hu_tao", "preset-1");
    });

    await waitFor(() => {
      expect(result.current[0]!.source).toBe("preset");
    });
    expect(result.current[0]!.name).toBe("Preset Original");
    expect(result.current.length).toBe(1);
  });

  it("preserves sibling builds after editing one preset build", async () => {
    const b1 = makeBuild("preset-1", "hu_tao", "Build 1");
    const b2 = makeBuild("preset-2", "hu_tao", "Build 2");
    const preset = makePreset(
      ["preset-1", "preset-2"],
      { hu_tao: ["preset-1", "preset-2"] },
      { "preset-1": b1, "preset-2": b2 }
    );
    mockGetCachedPreset.mockReturnValue(preset);
    mockLoadPreset.mockResolvedValue(preset);

    useBuildsStore.setState({
      activePresetId: "test-preset",
      characterToBuildIds: { hu_tao: ["preset-1", "preset-2"] },
    });

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));

    await waitFor(() => {
      expect(result.current.length).toBe(2);
    });

    // Edit only preset-1
    act(() => {
      useBuildsStore.getState().setBuild("preset-1", { name: "Modified" }, b1);
    });

    await waitFor(() => {
      expect(result.current.length).toBe(2);
    });
    expect(result.current[0]!.source).toBe("modified");
    expect(result.current[1]!.source).toBe("preset");
    expect(result.current[1]!.name).toBe("Build 2");
  });

  it("shows custom builds with source 'custom'", async () => {
    const b1 = makeBuild("preset-1", "hu_tao", "Preset");
    const preset = makePreset(
      ["preset-1"],
      { hu_tao: ["preset-1"] },
      { "preset-1": b1 }
    );
    mockGetCachedPreset.mockReturnValue(preset);
    mockLoadPreset.mockResolvedValue(preset);

    // Add a custom build alongside preset
    const customBuild = makeBuild("custom-1", "hu_tao", "My Custom Build");
    useBuildsStore.setState({
      activePresetId: "test-preset",
      characterToBuildIds: { hu_tao: ["preset-1", "custom-1"] },
      builds: { "custom-1": customBuild },
    });

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));

    await waitFor(() => {
      expect(result.current.length).toBe(2);
    });
    expect(result.current[0]!.source).toBe("preset");
    expect(result.current[1]!.source).toBe("custom");
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
