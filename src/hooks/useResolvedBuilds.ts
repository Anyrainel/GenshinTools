import type {
  Build,
  BuildGroup,
  BuildPayloadV5,
  BuildSource,
} from "@/data/types";
import {
  getCachedPreset,
  loadPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useEffect, useMemo, useState } from "react";

const EMPTY_ARRAY: string[] = [];

/** Derive build source by checking presence in local store vs preset */
function deriveBuildSource(
  id: string,
  buildsMap: Record<string, Build>,
  preset: BuildPayloadV5 | null
): BuildSource {
  const inLocal = id in buildsMap;
  const inPreset = !!preset?.builds[id];
  if (inLocal && inPreset) return "modified";
  if (inPreset) return "preset";
  return "custom";
}

/**
 * Resolve the ordered list of build IDs for a character.
 * Primary source: characterToBuildIds (canonical ordering).
 * Fallback: preset characterBuilds (for characters not yet in characterToBuildIds).
 */
function resolveIds(
  characterToBuildIds: Record<string, string[]>,
  preset: BuildPayloadV5 | null,
  charId: string
): string[] {
  return characterToBuildIds[charId] ?? preset?.characterBuilds[charId] ?? [];
}

export function useResolvedBuilds(characterId: string): Build[] {
  const activePresetId = useBuildsStore((s) => s.activePresetId);
  const localBuildIds = useBuildsStore(
    (s) => s.characterToBuildIds[characterId] || EMPTY_ARRAY
  );
  const presetDeletedIds = useBuildsStore((s) => s.presetDeletedBuildIds);
  const buildsMap = useBuildsStore((s) => s.builds);

  const [preset, setPreset] = useState<BuildPayloadV5 | null>(() =>
    getCachedPreset(activePresetId)
  );

  useEffect(() => {
    if (activePresetId) {
      loadPreset(activePresetId)
        .then(setPreset)
        .catch((e) => {
          console.error("Failed to load preset", activePresetId, e);
          setPreset(null);
        });
    } else {
      setPreset(null);
    }
  }, [activePresetId]);

  return useMemo(() => {
    const allIds = resolveIds(
      { [characterId]: localBuildIds },
      preset,
      characterId
    );

    return allIds
      .filter((id) => !presetDeletedIds.includes(id))
      .map((id): Build | null => {
        const source = deriveBuildSource(id, buildsMap, preset);

        // Priority 1: Local Overrides / New Builds
        if (buildsMap[id]) return { ...buildsMap[id], source };

        // Priority 2: Preset Reference
        if (preset?.builds[id]) return { ...preset.builds[id], source };

        return null;
      })
      .filter((b): b is Build => b !== null);
  }, [characterId, localBuildIds, presetDeletedIds, buildsMap, preset]);
}

export function useAllResolvedBuilds() {
  const activePresetId = useBuildsStore((s) => s.activePresetId);
  const characterToBuildIds = useBuildsStore((s) => s.characterToBuildIds);
  const buildsMap = useBuildsStore((s) => s.builds);
  const presetDeletedIds = useBuildsStore((s) => s.presetDeletedBuildIds);
  const hiddenCharacters = useBuildsStore((s) => s.hiddenCharacters);
  const characterWeapons = useBuildsStore((s) => s.characterWeapons);

  const [preset, setPreset] = useState<BuildPayloadV5 | null>(() =>
    getCachedPreset(activePresetId)
  );

  useEffect(() => {
    if (activePresetId) {
      loadPreset(activePresetId)
        .then(setPreset)
        .catch((e) => {
          console.error("Failed to load preset", activePresetId, e);
          setPreset(null);
        });
    } else {
      setPreset(null);
    }
  }, [activePresetId]);

  return useMemo(() => {
    const allCharIds = new Set([
      ...Object.keys(characterToBuildIds),
      ...Object.keys(preset?.characterBuilds ?? {}),
    ]);

    const result: BuildGroup[] = [];

    for (const charId of allCharIds) {
      // Respect local hidden state (skip computation for hidden chars)
      if (hiddenCharacters[charId]) continue;

      const combinedIds = resolveIds(characterToBuildIds, preset, charId);

      const builds = combinedIds
        .filter((id) => !presetDeletedIds.includes(id))
        .map((id) => {
          if (buildsMap[id]) return buildsMap[id];
          const presetBuild = preset?.builds[id];
          return presetBuild ?? null;
        })
        .filter((b): b is Build => b !== null);

      // Weapons are always materialized in zustand during import/subscribe
      const resolvedWeapons = characterWeapons[charId] ?? [];

      if (builds.length > 0) {
        result.push({
          characterId: charId,
          builds,
          hidden: false,
          weapons: resolvedWeapons,
        });
      }
    }
    return result;
  }, [
    characterToBuildIds,
    buildsMap,
    presetDeletedIds,
    hiddenCharacters,
    preset,
    characterWeapons,
  ]);
}
