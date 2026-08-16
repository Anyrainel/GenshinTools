import { describe, expect, it } from "vitest";
import {
  cacheTeamPreset,
  validateTeamPreset,
} from "@/lib/team-comp/teamPresetRegistry";
import type { ExportedTeam, TeamCompData } from "@/lib/team-comp/types";
import flagshipPreset from "@/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json";

function makeTeam(id: string): ExportedTeam {
  return {
    id,
    name: "",
    characters: ["amber", null, null, null],
    weapons: [null, null, null, null],
    artifacts: [null, null, null, null],
  };
}

describe("validateTeamPreset", () => {
  it("accepts presets whose team IDs are unique", () => {
    expect(() =>
      validateTeamPreset({ teams: [makeTeam("first"), makeTeam("second")] })
    ).not.toThrow();
  });

  it("rejects duplicate team IDs with the preset and duplicate in the error", () => {
    expect(() =>
      validateTeamPreset(
        { teams: [makeTeam("duplicate"), makeTeam("duplicate")] },
        "flagship"
      )
    ).toThrow('Invalid team preset "flagship": duplicate team IDs: duplicate.');
  });

  it("rejects teams without a valid ID", () => {
    expect(() => validateTeamPreset({ teams: [makeTeam("   ")] })).toThrow(
      "team at index 0 has no valid ID"
    );
  });

  it("rejects a non-array teams payload at runtime", () => {
    const invalidPayload = { teams: null } as unknown as TeamCompData;
    expect(() => validateTeamPreset(invalidPayload)).toThrow(
      "teams must be an array"
    );
  });

  it("rejects a missing payload at runtime", () => {
    expect(() => validateTeamPreset(null as unknown as TeamCompData)).toThrow(
      "teams must be an array"
    );
  });

  it("keeps every bundled flagship team ID unique", () => {
    expect(() =>
      validateTeamPreset(flagshipPreset as TeamCompData, "flagship preset")
    ).not.toThrow();
    expect(new Set(flagshipPreset.teams.map((team) => team.id)).size).toBe(
      flagshipPreset.teams.length
    );
  });

  it("validates presets before adding them to the runtime cache", () => {
    expect(() =>
      cacheTeamPreset("invalid-cache-entry", {
        teams: [makeTeam("duplicate"), makeTeam("duplicate")],
      })
    ).toThrow("duplicate team IDs: duplicate");
  });
});
