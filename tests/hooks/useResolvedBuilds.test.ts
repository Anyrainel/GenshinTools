import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildPayloadV5 } from "@/data/types";
import { useHydrateBuildPreset } from "@/hooks/useHydrateBuildPreset";
import {
  useAllResolvedBuilds,
  useResolvedBuilds,
} from "@/hooks/useResolvedBuilds";
import {
  getCachedBuildPreset,
  loadBuildPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";

const presetCache = vi.hoisted(() => new Map<string, BuildPayloadV5>());

vi.mock("@/lib/artifact-builds/buildPresetRegistry", () => ({
  cacheBuildPreset: vi.fn((id: string, payload: BuildPayloadV5) => {
    presetCache.set(id, payload);
    if (payload.id) presetCache.set(payload.id, payload);
  }),
  getCachedBuildPreset: vi.fn((id: string | null) =>
    id ? (presetCache.get(id) ?? null) : null
  ),
  loadBuildPreset: vi.fn((id: string) =>
    Promise.resolve(presetCache.get(id) ?? null)
  ),
}));

const mockGetCachedBuildPreset = vi.mocked(getCachedBuildPreset);
const mockLoadBuildPreset = vi.mocked(loadBuildPreset);

beforeEach(() => {
  useBuildsStore.getState().clearAll();
  presetCache.clear();
  vi.clearAllMocks();
});

describe("useResolvedBuilds", () => {
  it("returns empty array when no preset and no local builds", () => {
    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));
    expect(result.current).toEqual([]);
  });

  it("hydrates the active preset through the app-level hook", async () => {
    const p1 = {
      id: "p-1",
      characterId: "hu_tao",
      name: "Preset 1",
      visible: true,
      composition: "4pc" as const,
      substats: [],
      sandsWeights: [],
      gobletWeights: [],
      circletWeights: [],
      normalizer: 0,
    };
    const preset: BuildPayloadV5 = {
      version: 5,
      id: "preset",
      author: "",
      description: "",
      builds: { "p-1": p1 },
      characterBuilds: { hu_tao: ["p-1"] },
      characterWeapons: {},
    };
    mockLoadBuildPreset.mockResolvedValueOnce(preset);

    act(() => {
      useBuildsStore.getState().setActivePreset("preset");
    });
    renderHook(() => useHydrateBuildPreset());

    await waitFor(() => {
      expect(useBuildsStore.getState().getBuildIds("hu_tao")).toEqual(["p-1"]);
    });
    expect(mockLoadBuildPreset).toHaveBeenCalledWith("preset");
  });

  it("returns local builds for character when no preset", () => {
    const state = useBuildsStore.getState();
    state.newBuild("hu_tao");

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));
    expect(result.current.length).toBe(1);
    expect(result.current[0]!.characterId).toBe("hu_tao");
    expect(result.current[0]!.source).toBe("custom");
  });

  it("appends preset builds added after subscription", () => {
    const p1 = {
      id: "p-1",
      characterId: "hu_tao",
      name: "Preset 1",
      visible: true,
      composition: "4pc" as const,
      substats: [],
      sandsWeights: [],
      gobletWeights: [],
      circletWeights: [],
      normalizer: 0,
    };
    const p2 = { ...p1, id: "p-2", name: "Preset 2" };
    const p3 = { ...p1, id: "p-3", name: "Preset 3" };
    const originalPreset: BuildPayloadV5 = {
      version: 5,
      id: "preset",
      author: "",
      description: "",
      builds: { "p-1": p1, "p-2": p2 },
      characterBuilds: { hu_tao: ["p-1", "p-2"] },
      characterWeapons: {},
    };
    const updatedPreset: BuildPayloadV5 = {
      ...originalPreset,
      builds: { ...originalPreset.builds, "p-3": p3 },
      characterBuilds: { hu_tao: ["p-1", "p-2", "p-3"] },
    };

    useBuildsStore.getState().subscribePreset("preset", originalPreset);
    presetCache.set("preset", updatedPreset);
    useBuildsStore.getState().hydratePreset("preset", updatedPreset);

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));

    expect(result.current.map((build) => build.id)).toEqual([
      "p-1",
      "p-2",
      "p-3",
    ]);
    expect(mockGetCachedBuildPreset).toHaveBeenCalled();
    expect(mockLoadBuildPreset).not.toHaveBeenCalled();
  });
});

describe("useResolvedBuilds reference stability", () => {
  it("preserves build reference when an unrelated character is edited", () => {
    const state = useBuildsStore.getState();
    state.newBuild("hu_tao");
    state.newBuild("xiangling");

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));
    const before = result.current[0];
    expect(before).toBeDefined();

    // Edit xiangling's build — should NOT affect hu_tao's references
    act(() => {
      const s = useBuildsStore.getState();
      const xlBuildId = s.characterToBuildIds.xiangling[0];
      s.setBuild(xlBuildId, { name: "New XL Build" }, s.builds[xlBuildId]);
    });

    const after = result.current[0];
    expect(after).toBeDefined();
    // hu_tao's build object should be the exact same reference
    expect(after).toBe(before);
  });

  it("returns new reference when the character's own build is edited", () => {
    const state = useBuildsStore.getState();
    state.newBuild("hu_tao");

    const { result } = renderHook(() => useResolvedBuilds("hu_tao"));
    const before = result.current[0];

    act(() => {
      const s = useBuildsStore.getState();
      const buildId = s.characterToBuildIds.hu_tao[0];
      s.setBuild(buildId, { name: "Updated" }, s.builds[buildId]);
    });

    const after = result.current[0];
    expect(after).toBeDefined();
    expect(after!.name).toBe("Updated");
    // Reference should have changed
    expect(after).not.toBe(before);
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
