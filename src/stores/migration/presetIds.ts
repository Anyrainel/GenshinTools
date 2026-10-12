import {
  BUILTIN_BUILD_PRESET_ID,
  BUILTIN_TEAM_PRESET_ID,
} from "@/config/presets/ids";

// Builds <= v9 and teams <= v22 persisted Vite's module paths as preset IDs.
// Preserve the selected preset when its source moves. Unknown/custom IDs and
// an explicit null selection must remain unchanged at every restore boundary.
const historicalIds: Readonly<Record<string, string>> = {
  "/src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json":
    BUILTIN_BUILD_PRESET_ID,
  "/src/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json":
    BUILTIN_TEAM_PRESET_ID,
};

export function migrateBundledPresetId(id: string | null): string | null {
  return id !== null && Object.hasOwn(historicalIds, id)
    ? historicalIds[id]
    : id;
}
