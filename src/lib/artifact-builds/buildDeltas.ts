import type { Build, BuildPayloadV5 } from "@/data/types";
import {
  isCustomDelta,
  isPresetDelta,
  type PresetDelta,
} from "@/lib/presetDelta";
import { areBuildsEqual } from "./buildUtils";

export type BuildDelta = PresetDelta<Build>;

type RuntimeBuildState = {
  builds: Record<string, Build>;
  characterToBuildIds: Record<string, string[]>;
  presetDeletedBuildIds: string[];
};

const CUSTOM_SORT_OFFSET = 1_000_000;
type CustomBuildDelta = Extract<BuildDelta, { kind: "custom" }>;
type PresetBuildDelta = Extract<BuildDelta, { kind: "preset" }>;

type BuildDeltaIndex = {
  customById: Map<string, CustomBuildDelta>;
  customByCharacterId: Map<string, CustomBuildDelta[]>;
  presetById: Map<string, PresetBuildDelta>;
  presetByCharacterId: Map<string, PresetBuildDelta[]>;
  deletedPresetIds: Set<string>;
};

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

function appendToMapArray<TKey, TValue>(
  map: Map<TKey, TValue[]>,
  key: TKey,
  value: TValue
): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

function getPresetCharacterIdByBuildId(
  preset: BuildPayloadV5 | null
): Map<string, string> {
  const byBuildId = new Map<string, string>();
  for (const [characterId, ids] of Object.entries(
    preset?.characterBuilds ?? {}
  )) {
    for (const id of ids) byBuildId.set(id, characterId);
  }
  return byBuildId;
}

function getPresetBuildIndex(
  preset: BuildPayloadV5 | null,
  buildId: string
): number | undefined {
  for (const ids of Object.values(preset?.characterBuilds ?? {})) {
    const index = ids.indexOf(buildId);
    if (index !== -1) return index;
  }
  return undefined;
}

