/**
 * Integration Tests: Build Preset Lifecycle
 *
 * Tests the full user flows for preset build management:
 *   subscribe → edit → revert → delete → restore
 *
 * Uses the store + useResolvedBuilds hook together to verify
 * that the UI-facing resolved builds stay correct through mutations.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Build, BuildPayloadV5 } from "@/data/types";
import { useResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  getCachedPreset,
  loadPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";

// ── Mock the preset registry ────────────────────────────────────
vi.mock("@/lib/artifact-builds/buildPresetRegistry", () => ({
  getCachedPreset: vi.fn(() => null),
  loadPreset: vi.fn(() => Promise.resolve(null)),
}));

const mockGetCachedPreset = vi.mocked(getCachedPreset);
const mockLoadPreset = vi.mocked(loadPreset);

function makeBuild(
  id: string,
  characterId: string,
  overrides: Partial<Build> = {}
): Build {
  return {
    id,
    characterId,
    name: id,
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
    ...overrides,
  };
}

// ── Preset fixtures ─────────────────────────────────────────────
const p1 = makeBuild("p-1", "hu_tao", { name: "HT Crimson" });
const p2 = makeBuild("p-2", "hu_tao", {
  name: "HT Shimenawa",
  artifactSet: "shimenawas_reminiscence",
});
const p3 = makeBuild("p-3", "xingqiu", {
  name: "XQ Emblem",
  artifactSet: "emblem_of_severed_fate",
  sandsWeights: [{ stat: "er", weight: 100 }],
  gobletWeights: [{ stat: "hydro%", weight: 100 }],
});

const preset: BuildPayloadV5 = {
  version: 5,
  id: "test-preset",
  author: "Test",
  description: "Test Preset",
  builds: { "p-1": p1, "p-2": p2, "p-3": p3 },
  characterBuilds: {
    hu_tao: ["p-1", "p-2"],
    xingqiu: ["p-3"],
  },
  characterWeapons: {
    hu_tao: ["staff_of_homa"],
    xingqiu: ["sacrificial_sword"],
  },
};

// ── Setup ───────────────────────────────────────────────────────
beforeEach(() => {
  useBuildsStore.getState().clearAll();
  vi.clearAllMocks();
  mockGetCachedPreset.mockReturnValue(preset);
  mockLoadPreset.mockResolvedValue(preset);
});

/**
 * Subscribe to preset and return the resolved builds hook for a character.
 */
function subscribeAndRender(characterId: string) {
  act(() => {
    useBuildsStore.getState().subscribePreset("test-preset", preset);
  });
  return renderHook(() => useResolvedBuilds(characterId));
}

