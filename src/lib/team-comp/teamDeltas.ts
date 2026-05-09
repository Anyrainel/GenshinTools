import type { ArtifactSetConfig } from "@/data/types";
import {
  isCustomDelta,
  isPresetDelta,
  type PresetDelta,
} from "@/lib/presetDelta";
import type {
  ExportedArtifact,
  ExportedTeam,
  TeamCharConfig,
  TeamComp,
  TeamCompData,
  TeamCompInput,
  TeamSetupConfig,
} from "@/lib/team-comp/types";

export type TeamCompDelta = PresetDelta<TeamComp>;

const MAX_TEAM_SLOTS = 4;
const CUSTOM_SORT_OFFSET = 1_000_000;
type CustomTeamCompDelta = Extract<TeamCompDelta, { kind: "custom" }>;
type PresetTeamCompDelta = Extract<TeamCompDelta, { kind: "preset" }>;

type TeamCompDeltaIndex = {
  customById: Map<string, CustomTeamCompDelta>;
  presetById: Map<string, PresetTeamCompDelta>;
  deletedPresetIds: Set<string>;
};

type PresetCompIndex = {
  ids: string[];
  byId: Map<string, TeamComp>;
  indexById: Map<string, number>;
};

function cleanRecord<T>(
  record: Record<string, T>
): Record<string, T> | undefined {
  return Object.keys(record).length > 0 ? record : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeArtifactConfig(artifact: unknown): ArtifactSetConfig | null {
  if (!artifact || typeof artifact !== "object") return null;
  const value = artifact as Record<string, unknown>;
  if (value.type === "4pc" && typeof value.setId === "string") {
    return { type: "4pc", setId: value.setId };
  }
  if (value.type === "2pc+2pc" && Array.isArray(value.halfSetIds)) {
    const [first, second] = value.halfSetIds;
    if (first != null && second != null) {
      return {
        type: "2pc+2pc",
        halfSetIds: [String(first), String(second)],
      };
    }
  }
  if (typeof value.setId === "string") {
    return { type: "4pc", setId: value.setId };
  }
  if (value.id1 != null && value.id2 != null) {
    return {
      type: "2pc+2pc",
      halfSetIds: [String(value.id1), String(value.id2)],
    };
  }
  if (Array.isArray(value.halfSetIds)) {
    const [first, second] = value.halfSetIds;
    if (first != null && second != null) {
      return {
        type: "2pc+2pc",
        halfSetIds: [String(first), String(second)],
      };
    }
  }
  return null;
}

function exportArtifactConfig(
  artifact: ArtifactSetConfig | null
): ExportedArtifact | null {
  if (!artifact) return null;
  if (artifact.type === "4pc") return { setId: artifact.setId };
  return { halfSetIds: artifact.halfSetIds };
}

function trimTrailingEmptySlots(slots: TeamComp["slots"]): TeamComp["slots"] {
  let last = slots.length - 1;
  while (last >= 0) {
    const slot = slots[last];
    if (slot.charId || slot.weaponId || slot.artifactSet) break;
    last--;
  }
  return slots.slice(0, last + 1);
}

export function teamCompToArrays(comp: TeamComp): {
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
} {
  const slots = comp.slots.slice(0, MAX_TEAM_SLOTS);
  const characters = slots.map((slot) => slot.charId ?? null);
  const weapons = slots.map((slot) => slot.weaponId ?? null);
  const artifacts = slots.map((slot) => slot.artifactSet ?? null);
  while (characters.length < MAX_TEAM_SLOTS) characters.push(null);
  while (weapons.length < MAX_TEAM_SLOTS) weapons.push(null);
  while (artifacts.length < MAX_TEAM_SLOTS) artifacts.push(null);
  return { characters, weapons, artifacts };
}

export function teamArraysToComp({
  id,
  name = "",
  characters = [],
  weapons = [],
  artifacts = [],
  reactions = [],
}: {
  id: string;
  name?: string;
  characters?: (string | null)[];
  weapons?: (string | null)[];
  artifacts?: (ArtifactSetConfig | null)[];
  reactions?: TeamComp["reactions"];
}): TeamComp {
  const maxLength = Math.min(
    MAX_TEAM_SLOTS,
    Math.max(characters.length, weapons.length, artifacts.length)
  );
  const slots: TeamComp["slots"] = [];
  for (let i = 0; i < maxLength; i++) {
    slots.push({
      charId: characters[i] ?? null,
      weaponId: weapons[i] ?? null,
      artifactSet: artifacts[i] ?? null,
    });
  }
  return {
    id,
    name,
    slots: trimTrailingEmptySlots(slots),
    reactions: [...reactions],
  };
}

export function createEmptyTeamComp(id: string): TeamComp {
  return {
    id,
    name: "",
    slots: [],
    reactions: [],
  };
}

export function createDefaultTeamSetupConfig(): TeamSetupConfig {
  return { combatOptions: {} };
}

export function compactTeamSetupConfig(
  config: Partial<TeamSetupConfig> = {}
): TeamSetupConfig | undefined {
  const normalized = normalizeTeamSetupConfig(config);
  return hasMeaningfulConfigValue(normalized) ? normalized : undefined;
}

export function compactTeamSetupConfigs(
  configsByTeamId: Record<string, TeamSetupConfig>
): Record<string, TeamSetupConfig> {
  return Object.fromEntries(
    Object.entries(configsByTeamId).flatMap(([teamId, config]) => {
      const compacted = compactTeamSetupConfig(config);
      return compacted ? [[teamId, compacted]] : [];
    })
  );
}

function mergeCharConfig(
  charConfigs: Record<string, TeamCharConfig>,
  charId: string,
  patch: TeamCharConfig
): void {
  charConfigs[charId] = {
    ...(charConfigs[charId] ?? {}),
    ...patch,
    ...(patch.talentLevels
      ? {
          talentLevels: {
            ...(charConfigs[charId]?.talentLevels ?? {}),
            ...patch.talentLevels,
          },
        }
      : {}),
  };
}

export function normalizeTeamSetupConfig(
  config: Partial<TeamSetupConfig> = {}
): TeamSetupConfig {
  return {
    combatOptions: { ...(config.combatOptions ?? {}) },
    ...(config.charConfigs ? { charConfigs: config.charConfigs } : {}),
    ...(config.damage ? { damage: config.damage } : {}),
    ...(config.energy ? { energy: config.energy } : {}),
    ...(config.investment ? { investment: config.investment } : {}),
  };
}

function hasMeaningfulConfigValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "object") return true;
  return Object.values(value).some(hasMeaningfulConfigValue);
}