function indexBuildDeltas(
  deltas: BuildDelta[],
  preset: BuildPayloadV5 | null
): BuildDeltaIndex {
  const customById = new Map<string, CustomBuildDelta>();
  const customByCharacterId = new Map<string, CustomBuildDelta[]>();
  const presetById = new Map<string, PresetBuildDelta>();
  const presetByCharacterId = new Map<string, PresetBuildDelta[]>();
  const deletedPresetIds = new Set<string>();
  const presetCharacterIdByBuildId = getPresetCharacterIdByBuildId(preset);

  for (const delta of deltas) {
    if (isCustomDelta(delta)) {
      const previous = customById.get(delta.id);
      if (previous) {
        const previousList = customByCharacterId.get(
          previous.value.characterId
        );
        if (previousList) {
          const index = previousList.findIndex((item) => item.id === delta.id);
          if (index !== -1) previousList.splice(index, 1);
        }
      }
      customById.set(delta.id, delta);
      appendToMapArray(customByCharacterId, delta.value.characterId, delta);
      continue;
    }

    const previous = presetById.get(delta.id);
    if (previous) {
      const previousCharacterId =
        preset?.builds[previous.id]?.characterId ??
        presetCharacterIdByBuildId.get(previous.id);
      const previousList = previousCharacterId
        ? presetByCharacterId.get(previousCharacterId)
        : undefined;
      if (previousList) {
        const index = previousList.findIndex((item) => item.id === delta.id);
        if (index !== -1) previousList.splice(index, 1);
      }
    }

    presetById.set(delta.id, delta);
    if (delta.deleted) deletedPresetIds.add(delta.id);
    else deletedPresetIds.delete(delta.id);

    const characterId =
      preset?.builds[delta.id]?.characterId ??
      presetCharacterIdByBuildId.get(delta.id);
    if (characterId) appendToMapArray(presetByCharacterId, characterId, delta);
  }

  return {
    customById,
    customByCharacterId,
    presetById,
    presetByCharacterId,
    deletedPresetIds,
  };
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

export function getBuildEffectiveDisplayIndex(
  deltas: BuildDelta[],
  preset: BuildPayloadV5 | null,
  buildId: string
): number | undefined {
  return (
    getBuildDeltaDisplayIndex(deltas, buildId) ??
    getPresetBuildIndex(preset, buildId)
  );
}

export function disableBuildsForCharacters(
  deltas: BuildDelta[],
  characterIds: Iterable<string>,
  preset: BuildPayloadV5 | null
): BuildDelta[] {
  const hiddenCharacterIds = new Set(characterIds);
  if (hiddenCharacterIds.size === 0) return deltas;

  let next = deltas;
  for (const delta of deltas) {
    if (!isCustomDelta(delta)) continue;
    if (!hiddenCharacterIds.has(delta.value.characterId)) continue;
    if (delta.value.visible === false) continue;
    next = upsertCustomBuildDelta(
      next,
      { ...delta.value, visible: false },
      delta.displayIndex
    );
  }

  const deletedPresetIds = new Set(
    next
      .filter((delta) => isPresetDelta(delta) && delta.deleted)
      .map((delta) => delta.id)
  );
  for (const characterId of hiddenCharacterIds) {
    for (const presetBuildId of preset?.characterBuilds[characterId] ?? []) {
      if (deletedPresetIds.has(presetBuildId)) continue;
      const presetBuild = preset?.builds[presetBuildId];
      if (!presetBuild) continue;
      next = upsertCustomBuildDelta(
        next,
        { ...presetBuild, visible: false },
        getBuildEffectiveDisplayIndex(next, preset, presetBuildId)
      );
    }
  }

  return next;
}

export function upsertCustomBuildDelta(
  deltas: BuildDelta[],
  build: Build,
  displayIndex = getBuildDeltaDisplayIndex(deltas, build.id)
): BuildDelta[] {
  const { source: _source, ...storedBuild } = build;
  const withoutPresetTombstone = deltas.filter(
    (delta) =>
      !(isPresetDelta(delta) && delta.id === build.id && delta.deleted === true)
  );
  return setDelta(withoutPresetTombstone, {
    kind: "custom",
    id: build.id,
    value: storedBuild,
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

export function dedupeBuildDeltasAgainstPreset(
  deltas: BuildDelta[],
  preset: BuildPayloadV5 | null
): BuildDelta[] {
  if (!preset) return deltas;

  const deletedPresetIds = new Set(
    deltas
      .filter((delta) => isPresetDelta(delta) && delta.deleted)
      .map((delta) => delta.id)
  );
  const matchedPresetIds = new Set<string>();
  let next: BuildDelta[] = normalizePresetBuildDeltasAgainstPreset(
    deltas.filter(isPresetDelta),
    preset
  );

  for (const delta of deltas) {
    if (!isCustomDelta(delta)) continue;

    const presetBuildIds =
      preset.characterBuilds[delta.value.characterId] ?? [];
    const matchingPresetId = presetBuildIds.find((presetBuildId) => {
      if (
        deletedPresetIds.has(presetBuildId) ||
        matchedPresetIds.has(presetBuildId)
      ) {
        return false;
      }
      const presetBuild = preset.builds[presetBuildId];
      return presetBuild && areBuildsEqual(delta.value, presetBuild);
    });

    if (matchingPresetId) {
      matchedPresetIds.add(matchingPresetId);
      const baseIndex = getPresetBuildIndex(preset, matchingPresetId);
      if (delta.displayIndex != null && delta.displayIndex !== baseIndex) {
        next = upsertPresetBuildDelta(next, matchingPresetId, {
          displayIndex: delta.displayIndex,
        });
      }
      continue;
    }

    next = upsertCustomBuildDelta(next, delta.value, delta.displayIndex);
  }

  return next;
}

function normalizePresetBuildDeltasAgainstPreset(
  deltas: PresetBuildDelta[],
  preset: BuildPayloadV5
): PresetBuildDelta[] {
  return deltas.flatMap((delta) => {
    if (delta.deleted) return [delta];
    const baseIndex = getPresetBuildIndex(preset, delta.id);
    if (delta.displayIndex == null || delta.displayIndex === baseIndex) {
      return [];
    }
    return [delta];
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
  delta: CustomBuildDelta,
  fallbackIndex: number
): number {
  return delta.displayIndex ?? CUSTOM_SORT_OFFSET + fallbackIndex;
}

function resolveBuildIdsForCharacterFromIndex(
  index: BuildDeltaIndex,
  preset: BuildPayloadV5 | null,
  characterId: string
): string[] {
  const presetIds = preset?.characterBuilds[characterId] ?? [];
  const presetIndexById = new Map(
    presetIds.map((id, index) => [id, index] as const)
  );
  const entries: {
    id: string;
    displayIndex: number;
    fallbackIndex: number;
  }[] = [];
  let customIndex = 0;

  for (const id of presetIds) {
    if (index.deletedPresetIds.has(id)) continue;
    const delta = index.presetById.get(id);
    const presetIndex = presetIndexById.get(id) ?? CUSTOM_SORT_OFFSET;
    entries.push({
      id,
      displayIndex: delta?.displayIndex ?? presetIndex,
      fallbackIndex: presetIndex,
    });
  }

  for (const delta of index.customByCharacterId.get(characterId) ?? []) {
    const presetIndex = presetIndexById.get(delta.id);
    entries.push({
      id: delta.id,
      displayIndex: getCustomOrderIndex(delta, customIndex),
      fallbackIndex:
        presetIndex != null ? presetIndex : CUSTOM_SORT_OFFSET + customIndex,
    });
    customIndex++;
  }

  for (const delta of index.presetByCharacterId.get(characterId) ?? []) {
    if (delta.deleted) continue;
    if (presetIndexById.has(delta.id)) continue;
    const presetIndex = presetIndexById.get(delta.id);
    entries.push({
      id: delta.id,
      displayIndex: delta.displayIndex ?? presetIndex ?? CUSTOM_SORT_OFFSET,
      fallbackIndex: presetIndex ?? CUSTOM_SORT_OFFSET,
    });
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

  return orderedIds;
}

export function resolveBuildIdsForCharacter(
  deltas: BuildDelta[],
  preset: BuildPayloadV5 | null,
  characterId: string
): string[] {
  return resolveBuildIdsForCharacterFromIndex(
    indexBuildDeltas(deltas, preset),
    preset,
    characterId
  );
}

export function deriveBuildRuntimeFromDeltas(
  deltas: BuildDelta[],
  preset: BuildPayloadV5 | null
): RuntimeBuildState {
  const index = indexBuildDeltas(deltas, preset);
  const builds = Object.fromEntries(
    [...index.customById].map(([id, delta]) => [id, delta.value])
  );
  const characterIds = new Set<string>(
    Object.keys(preset?.characterBuilds ?? {})
  );
  for (const characterId of index.customByCharacterId.keys()) {
    characterIds.add(characterId);
  }
  for (const characterId of index.presetByCharacterId.keys()) {
    characterIds.add(characterId);
  }

  const characterToBuildIds: Record<string, string[]> = {};
  for (const characterId of characterIds) {
    const ids = resolveBuildIdsForCharacterFromIndex(
      index,
      preset,
      characterId
    );
    if (ids.length > 0) {
      characterToBuildIds[characterId] = ids;
    }
  }

  return {
    builds,
    characterToBuildIds,
    presetDeletedBuildIds: [...index.deletedPresetIds],
  };
}

export function setBuildDeltaOrderForCharacter(
  deltas: BuildDelta[],
  characterId: string,
  orderedIds: string[],
  preset: BuildPayloadV5 | null
): BuildDelta[] {
  const index = indexBuildDeltas(deltas, preset);
  const nextByKey = new Map<string, BuildDelta>();
  for (const delta of deltas) {
    nextByKey.set(`${delta.kind}:${delta.id}`, delta);
  }
  const presetIds = new Set(preset?.characterBuilds[characterId] ?? []);
  const presetIndexById = new Map(
    (preset?.characterBuilds[characterId] ?? []).map(
      (id, index) => [id, index] as const
    )
  );
  for (const id of presetIds) {
    const delta = nextByKey.get(`preset:${id}`);
    if (delta && isPresetDelta(delta) && !delta.deleted) {
      nextByKey.delete(`preset:${id}`);
    }
  }
  orderedIds.forEach((id, displayIndex) => {
    const customDelta = index.customById.get(id);
    if (customDelta) {
      nextByKey.set(`custom:${id}`, {
        ...customDelta,
        displayIndex,
      });
      return;
    }

    const presetBuild = preset?.builds[id];
    if (presetBuild?.characterId === characterId || presetIds.has(id)) {
      if (presetIndexById.get(id) !== displayIndex) {
        nextByKey.set(`preset:${id}`, {
          kind: "preset",
          id,
          displayIndex,
        });
      }
    }
  });
  return [...nextByKey.values()];
}
