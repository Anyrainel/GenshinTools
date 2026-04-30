import type { ArtifactSetConfig } from "@/data/types";
import {
  isCustomDelta,
  isPresetDelta,
  type PresetDelta,
} from "@/lib/presetDelta";
import type {
  AnalyzerConfig,
  CharSettings,
  ExportedArtifact,
  ExportedTeam,
  Team,
  TeamCharConfig,
  TeamComp,
  TeamCompData,
  TeamConfig,
} from "@/lib/team-comp/types";

export type TeamCompDelta = PresetDelta<TeamComp>;

export type TeamRuntimeCache = Pick<
  Team,
  "optimizationResult" | "choiceResults" | "weaponChoiceResult"
>;

const MAX_TEAM_SLOTS = 4;
const CUSTOM_SORT_OFFSET = 1_000_000;

type LegacyTeamPatchKeys =
  | "name"
  | "characters"
  | "weapons"
  | "artifacts"
  | "reactions"
  | "opts"
  | "calcContext"
  | "enemyAura"
  | "extraBuffs"
  | "selectedFormula"
  | "singleReaction"
  | "singleForceOnField"
  | "formulaMode"
  | "combo"
  | "charSettings"
  | "erTimelines"
  | "analyzer"
  | "comp"
  | "config";

const COMP_PATCH_KEYS = new Set<LegacyTeamPatchKeys>([
  "name",
  "characters",
  "weapons",
  "artifacts",
  "reactions",
  "comp",
]);

const CONFIG_PATCH_KEYS = new Set<LegacyTeamPatchKeys>([
  "opts",
  "calcContext",
  "enemyAura",
  "extraBuffs",
  "selectedFormula",
  "singleReaction",
  "singleForceOnField",
  "formulaMode",
  "combo",
  "charSettings",
  "erTimelines",
  "analyzer",
  "config",
]);

export function hasTeamCompPatch(patch: Partial<Team>): boolean {
  return Object.keys(patch).some((key) =>
    COMP_PATCH_KEYS.has(key as LegacyTeamPatchKeys)
  );
}

export function hasTeamConfigPatch(patch: Partial<Team>): boolean {
  return Object.keys(patch).some((key) =>
    CONFIG_PATCH_KEYS.has(key as LegacyTeamPatchKeys)
  );
}

export function hasTeamRuntimeCachePatch(patch: Partial<Team>): boolean {
  return (
    "optimizationResult" in patch ||
    "choiceResults" in patch ||
    "weaponChoiceResult" in patch
  );
}

function cleanRecord<T>(
  record: Record<string, T>
): Record<string, T> | undefined {
  return Object.keys(record).length > 0 ? record : undefined;
}