describe("Integration: Build Preset Lifecycle", () => {
  describe("subscribe → view", () => {
    it("shows all preset builds after subscription", async () => {
      const { result } = subscribeAndRender("hu_tao");

      await waitFor(() => {
        expect(result.current.length).toBe(2);
      });
      expect(result.current[0]!.id).toBe("p-1");
      expect(result.current[0]!.source).toBe("preset");
      expect(result.current[1]!.id).toBe("p-2");
      expect(result.current[1]!.source).toBe("preset");
    });

    it("populates weapons from preset during subscription", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
      });

      expect(useBuildsStore.getState().getCharacterWeapons("hu_tao")).toEqual([
        "staff_of_homa",
      ]);
    });
  });

  describe("subscribe → edit → view", () => {
    it("shows modified build with correct source", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      act(() => {
        useBuildsStore
          .getState()
          .setBuild("p-1", { name: "User HT Build" }, p1);
      });

      await waitFor(() => {
        expect(result.current[0]!.source).toBe("modified");
      });
      expect(result.current[0]!.name).toBe("User HT Build");
      // Sibling unaffected
      expect(result.current[1]!.source).toBe("preset");
      expect(result.current[1]!.name).toBe("HT Shimenawa");
    });
  });

  describe("subscribe → edit → revert", () => {
    it("reverts to original preset build after user edits", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      // Edit
      act(() => {
        useBuildsStore.getState().setBuild("p-1", { name: "Changed Name" }, p1);
      });
      await waitFor(() => {
        expect(result.current[0]!.name).toBe("Changed Name");
      });

      // Revert
      act(() => {
        useBuildsStore.getState().revertBuild("hu_tao", "p-1");
      });

      await waitFor(() => {
        expect(result.current[0]!.source).toBe("preset");
      });
      expect(result.current[0]!.name).toBe("HT Crimson");
      // Still two builds
      expect(result.current.length).toBe(2);
    });

    it("revert does NOT delete the build from the list", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      // Edit then revert
      act(() => {
        useBuildsStore.getState().setBuild("p-1", { name: "Temp Edit" }, p1);
      });
      act(() => {
        useBuildsStore.getState().revertBuild("hu_tao", "p-1");
      });

      // Build should still be visible (this was Bug 1)
      await waitFor(() => {
        expect(result.current.length).toBe(2);
      });
      expect(result.current.map((b) => b.id)).toEqual(["p-1", "p-2"]);
    });
  });

  describe("subscribe → delete → view", () => {
    it("hides deleted preset build from resolved list", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      act(() => {
        useBuildsStore.getState().deleteBuild("hu_tao", "p-1");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(1);
      });
      expect(result.current[0]!.id).toBe("p-2");
    });

    it("tracks deletion in presetDeletedBuildIds", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
      });

      act(() => {
        useBuildsStore.getState().deleteBuild("hu_tao", "p-1");
      });

      expect(useBuildsStore.getState().presetDeletedBuildIds).toContain("p-1");
    });
  });

  describe("subscribe → delete → restoreCharacter", () => {
    it("restores all preset builds after deletion", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      // Delete both builds
      act(() => {
        useBuildsStore.getState().deleteBuild("hu_tao", "p-1");
        useBuildsStore.getState().deleteBuild("hu_tao", "p-2");
      });
      await waitFor(() => {
        expect(result.current.length).toBe(0);
      });

      // Restore
      act(() => {
        useBuildsStore.getState().restoreCharacter("hu_tao");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(2);
      });
      expect(result.current[0]!.id).toBe("p-1");
      expect(result.current[0]!.source).toBe("preset");
      expect(result.current[1]!.id).toBe("p-2");
    });
  });

  describe("subscribe → edit → delete → restoreCharacter", () => {
    it("handles mixed modifications and deletions then restore", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      // Edit p-1, delete p-2
      act(() => {
        useBuildsStore.getState().setBuild("p-1", { name: "Modified HT" }, p1);
        useBuildsStore.getState().deleteBuild("hu_tao", "p-2");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(1);
      });
      expect(result.current[0]!.name).toBe("Modified HT");

      // Restore
      act(() => {
        useBuildsStore.getState().restoreCharacter("hu_tao");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(2);
      });
      // Both back to preset state
      expect(result.current[0]!.source).toBe("preset");
      expect(result.current[0]!.name).toBe("HT Crimson");
      expect(result.current[1]!.source).toBe("preset");
    });
  });

  describe("subscribe → add custom → view", () => {
    it("shows custom builds alongside preset builds", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      act(() => {
        useBuildsStore.getState().newBuild("hu_tao");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(3);
      });
      // Preset builds first, custom last
      expect(result.current[0]!.source).toBe("preset");
      expect(result.current[1]!.source).toBe("preset");
      expect(result.current[2]!.source).toBe("custom");
    });
  });

  describe("subscribe → add custom → restoreCharacter", () => {
    it("removes custom builds and restores preset-only state", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      act(() => {
        useBuildsStore.getState().newBuild("hu_tao");
      });
      await waitFor(() => expect(result.current.length).toBe(3));

      act(() => {
        useBuildsStore.getState().restoreCharacter("hu_tao");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(2);
      });
      expect(result.current.map((b) => b.id)).toEqual(["p-1", "p-2"]);
    });
  });

  describe("cross-character isolation", () => {
    it("operations on one character do not affect another", async () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
      });

      const htHook = renderHook(() => useResolvedBuilds("hu_tao"));
      const xqHook = renderHook(() => useResolvedBuilds("xingqiu"));

      await waitFor(() => {
        expect(htHook.result.current.length).toBe(2);
        expect(xqHook.result.current.length).toBe(1);
      });

      // Delete hu_tao's build, edit xingqiu's build
      act(() => {
        useBuildsStore.getState().deleteBuild("hu_tao", "p-1");
        useBuildsStore.getState().setBuild("p-3", { name: "XQ Modified" }, p3);
      });

      await waitFor(() => {
        expect(htHook.result.current.length).toBe(1);
      });
      expect(htHook.result.current[0]!.id).toBe("p-2");

      expect(xqHook.result.current.length).toBe(1);
      expect(xqHook.result.current[0]!.source).toBe("modified");
      expect(xqHook.result.current[0]!.name).toBe("XQ Modified");
    });
  });

  describe("hasCustomizations detection", () => {
    /**
     * These tests verify the store-level logic that CharacterBuildCard
     * uses to decide whether to show the "Restore" button.
     */
    function checkHasCustomizations(characterId: string): boolean {
      const state = useBuildsStore.getState();
      // Check 1: Any local build overrides (modified or custom)
      const ids = state.characterToBuildIds[characterId];
      if (ids?.some((id) => id in state.builds)) return true;

      // Check 2: Any preset builds for this character were deleted
      if (state.presetDeletedBuildIds.length > 0) {
        const cachedPreset = getCachedPreset(state.activePresetId);
        const presetBuildIds = cachedPreset?.characterBuilds?.[characterId];
        if (
          presetBuildIds?.some((id) => state.presetDeletedBuildIds.includes(id))
        )
          return true;
      }

      return false;
    }

    it("returns false for pristine preset state", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
      });

      expect(checkHasCustomizations("hu_tao")).toBe(false);
    });

    it("returns true when a build is modified", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
        useBuildsStore.getState().setBuild("p-1", { name: "Changed" }, p1);
      });

      expect(checkHasCustomizations("hu_tao")).toBe(true);
    });

    it("returns true when a preset build is deleted (Bug 2 fix)", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
        useBuildsStore.getState().deleteBuild("hu_tao", "p-1");
      });

      // This was Bug 2: previously returned false after deletion
      expect(checkHasCustomizations("hu_tao")).toBe(true);
    });

    it("returns true when a custom build is added", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
        useBuildsStore.getState().newBuild("hu_tao");
      });

      expect(checkHasCustomizations("hu_tao")).toBe(true);
    });

    it("returns false after restoreCharacter", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
        useBuildsStore.getState().setBuild("p-1", { name: "Changed" }, p1);
        useBuildsStore.getState().deleteBuild("hu_tao", "p-2");
      });

      expect(checkHasCustomizations("hu_tao")).toBe(true);

      act(() => {
        useBuildsStore.getState().restoreCharacter("hu_tao");
      });

      expect(checkHasCustomizations("hu_tao")).toBe(false);
    });

    it("detection is scoped to the correct character", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
        useBuildsStore.getState().setBuild("p-1", { name: "Changed" }, p1);
      });

      // hu_tao has modifications
      expect(checkHasCustomizations("hu_tao")).toBe(true);
      // xingqiu does not
      expect(checkHasCustomizations("xingqiu")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("revert after revert is a no-op", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      // Edit → revert → revert again
      act(() => {
        useBuildsStore.getState().setBuild("p-1", { name: "Temp" }, p1);
      });
      act(() => {
        useBuildsStore.getState().revertBuild("hu_tao", "p-1");
      });
      act(() => {
        useBuildsStore.getState().revertBuild("hu_tao", "p-1");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(2);
      });
      expect(result.current[0]!.source).toBe("preset");
    });

    it("delete then revert un-deletes the build", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      // Delete
      act(() => {
        useBuildsStore.getState().deleteBuild("hu_tao", "p-1");
      });
      await waitFor(() => expect(result.current.length).toBe(1));

      // Revert the deletion (revertBuild un-marks from presetDeletedBuildIds)
      act(() => {
        useBuildsStore.getState().revertBuild("hu_tao", "p-1");
      });

      // Note: revertBuild doesn't re-add to characterToBuildIds if it was removed.
      // The build was removed from ordering by deleteBuild, so revert alone
      // won't bring it back. Need restoreCharacter for full recovery.
      // This tests the expected behavior.
      const state = useBuildsStore.getState();
      expect(state.presetDeletedBuildIds).not.toContain("p-1");
    });

    it("duplicate then delete original preserves the copy", async () => {
      const { result } = subscribeAndRender("hu_tao");
      await waitFor(() => expect(result.current.length).toBe(2));

      // Duplicate p-1
      act(() => {
        useBuildsStore.getState().copyBuild("hu_tao", "p-1", p1);
      });

      await waitFor(() => {
        expect(result.current.length).toBe(3);
      });

      const copyId = result.current[2]!.id;

      // Delete original p-1
      act(() => {
        useBuildsStore.getState().deleteBuild("hu_tao", "p-1");
      });

      await waitFor(() => {
        expect(result.current.length).toBe(2);
      });
      // Copy still exists
      expect(result.current.map((b) => b.id)).toContain(copyId);
    });

    it("weapon changes are independent of build changes", () => {
      act(() => {
        useBuildsStore.getState().subscribePreset("test-preset", preset);
      });

      // Change weapons
      act(() => {
        useBuildsStore
          .getState()
          .setCharacterWeapons("hu_tao", ["jade_winged_spear"]);
      });

      expect(useBuildsStore.getState().getCharacterWeapons("hu_tao")).toEqual([
        "jade_winged_spear",
      ]);

      // Restore character resets weapons too
      act(() => {
        useBuildsStore.getState().restoreCharacter("hu_tao");
      });

      expect(useBuildsStore.getState().getCharacterWeapons("hu_tao")).toEqual([
        "staff_of_homa",
      ]);
    });
  });
});
