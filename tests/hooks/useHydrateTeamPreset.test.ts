import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHydrateTeamPreset } from "@/hooks/useHydrateTeamPreset";
import { loadTeamPreset } from "@/lib/team-comp/teamPresetRegistry";
import type { TeamCompData } from "@/lib/team-comp/types";
import { useTeamStore } from "@/stores/useTeamStore";

const presetCache = vi.hoisted(() => new Map<string, TeamCompData>());

vi.mock("@/lib/team-comp/teamPresetRegistry", () => ({
  cacheTeamPreset: vi.fn((id: string, payload: TeamCompData) => {
    presetCache.set(id, payload);
  }),
  getCachedTeamPreset: vi.fn((id: string | null) =>
    id ? (presetCache.get(id) ?? null) : null
  ),
  loadTeamPreset: vi.fn((id: string) =>
    Promise.resolve(presetCache.get(id) ?? null)
  ),
}));

const mockLoadTeamPreset = vi.mocked(loadTeamPreset);

beforeEach(() => {
  useTeamStore.getState().clearTeams();
  presetCache.clear();
  vi.clearAllMocks();
});

describe("useHydrateTeamPreset", () => {
  it("hydrates the active team preset into the store runtime view", async () => {
    const preset: TeamCompData = {
      teams: [
        {
          id: "preset-team",
          name: "Preset Team",
          characters: ["hu_tao", null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
        },
      ],
    };
    mockLoadTeamPreset.mockResolvedValueOnce(preset);
    useTeamStore.setState({ activePresetId: "preset-a" });

    renderHook(() => useHydrateTeamPreset());

    await waitFor(() => {
      expect(useTeamStore.getState().teams.map((team) => team.id)).toEqual([
        "preset-team",
      ]);
    });
    expect(loadTeamPreset).toHaveBeenCalledWith("preset-a");
  });
});