export function teamCompInputToComp(
  input: TeamCompInput & { id: string }
): TeamComp {
  if (!input.characters && !input.weapons && !input.artifacts && input.slots) {
    return {
      id: input.id,
      name: input.name ?? "",
      reactions: [...(input.reactions ?? [])],
      slots: trimTrailingEmptySlots(input.slots),
    };
  }
  return teamArraysToComp({
    id: input.id,
    name: input.name ?? "",
    characters: input.characters ?? [],
    weapons: input.weapons ?? [],
    artifacts: input.artifacts ?? [],
    reactions: input.reactions ?? [],
  });
}

function setDelta<T extends TeamCompDelta>(
  deltas: TeamCompDelta[],
  nextDelta: T
): TeamCompDelta[] {
  const next = deltas.filter(
    (delta) => !(delta.kind === nextDelta.kind && delta.id === nextDelta.id)
  );
  next.push(nextDelta);
  return next;
}

function indexTeamCompDeltas(deltas: TeamCompDelta[]): TeamCompDeltaIndex {
  const customById = new Map<string, CustomTeamCompDelta>();
  const presetById = new Map<string, PresetTeamCompDelta>();
  const deletedPresetIds = new Set<string>();
  for (const delta of deltas) {
    if (isCustomDelta(delta)) {
      customById.set(delta.id, delta);
      continue;
    }
    presetById.set(delta.id, delta);
    if (delta.deleted) deletedPresetIds.add(delta.id);
    else deletedPresetIds.delete(delta.id);
  }
  return { customById, presetById, deletedPresetIds };
}

export function getTeamDeltaDisplayIndex(
  deltas: TeamCompDelta[],
  teamId: string
): number | undefined {
  return (
    deltas.find((delta) => isCustomDelta(delta) && delta.id === teamId)
      ?.displayIndex ??
    deltas.find((delta) => isPresetDelta(delta) && delta.id === teamId)
      ?.displayIndex
  );
}

export function getTeamEffectiveDisplayIndex(
  deltas: TeamCompDelta[],
  preset: TeamCompData | null,
  teamId: string
): number | undefined {
  return (
    getTeamDeltaDisplayIndex(deltas, teamId) ??
    getPresetCompIndex(preset).indexById.get(teamId)
  );
}

