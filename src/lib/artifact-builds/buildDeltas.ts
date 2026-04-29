import type { Build, BuildPayloadV5 } from "@/data/types";
import {
  isCustomDelta,
  isPresetDelta,
  type PresetDelta,
} from "@/lib/presetDelta";

export type BuildDelta = PresetDelta<Build>;

type RuntimeBuildState = {
  builds: Record<string, Build>;
  characterToBuildIds: Record<string, string[]>;
  presetDeletedBuildIds: string[];
};

const CUSTOM_SORT_OFFSET = 1_000_000;

function getDisplayIndex(delta: BuildDelta | undefined): number | undefined {
  return delta?.displayIndex;
}

function setDelta<T extends BuildDelta>(
  deltas: BuildDelta[],
  nextDelta: T
): BuildDelta[] {
  const next = deltas.filter(
    (delta) => !(delta.kind === nextDelta.kind && delta.id === nextDelta.id)
  );
  next.push(nextDelta);
  return next;
}

export function getBuildDeltaDisplayIndex(
  deltas: BuildDelta[],
  buildId: string
): number | undefined {
  return (
    getDisplayIndex(
      deltas.find((delta) => isCustomDelta(delta) && delta.id === buildId)
    ) ??
    getDisplayIndex(
      deltas.find((delta) => isPresetDelta(delta) && delta.id === buildId)
    )
  );
}

export function upsertCustomBuildDelta(
  deltas: BuildDelta[],
  build: Build,
  displayIndex = getBuildDeltaDisplayIndex(deltas, build.id)
): BuildDelta[] {
  const withoutPresetTombstone = deltas.filter(
    (delta) =>
      !(isPresetDelta(delta) && delta.id === build.id && delta.deleted === true)
  );
  return setDelta(withoutPresetTombstone, {
    kind: "custom",
    id: build.id,
    value: build,
    ...(displayIndex != null ? { displayIndex } : {}),
  });
}

export function removeCustomBuildDelta(
  deltas: BuildDelta[],
  buildId: string
): BuildDelta[] {
  return deltas.filter(
    (delta) => !(isCustomDelta(delta) && delta.id === buildId)
  );
}

export function upsertPresetBuildDelta(
  deltas: BuildDelta[],
  buildId: string,
  options: { displayIndex?: number; deleted?: true } = {}
): BuildDelta[] {
  return setDelta(deltas, {
    kind: "preset",
    id: buildId,
    ...(options.displayIndex != null
      ? { displayIndex: options.displayIndex }
      : {}),
    ...(options.deleted ? { deleted: true } : {}),
  });
}

export function deleteBuildDelta(
  deltas: BuildDelta[],
  buildId: string,
  displayIndex = getBuildDeltaDisplayIndex(deltas, buildId)
): BuildDelta[] {
  const withoutCustom = removeCustomBuildDelta(deltas, buildId);
  return upsertPresetBuildDelta(withoutCustom, buildId, {
    ...(displayIndex != null ? { displayIndex } : {}),
    deleted: true,
  });
}

export function getCustomBuildMapFromDeltas(
  deltas: BuildDelta[]
): Record<string, Build> {
  const builds: Record<string, Build> = {};
  for (const delta of deltas) {
    if (isCustomDelta(delta)) {
      builds[delta.id] = delta.value;
    }
  }
  return builds;
}

export function getPresetDeletedBuildIdsFromDeltas(
  deltas: BuildDelta[]
): string[] {
  return deltas
    .filter((delta) => isPresetDelta(delta) && delta.deleted)
    .map((delta) => delta.id);
}

export function createBuildDeltasFromLegacyState({
  builds = {},
  characterToBuildIds = {},
  presetDeletedBuildIds = [],
}: {
  builds?: Record<string, Build>;
  characterToBuildIds?: Record<string, string[]>;
  presetDeletedBuildIds?: string[];
}): BuildDelta[] {
  let deltas: BuildDelta[] = [];

  for (const build of Object.values(builds)) {
    deltas = upsertCustomBuildDelta(deltas, build);
  }

  for (const ids of Object.values(characterToBuildIds)) {
    ids.forEach((id, displayIndex) => {
      const build = builds[id];
      if (build) {
        deltas = upsertCustomBuildDelta(deltas, build, displayIndex);
      } else {
        deltas = upsertPresetBuildDelta(deltas, id, { displayIndex });
      }
    });
  }

  for (const id of presetDeletedBuildIds) {
    deltas = deleteBuildDelta(deltas, id);
  }

  return deltas;
}

