import type { BuildPayloadV5 } from "@/data/types";
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