function cleanObject<T extends object>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toOptionString(value: unknown): string {
  return typeof value === "string" ? value : String(value);
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

export function legacyArraysToTeamComp({
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

export function createDefaultTeamConfig(): TeamConfig {
  return { combatOptions: {} };
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

function splitLegacyCombatOptions(opts: unknown): {
  combatOptions: TeamConfig["combatOptions"];
  charConfigs?: Record<string, TeamCharConfig>;
} {
  const combatOptions: TeamConfig["combatOptions"] = {};
  const charConfigs: Record<string, TeamCharConfig> = {};
  if (!opts || typeof opts !== "object") {
    return { combatOptions };
  }

  for (const [key, value] of Object.entries(opts as Record<string, unknown>)) {
    const match = key.match(
      /^(.+)\.override(Level|Constellation|Refinement|TalentAuto|TalentSkill|TalentBurst)$/
    );
    if (!match) {
      combatOptions[key] = toOptionString(value);
      continue;
    }

    const [, charId, field] = match;
    const numeric = toNumber(value);
    if (numeric == null) continue;

    if (field === "Level") {
      mergeCharConfig(charConfigs, charId, { level: numeric });
    } else if (field === "Constellation") {
      mergeCharConfig(charConfigs, charId, { constellation: numeric });
    } else if (field === "Refinement") {
      mergeCharConfig(charConfigs, charId, { refinement: numeric });
    } else if (field === "TalentAuto") {
      mergeCharConfig(charConfigs, charId, { talentLevels: { auto: numeric } });
    } else if (field === "TalentSkill") {
      mergeCharConfig(charConfigs, charId, {
        talentLevels: { skill: numeric },
      });
    } else if (field === "TalentBurst") {
      mergeCharConfig(charConfigs, charId, {
        talentLevels: { burst: numeric },
      });
    }
  }

  return { combatOptions, charConfigs: cleanRecord(charConfigs) };
}

function legacyCharSettingsToCharConfigs(
  settings: Team["charSettings"]
): Record<string, TeamCharConfig> | undefined {
  if (!settings) return undefined;
  const result: Record<string, TeamCharConfig> = {};
  for (const [charId, value] of Object.entries(settings)) {
    const next: TeamCharConfig = {};
    if (value.minEr != null) next.minEr = value.minEr;
    if (value.minCr != null) next.minCr = value.minCr;
    if (value.crMode != null) next.crMode = value.crMode;
    if (value.tierAwarePool != null) next.tierAwarePool = value.tierAwarePool;
    const fullSetOptional =
      value.fullSetOptional ?? value.ignoreArtifactSets ?? undefined;
    if (fullSetOptional != null) next.fullSetOptional = fullSetOptional;
    if (Object.keys(next).length > 0) result[charId] = next;
  }
  return cleanRecord(result);
}

function mergeCharConfigRecords(
  first?: Record<string, TeamCharConfig>,
  second?: Record<string, TeamCharConfig>
): Record<string, TeamCharConfig> | undefined {
  const result: Record<string, TeamCharConfig> = {};
  for (const source of [first, second]) {
    if (!source) continue;
    for (const [charId, config] of Object.entries(source)) {
      mergeCharConfig(result, charId, config);
    }
  }
  return cleanRecord(result);
}

export function teamCharConfigsToLegacyOptions(
  config: TeamConfig
): TeamConfig["combatOptions"] {
  const opts: TeamConfig["combatOptions"] = { ...(config.combatOptions ?? {}) };
  for (const [charId, charConfig] of Object.entries(config.charConfigs ?? {})) {
    if (charConfig.level != null) {
      opts[`${charId}.overrideLevel`] = String(charConfig.level);
    }
    if (charConfig.constellation != null) {
      opts[`${charId}.overrideConstellation`] = String(
        charConfig.constellation
      );
    }
    if (charConfig.refinement != null) {
      opts[`${charId}.overrideRefinement`] = String(charConfig.refinement);
    }
    if (charConfig.talentLevels?.auto != null) {
      opts[`${charId}.overrideTalentAuto`] = String(
        charConfig.talentLevels.auto
      );
    }
    if (charConfig.talentLevels?.skill != null) {
      opts[`${charId}.overrideTalentSkill`] = String(
        charConfig.talentLevels.skill
      );
    }
    if (charConfig.talentLevels?.burst != null) {
      opts[`${charId}.overrideTalentBurst`] = String(
        charConfig.talentLevels.burst
      );
    }
  }
  return opts;
}

export function teamCharConfigsToLegacyCharSettings(
  charConfigs?: Record<string, TeamCharConfig>
): Record<string, CharSettings> | undefined {
  if (!charConfigs) return undefined;
  const result: Record<string, CharSettings> = {};
  for (const [charId, config] of Object.entries(charConfigs)) {
    const settings: CharSettings = {};
    if (config.minEr != null) settings.minEr = config.minEr;
    if (config.minCr != null) settings.minCr = config.minCr;
    if (config.crMode != null) settings.crMode = config.crMode;
    if (config.tierAwarePool != null)
      settings.tierAwarePool = config.tierAwarePool;
    if (config.fullSetOptional != null)
      settings.fullSetOptional = config.fullSetOptional;
    if (Object.keys(settings).length > 0) result[charId] = settings;
  }
  return cleanRecord(result);
}

export function normalizeTeamConfig(
  config: Partial<TeamConfig> = {}
): TeamConfig {
  return {
    combatOptions: { ...(config.combatOptions ?? {}) },
    ...(config.charConfigs ? { charConfigs: config.charConfigs } : {}),
    ...(config.damage ? { damage: config.damage } : {}),
    ...(config.energy ? { energy: config.energy } : {}),
    ...(config.investment ? { investment: config.investment } : {}),
  };
}

export function legacyTeamToComp(
  team: Partial<Team> & { id: string }
): TeamComp {
  if (!team.characters && !team.weapons && !team.artifacts && team.comp) {
    return {
      ...team.comp,
      id: team.id,
      name: team.name ?? team.comp.name ?? "",
      reactions: [...(team.reactions ?? team.comp.reactions ?? [])],
      slots: trimTrailingEmptySlots(team.comp.slots ?? []),
    };
  }
  return legacyArraysToTeamComp({
    id: team.id,
    name: team.name ?? "",
    characters: team.characters ?? [],
    weapons: team.weapons ?? [],
    artifacts: team.artifacts ?? [],
    reactions: team.reactions ?? [],
  });
}

export function legacyTeamToConfig(team: Partial<Team>): TeamConfig {
  const base = normalizeTeamConfig(team.config ?? {});
  const split = splitLegacyCombatOptions(team.opts ?? base.combatOptions);
  const charConfigs = mergeCharConfigRecords(
    base.charConfigs,
    mergeCharConfigRecords(
      split.charConfigs,
      legacyCharSettingsToCharConfigs(team.charSettings)
    )
  );

  const damage = {
    ...(base.damage ?? {}),
    ...(team.calcContext ? { calcContext: team.calcContext } : {}),
    ...(team.enemyAura != null ? { enemyAura: team.enemyAura } : {}),
    ...(team.extraBuffs && team.extraBuffs.length > 0
      ? { extraBuffs: team.extraBuffs }
      : {}),
    ...(team.selectedFormula !== undefined
      ? { selectedFormula: team.selectedFormula }
      : {}),
    ...(team.singleReaction !== undefined
      ? { singleReaction: team.singleReaction }
      : {}),
    ...(team.singleForceOnField !== undefined
      ? { singleForceOnField: team.singleForceOnField }
      : {}),
    ...(team.formulaMode !== undefined
      ? { formulaMode: team.formulaMode }
      : {}),
    ...(team.combo !== undefined ? { combo: team.combo } : {}),
  };

  const energy = {
    ...(base.energy ?? {}),
    ...(team.erTimelines && team.erTimelines.length > 0
      ? { timelines: team.erTimelines }
      : {}),
  };

  const investment = (team.analyzer ?? base.investment) as
    | AnalyzerConfig
    | undefined;

  return normalizeTeamConfig({
    combatOptions: split.combatOptions,
    ...(charConfigs ? { charConfigs } : {}),
    ...(cleanObject(damage) ? { damage } : {}),
    ...(cleanObject(energy) ? { energy } : {}),
    ...(investment ? { investment } : {}),
  });
}

export function projectRuntimeTeam(
  comp: TeamComp,
  config: TeamConfig = createDefaultTeamConfig(),
  cache?: Partial<TeamRuntimeCache>
): Team {
  const normalizedConfig = normalizeTeamConfig(config);
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  const damage = normalizedConfig.damage ?? {};
  const charSettings = teamCharConfigsToLegacyCharSettings(
    normalizedConfig.charConfigs
  );

  return {
    id: comp.id,
    name: comp.name,
    comp,
    config: normalizedConfig,
    characters,
    weapons,
    artifacts,
    reactions: comp.reactions ?? [],
    opts: teamCharConfigsToLegacyOptions(normalizedConfig),
    calcContext: damage.calcContext ?? {},
    enemyAura: damage.enemyAura,
    extraBuffs: damage.extraBuffs ?? [],
    selectedFormula: damage.selectedFormula ?? null,
    singleReaction: damage.singleReaction,
    singleForceOnField: damage.singleForceOnField,
    formulaMode: damage.formulaMode ?? "single",
    combo: damage.combo ?? null,
    ...(charSettings ? { charSettings } : {}),
    erTimelines: normalizedConfig.energy?.timelines,
    optimizationResult: cache?.optimizationResult ?? null,
    choiceResults: cache?.choiceResults,
    weaponChoiceResult: cache?.weaponChoiceResult ?? null,
    analyzer: normalizedConfig.investment,
  };
}

export function getTeamRuntimeCacheById(
  teams: Team[]
): Record<string, TeamRuntimeCache> {
  const cacheById: Record<string, TeamRuntimeCache> = {};
  for (const team of teams) {
    cacheById[team.id] = {
      optimizationResult: team.optimizationResult ?? null,
      choiceResults: team.choiceResults,
      weaponChoiceResult: team.weaponChoiceResult ?? null,
    };
  }
  return cacheById;
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
  const deletedPresetIds = new Set(
    deltas
      .filter((delta) => isPresetDelta(delta) && delta.deleted)
      .map((delta) => delta.id)
  );
  const matchedPresetIds = new Set<string>();
  const idMap: Record<string, string> = {};
  let next: TeamCompDelta[] = deltas.filter(isPresetDelta);

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
      next = upsertPresetTeamCompDelta(next, matchingPreset.id, {
        ...(delta.displayIndex != null
          ? { displayIndex: delta.displayIndex }
          : {}),
      });
      continue;
    }

    next = upsertCustomTeamCompDelta(next, delta.value, delta.displayIndex);
  }

  return { deltas: next, idMap };
}

function normalizePresetPayload(payload: TeamCompData | null): TeamComp[] {
  if (!payload) return [];
  return payload.teams.flatMap((team) => {
    const comp = exportedTeamToComp(team);
    return comp ? [comp] : [];
  });
}

function getPresetCompMap(
  payload: TeamCompData | null
): Record<string, TeamComp> {
  const comps: Record<string, TeamComp> = {};
  for (const comp of normalizePresetPayload(payload)) {
    comps[comp.id] = comp;
  }
  return comps;
}

function getPresetTeamIds(payload: TeamCompData | null): string[] {
  return normalizePresetPayload(payload).map((comp) => comp.id);
}

export function isPresetTeamComp(
  deltas: TeamCompDelta[],
  preset: TeamCompData | null,
  teamId: string
): boolean {
  const presetMap = getPresetCompMap(preset);
  return (
    presetMap[teamId] != null ||
    deltas.some((delta) => isPresetDelta(delta) && delta.id === teamId)
  );
}

export function deriveTeamRuntimeFromDeltas(
  deltas: TeamCompDelta[],
  configsByTeamId: Record<string, TeamConfig>,
  preset: TeamCompData | null,
  cacheByTeamId: Record<string, TeamRuntimeCache> = {}
): Team[] {
  const presetMap = getPresetCompMap(preset);
  const presetIds = getPresetTeamIds(preset);
  const deletedPresetIds = new Set(
    deltas
      .filter((delta) => isPresetDelta(delta) && delta.deleted)
      .map((delta) => delta.id)
  );
  const customDeltas = deltas.filter(isCustomDelta);
  const presetDeltaIds = deltas
    .filter((delta) => isPresetDelta(delta) && !delta.deleted)
    .map((delta) => delta.id);

  const candidateIds = new Set<string>([
    ...presetIds,
    ...presetDeltaIds,
    ...customDeltas.map((delta) => delta.id),
  ]);

  const entries: {
    comp: TeamComp;
    displayIndex: number;
    fallbackIndex: number;
  }[] = [];
  let customIndex = 0;
  for (const teamId of candidateIds) {
    const customDelta = customDeltas.find((delta) => delta.id === teamId);
    const presetDelta = deltas.find(
      (delta) => isPresetDelta(delta) && delta.id === teamId
    );
    if (customDelta) {
      entries.push({
        comp: customDelta.value,
        displayIndex:
          customDelta.displayIndex ?? CUSTOM_SORT_OFFSET + customIndex,
        fallbackIndex: presetIds.includes(teamId)
          ? presetIds.indexOf(teamId)
          : CUSTOM_SORT_OFFSET + customIndex,
      });
      customIndex++;
      continue;
    }
    if (deletedPresetIds.has(teamId)) continue;
    const presetComp = presetMap[teamId];
    if (!presetComp) continue;
    const presetIndex = presetIds.indexOf(teamId);
    entries.push({
      comp: presetComp,
      displayIndex: presetDelta?.displayIndex ?? presetIndex,
      fallbackIndex: presetIndex,
    });
  }

  entries.sort((a, b) => {
    if (a.displayIndex !== b.displayIndex) {
      return a.displayIndex - b.displayIndex;
    }
    return a.fallbackIndex - b.fallbackIndex;
  });

  return entries.map(({ comp }) =>
    projectRuntimeTeam(comp, configsByTeamId[comp.id], cacheByTeamId[comp.id])
  );
}

export function setTeamDeltaGlobalOrder(
  deltas: TeamCompDelta[],
  orderedIds: string[],
  preset: TeamCompData | null
): TeamCompDelta[] {
  const presetMap = getPresetCompMap(preset);
  let next = deltas;
  orderedIds.forEach((id, displayIndex) => {
    const customDelta = next.find(
      (delta) => isCustomDelta(delta) && delta.id === id
    );
    if (customDelta && isCustomDelta(customDelta)) {
      next = upsertCustomTeamCompDelta(next, customDelta.value, displayIndex);
      return;
    }
    if (presetMap[id]) {
      next = upsertPresetTeamCompDelta(next, id, { displayIndex });
    }
  });
  return next;
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
  return legacyArraysToTeamComp({
    id: value.id,
    name: typeof value.name === "string" ? value.name : "",
    characters,
    weapons,
    artifacts,
    reactions: reactions as TeamComp["reactions"],
  });
}

function exportedTeamToConfig(team: unknown): TeamConfig {
  if (!team || typeof team !== "object") return createDefaultTeamConfig();
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
  return normalizeTeamConfig({
    combatOptions: {},
    ...(cleanRecord(charConfigs) ? { charConfigs } : {}),
  });
}

export function createTeamPersistenceFromImportedData(data: unknown): {
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamConfig>;
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
  const configsByTeamId: Record<string, TeamConfig> = {};
  teams.forEach((team, displayIndex) => {
    const comp = exportedTeamToComp(team);
    if (!comp) return;
    compDeltas = upsertCustomTeamCompDelta(compDeltas, comp, displayIndex);
    configsByTeamId[comp.id] = exportedTeamToConfig(team);
  });
  return {
    compDeltas,
    configsByTeamId,
    author: payload.author ?? "",
    description: payload.description ?? "",
  };
}

export function createTeamPersistenceFromLegacyTeams(teams: Team[]): {
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamConfig>;
} {
  let compDeltas: TeamCompDelta[] = [];
  const configsByTeamId: Record<string, TeamConfig> = {};
  teams.forEach((team, displayIndex) => {
    const comp = legacyTeamToComp(team);
    compDeltas = upsertCustomTeamCompDelta(compDeltas, comp, displayIndex);
    configsByTeamId[team.id] = legacyTeamToConfig(team);
  });
  return { compDeltas, configsByTeamId };
}

export function createTeamConfigsFromPresetPayload(
  payload: TeamCompData
): Record<string, TeamConfig> {
  const configsByTeamId: Record<string, TeamConfig> = {};
  for (const team of payload.teams) {
    const comp = exportedTeamToComp(team);
    if (!comp) continue;
    configsByTeamId[comp.id] = exportedTeamToConfig(team);
  }
  return configsByTeamId;
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