function getCustomOrderIndex(
  delta: Extract<BuildDelta, { kind: "custom" }>,
  fallbackIndex: number
): number {
  return delta.displayIndex ?? CUSTOM_SORT_OFFSET + fallbackIndex;
}

export function resolveBuildIdsForCharacter(
  deltas: BuildDelta[],
  preset: BuildPayloadV5 | null,
  characterId: string
): string[] {
  const presetIds = preset?.characterBuilds[characterId] ?? [];
  const presetIdSet = new Set(presetIds);
  const deletedPresetIds = new Set(getPresetDeletedBuildIdsFromDeltas(deltas));
  const entries: {
    id: string;
    displayIndex: number;
    fallbackIndex: number;
  }[] = [];
  let hasDeltaForCharacter = false;

  for (const delta of deltas) {
    if (isCustomDelta(delta)) {
      if (delta.value.characterId !== characterId) continue;
      hasDeltaForCharacter = true;
      entries.push({
        id: delta.id,
        displayIndex: getCustomOrderIndex(delta, entries.length),
        fallbackIndex: presetIdSet.has(delta.id)
          ? presetIds.indexOf(delta.id)
          : CUSTOM_SORT_OFFSET + entries.length,
      });
      continue;
    }

    const presetBuild = preset?.builds[delta.id];
    const belongsToCharacter =
      presetBuild?.characterId === characterId || presetIdSet.has(delta.id);
    if (!belongsToCharacter) continue;
    hasDeltaForCharacter = true;
    if (delta.deleted) continue;
    entries.push({
      id: delta.id,
      displayIndex: delta.displayIndex ?? presetIds.indexOf(delta.id),
      fallbackIndex: presetIds.indexOf(delta.id),
    });
  }

  if (!hasDeltaForCharacter) {
    return presetIds.filter((id) => !deletedPresetIds.has(id));
  }

  entries.sort((a, b) => {
    if (a.displayIndex !== b.displayIndex) {
      return a.displayIndex - b.displayIndex;
    }
    return a.fallbackIndex - b.fallbackIndex;
  });

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    orderedIds.push(entry.id);
    seen.add(entry.id);
  }

  for (const id of presetIds) {
    if (seen.has(id) || deletedPresetIds.has(id)) continue;
    orderedIds.push(id);
  }

  return orderedIds;
}

export function deriveBuildRuntimeFromDeltas(
  deltas: BuildDelta[],
  preset: BuildPayloadV5 | null
): RuntimeBuildState {
  const builds = getCustomBuildMapFromDeltas(deltas);
  const characterIds = new Set<string>(
    Object.keys(preset?.characterBuilds ?? {})
  );
  for (const delta of deltas) {
    if (isCustomDelta(delta)) {
      characterIds.add(delta.value.characterId);
      continue;
    }
    const presetBuild = preset?.builds[delta.id];
    if (presetBuild) {
      characterIds.add(presetBuild.characterId);
    }
  }

  const characterToBuildIds: Record<string, string[]> = {};
  for (const characterId of characterIds) {
    const ids = resolveBuildIdsForCharacter(deltas, preset, characterId);
    if (ids.length > 0) {
      characterToBuildIds[characterId] = ids;
    }
  }

  return {
    builds,
    characterToBuildIds,
    presetDeletedBuildIds: getPresetDeletedBuildIdsFromDeltas(deltas),
  };
}

export function setBuildDeltaOrderForCharacter(
  deltas: BuildDelta[],
  characterId: string,
  orderedIds: string[],
  preset: BuildPayloadV5 | null
): BuildDelta[] {
  let next = deltas;
  orderedIds.forEach((id, displayIndex) => {
    const customDelta = next.find(
      (delta) => isCustomDelta(delta) && delta.id === id
    );
    if (customDelta && isCustomDelta(customDelta)) {
      next = upsertCustomBuildDelta(next, customDelta.value, displayIndex);
      return;
    }

    const presetBuild = preset?.builds[id];
    if (presetBuild?.characterId === characterId) {
      next = upsertPresetBuildDelta(next, id, { displayIndex });
    }
  });
  return next;
}