export function upsertCustomTeamCompDelta(
  deltas: TeamCompDelta[],
  comp: TeamComp,
  displayIndex = getTeamDeltaDisplayIndex(deltas, comp.id)
): TeamCompDelta[] {
  const withoutPresetTombstone = deltas.filter(
    (delta) =>
      !(isPresetDelta(delta) && delta.id === comp.id && delta.deleted === true)
  );
  return setDelta(withoutPresetTombstone, {
    kind: "custom",
    id: comp.id,
    value: comp,
    ...(displayIndex != null ? { displayIndex } : {}),
  });
}

export function removeCustomTeamCompDelta(
  deltas: TeamCompDelta[],
  teamId: string
): TeamCompDelta[] {
  return deltas.filter(
    (delta) => !(isCustomDelta(delta) && delta.id === teamId)
  );
}

export function upsertPresetTeamCompDelta(
  deltas: TeamCompDelta[],
  teamId: string,
  options: { displayIndex?: number; deleted?: true } = {}
): TeamCompDelta[] {
  return setDelta(deltas, {
    kind: "preset",
    id: teamId,
    ...(options.displayIndex != null
      ? { displayIndex: options.displayIndex }
      : {}),
    ...(options.deleted ? { deleted: true } : {}),
  });
}

export function deleteTeamCompDelta(
  deltas: TeamCompDelta[],
  teamId: string,
  displayIndex = getTeamDeltaDisplayIndex(deltas, teamId)
): TeamCompDelta[] {
  const withoutCustom = removeCustomTeamCompDelta(deltas, teamId);
  return upsertPresetTeamCompDelta(withoutCustom, teamId, {
    ...(displayIndex != null ? { displayIndex } : {}),
    deleted: true,
  });
}

function artifactSetConfigsEqual(
  first: ArtifactSetConfig | null,
  second: ArtifactSetConfig | null
): boolean {
  if (first === second) return true;
  if (!first || !second || first.type !== second.type) return false;
  if (first.type === "4pc" && second.type === "4pc") {
    return first.setId === second.setId;
  }
  if (first.type === "2pc+2pc" && second.type === "2pc+2pc") {
    return (
      first.halfSetIds[0] === second.halfSetIds[0] &&
      first.halfSetIds[1] === second.halfSetIds[1]
    );
  }
  return false;
}

export function areTeamCompsEqual(first: TeamComp, second: TeamComp): boolean {
  if (first.name !== second.name) return false;
  if (first.reactions.length !== second.reactions.length) return false;
  for (let i = 0; i < first.reactions.length; i++) {
    if (first.reactions[i] !== second.reactions[i]) return false;
  }
  if (first.slots.length !== second.slots.length) return false;
  for (let i = 0; i < first.slots.length; i++) {
    const firstSlot = first.slots[i];
    const secondSlot = second.slots[i];
    if (
      firstSlot.charId !== secondSlot.charId ||
      firstSlot.weaponId !== secondSlot.weaponId ||
      !artifactSetConfigsEqual(firstSlot.artifactSet, secondSlot.artifactSet)
    ) {
      return false;
    }
  }
  return true;
}

export interface TeamCompDedupeResult {
  deltas: TeamCompDelta[];
  idMap: Record<string, string>;
}

export function dedupeTeamCompDeltasAgainstPreset(
  deltas: TeamCompDelta[],
  preset: TeamCompData | null
): TeamCompDedupeResult {
  if (!preset) return { deltas, idMap: {} };

  const presetComps = normalizePresetPayload(preset);
  const presetIndex = getPresetCompIndex(preset);
  const deletedPresetIds = new Set(
    deltas
      .filter((delta) => isPresetDelta(delta) && delta.deleted)
      .map((delta) => delta.id)
  );
  const matchedPresetIds = new Set<string>();
  const idMap: Record<string, string> = {};
  let next: TeamCompDelta[] = normalizePresetTeamCompDeltasAgainstPreset(
    deltas.filter(isPresetDelta),
    presetIndex
  );

  for (const delta of deltas) {
    if (!isCustomDelta(delta)) continue;

    const matchingPreset = presetComps.find((presetComp) => {
      if (
        deletedPresetIds.has(presetComp.id) ||
        matchedPresetIds.has(presetComp.id)
      ) {
        return false;
      }
      return areTeamCompsEqual(delta.value, presetComp);
    });

    if (matchingPreset) {
      matchedPresetIds.add(matchingPreset.id);
      idMap[delta.id] = matchingPreset.id;
      const baseIndex = presetIndex.indexById.get(matchingPreset.id);
      if (delta.displayIndex != null && delta.displayIndex !== baseIndex) {
        next = upsertPresetTeamCompDelta(next, matchingPreset.id, {
          displayIndex: delta.displayIndex,
        });
      }
      continue;
    }

    next = upsertCustomTeamCompDelta(next, delta.value, delta.displayIndex);
  }

  return { deltas: next, idMap };
}

