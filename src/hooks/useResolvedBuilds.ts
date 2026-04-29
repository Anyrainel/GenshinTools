import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BuildSource } from "@/data/enums";
import type { Build, BuildGroup, BuildPayloadV5 } from "@/data/types";
import {
  type BuildDelta,
  resolveBuildIdsForCharacter,
} from "@/lib/artifact-builds/buildDeltas";
import {
  getCachedPreset,
  loadPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { filterValidBuildGroups } from "@/lib/artifact-builds/buildValidation";
import { useBuildsStore } from "@/stores/useBuildsStore";

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

export function useResolvedBuilds(characterId: string): Build[] {
  const activePresetId = useBuildsStore((s) => s.activePresetId);
  const relevantDeltas = useBuildsStore(
    useShallow((s) =>
      s.deltas.filter(
        (delta) =>
          delta.kind === "preset" || delta.value.characterId === characterId
      )
    )
  );
  // Only subscribe to builds relevant to this character (shallow-compare the subset)
  const relevantBuilds = useBuildsStore(
    useShallow((s) => {
      const result: Record<string, Build> = {};
      for (const delta of s.deltas) {
        if (
          delta.kind === "custom" &&
          delta.value.characterId === characterId
        ) {
          result[delta.id] = delta.value;
        }
      }
      return result;
    })
  );

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
    const allIds = resolveBuildIdsForCharacter(
      relevantDeltas,
      preset,
      characterId
    );

    return allIds
      .map((id): Build | null => {
        const source = deriveBuildSource(id, relevantBuilds, preset);

        // Priority 1: Local Overrides / New Builds
        if (relevantBuilds[id]) {
          const local = relevantBuilds[id];
          // Avoid spread when source is already correct (preserves reference stability)
          return local.source === source ? local : { ...local, source };
        }

        // Priority 2: Preset Reference
        if (preset?.builds[id]) {
          const presetBuild = preset.builds[id];
          return presetBuild.source === source
            ? presetBuild
            : { ...presetBuild, source };
        }

        return null;
      })
      .filter((b): b is Build => b !== null);
  }, [characterId, relevantDeltas, relevantBuilds, preset]);
}

/**
 * Core resolution logic: reads store state + cached preset to produce BuildGroup[].
 * Used by the hook (reactive) and the standalone resolver (on-demand).
 */
function resolveAllBuilds(
  state: {
    deltas: BuildDelta[];
    builds: Record<string, Build>;
    hiddenCharacters: Record<string, boolean>;
    characterWeapons: Record<string, string[]>;
  },
  preset: BuildPayloadV5 | null
): BuildGroup[] {
  const allCharIds = new Set(Object.keys(preset?.characterBuilds ?? {}));
  for (const delta of state.deltas) {
    if (delta.kind === "custom") {
      allCharIds.add(delta.value.characterId);
    }
  }

  const result: BuildGroup[] = [];

  for (const charId of allCharIds) {
    if (state.hiddenCharacters[charId]) continue;

    const combinedIds = resolveBuildIdsForCharacter(
      state.deltas,
      preset,
      charId
    );

    const builds = combinedIds
      .map((id) => {
        if (state.builds[id]) return state.builds[id];
        const presetBuild = preset?.builds[id];
        return presetBuild ?? null;
      })
      .filter((b): b is Build => b !== null);

    const resolvedWeapons = state.characterWeapons[charId] ?? [];

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
}

export function useAllResolvedBuilds() {
  const activePresetId = useBuildsStore((s) => s.activePresetId);
  const deltas = useBuildsStore((s) => s.deltas);
  const buildsMap = useBuildsStore((s) => s.builds);
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

  return useMemo(
    () =>
      resolveAllBuilds(
        {
          deltas,
          builds: buildsMap,
          hiddenCharacters,
          characterWeapons,
        },
        preset
      ),
    [deltas, buildsMap, hiddenCharacters, preset, characterWeapons]
  );
}

export function useAllValidResolvedBuilds() {
  const groups = useAllResolvedBuilds();
  return useMemo(() => filterValidBuildGroups(groups), [groups]);
}

/**
 * Resolve all builds on demand (no hook). Reads current store state + cached preset.
 * Use for actions like export where you don't need reactive updates.
 */
export function resolveAllBuildsSnapshot(): BuildGroup[] {
  const state = useBuildsStore.getState();
  const preset = getCachedPreset(state.activePresetId);
  return resolveAllBuilds(state, preset);
}

export function resolveValidAllBuildsSnapshot(): BuildGroup[] {
  return filterValidBuildGroups(resolveAllBuildsSnapshot());
}