function normalizePresetTeamCompDeltasAgainstPreset(
  deltas: PresetTeamCompDelta[],
  presetIndex: PresetCompIndex
): PresetTeamCompDelta[] {
  return deltas.flatMap((delta) => {
    if (delta.deleted) return [delta];
    const baseIndex = presetIndex.indexById.get(delta.id);
    if (delta.displayIndex == null || delta.displayIndex === baseIndex) {
      return [];
    }
    return [delta];
  });
}

function normalizePresetPayload(payload: TeamCompData | null): TeamComp[] {
  if (!payload) return [];
  return payload.teams.flatMap((team) => {
    const comp = exportedTeamToComp(team);
    return comp ? [comp] : [];
  });
}

function getPresetCompIndex(payload: TeamCompData | null): PresetCompIndex {
  const ids: string[] = [];
  const byId = new Map<string, TeamComp>();
  const indexById = new Map<string, number>();
  for (const comp of normalizePresetPayload(payload)) {
    ids.push(comp.id);
    byId.set(comp.id, comp);
    indexById.set(comp.id, ids.length - 1);
  }
  return { ids, byId, indexById };
}

export function isPresetTeamComp(
  deltas: TeamCompDelta[],
  preset: TeamCompData | null,
  teamId: string
): boolean {
  const presetIndex = getPresetCompIndex(preset);
  return (
    presetIndex.byId.has(teamId) ||
    deltas.some((delta) => isPresetDelta(delta) && delta.id === teamId)
  );
}

export function deriveTeamCompsFromDeltas(
  deltas: TeamCompDelta[],
  preset: TeamCompData | null
): TeamComp[] {
  const presetIndex = getPresetCompIndex(preset);
  const deltaIndex = indexTeamCompDeltas(deltas);

  const candidateIds = new Set<string>([
    ...presetIndex.ids,
    ...[...deltaIndex.presetById.values()]
      .filter((delta) => !delta.deleted)
      .map((delta) => delta.id),
    ...deltaIndex.customById.keys(),
  ]);

  const entries: {
    comp: TeamComp;
    displayIndex: number;
    fallbackIndex: number;
  }[] = [];
  let customIndex = 0;
  for (const teamId of candidateIds) {
    const customDelta = deltaIndex.customById.get(teamId);
    const presetDelta = deltaIndex.presetById.get(teamId);
    if (customDelta) {
      const presetIndexForTeam = presetIndex.indexById.get(teamId);
      entries.push({
        comp: customDelta.value,
        displayIndex:
          customDelta.displayIndex ?? CUSTOM_SORT_OFFSET + customIndex,
        fallbackIndex:
          presetIndexForTeam != null
            ? presetIndexForTeam
            : CUSTOM_SORT_OFFSET + customIndex,
      });
      customIndex++;
      continue;
    }
    if (deltaIndex.deletedPresetIds.has(teamId)) continue;
    const presetComp = presetIndex.byId.get(teamId);
    if (!presetComp) continue;
    const presetOrderIndex = presetIndex.indexById.get(teamId) ?? 0;
    entries.push({
      comp: presetComp,
      displayIndex: presetDelta?.displayIndex ?? presetOrderIndex,
      fallbackIndex: presetOrderIndex,
    });
  }

  entries.sort((a, b) => {
    if (a.displayIndex !== b.displayIndex) {
      return a.displayIndex - b.displayIndex;
    }
    return a.fallbackIndex - b.fallbackIndex;
  });

  return entries.map(({ comp }) => comp);
}

export function setTeamDeltaGlobalOrder(
  deltas: TeamCompDelta[],
  orderedIds: string[],
  preset: TeamCompData | null
): TeamCompDelta[] {
  const presetIndex = getPresetCompIndex(preset);
  const deltaIndex = indexTeamCompDeltas(deltas);
  const nextByKey = new Map<string, TeamCompDelta>();
  for (const delta of deltas) {
    nextByKey.set(`${delta.kind}:${delta.id}`, delta);
  }
  for (const id of presetIndex.ids) {
    const delta = nextByKey.get(`preset:${id}`);
    if (delta && isPresetDelta(delta) && !delta.deleted) {
      nextByKey.delete(`preset:${id}`);
    }
  }
  orderedIds.forEach((id, displayIndex) => {
    const customDelta = deltaIndex.customById.get(id);
    if (customDelta) {
      nextByKey.set(`custom:${id}`, {
        ...customDelta,
        displayIndex,
      });
      return;
    }
    if (presetIndex.byId.has(id)) {
      if (presetIndex.indexById.get(id) !== displayIndex) {
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

export function exportedTeamToComp(team: unknown): TeamComp | null {
  if (!team || typeof team !== "object") return null;
  const value = team as Record<string, unknown>;
  if (typeof value.id !== "string") return null;
  if (!Array.isArray(value.characters)) return null;
  const characters = value.characters.map((id) =>
    id == null ? null : String(id)
  );
  const weapons = Array.isArray(value.weapons)
    ? value.weapons.map((id) => (id == null ? null : String(id)))
    : [];
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.map(normalizeArtifactConfig)
    : [];
  const reactions = Array.isArray(value.reactions)
    ? value.reactions.map((reaction) => String(reaction))
    : [];
  return teamArraysToComp({
    id: value.id,
    name: typeof value.name === "string" ? value.name : "",
    characters,
    weapons,
    artifacts,
    reactions: reactions as TeamComp["reactions"],
  });
}

function exportedTeamToSetupConfig(team: unknown): TeamSetupConfig {
  if (!team || typeof team !== "object") return createDefaultTeamSetupConfig();
  const value = team as Record<string, unknown>;
  const charConfigs: Record<string, TeamCharConfig> = {};
  const minEr = value.minEr;
  if (minEr && typeof minEr === "object") {
    for (const [charId, raw] of Object.entries(minEr)) {
      const numeric = toNumber(raw);
      if (numeric != null)
        mergeCharConfig(charConfigs, charId, { minEr: numeric });
    }
  }
  const minCr = value.minCr;
  if (minCr && typeof minCr === "object") {
    for (const [charId, raw] of Object.entries(minCr)) {
      const numeric = toNumber(raw);
      if (numeric != null)
        mergeCharConfig(charConfigs, charId, { minCr: numeric });
    }
  }
  return (
    compactTeamSetupConfig({
      combatOptions: {},
      ...(cleanRecord(charConfigs) ? { charConfigs } : {}),
    }) ?? createDefaultTeamSetupConfig()
  );
}

export function createTeamPersistenceFromImportedData(data: unknown): {
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;
  author: string;
  description: string;
} {
  const payload: {
    teams: unknown[];
    author?: string;
    description?: string;
  } =
    data && typeof data === "object" && !Array.isArray(data)
      ? {
          teams: Array.isArray((data as Partial<TeamCompData>).teams)
            ? ((data as Partial<TeamCompData>).teams ?? [])
            : [],
          author:
            typeof (data as Partial<TeamCompData>).author === "string"
              ? (data as Partial<TeamCompData>).author
              : undefined,
          description:
            typeof (data as Partial<TeamCompData>).description === "string"
              ? (data as Partial<TeamCompData>).description
              : undefined,
        }
      : { teams: Array.isArray(data) ? data : [] };
  const teams = payload.teams;
  let compDeltas: TeamCompDelta[] = [];
  const configsByTeamId: Record<string, TeamSetupConfig> = {};
  teams.forEach((team, displayIndex) => {
    const comp = exportedTeamToComp(team);
    if (!comp) return;
    compDeltas = upsertCustomTeamCompDelta(compDeltas, comp, displayIndex);
    configsByTeamId[comp.id] = exportedTeamToSetupConfig(team);
  });
  return {
    compDeltas,
    configsByTeamId: compactTeamSetupConfigs(configsByTeamId),
    author: payload.author ?? "",
    description: payload.description ?? "",
  };
}

export function createTeamSetupConfigsFromPresetPayload(
  payload: TeamCompData
): Record<string, TeamSetupConfig> {
  const configsByTeamId: Record<string, TeamSetupConfig> = {};
  for (const team of payload.teams) {
    const comp = exportedTeamToComp(team);
    if (!comp) continue;
    configsByTeamId[comp.id] = exportedTeamToSetupConfig(team);
  }
  return compactTeamSetupConfigs(configsByTeamId);
}

export function teamCompToExportedTeam(comp: TeamComp): ExportedTeam {
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  const entry: ExportedTeam = {
    id: comp.id,
    name: comp.name,
    characters,
    weapons,
    artifacts: artifacts.map(exportArtifactConfig),
  };
  if (comp.reactions.length > 0) entry.reactions = comp.reactions;
  return entry;
}
