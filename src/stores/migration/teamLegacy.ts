import type { Element, ReactionType } from "@/data/enums";
import type { ArtifactSetConfig } from "@/data/types";
import type {
  CalcContext,
  ComboFormula,
  ExtraBuff,
  OptionMap,
  ReactionOverride,
} from "@/lib/dmgcalc/types";
import type { ERTimeline } from "@/lib/ercalc/types";
import {
  normalizeTeamSetupConfig,
  type TeamCompDelta,
  teamArraysToComp,
  upsertCustomTeamCompDelta,
} from "@/lib/team-comp/teamDeltas";
import type {
  AnalyzerConfig,
  TeamCharConfig,
  TeamComp,
  TeamSetupConfig,
} from "@/lib/team-comp/types";

/**
 * Old persisted Zustand/localStorage team shape before team.comp/team.config
 * became separate source-of-truth models. This is not the public team import
 * JSON shape; import/export uses TeamCompData.
 */
export interface LegacyPersistedTeam {
  id: string;
  name?: string;
  comp?: TeamComp;
  config?: TeamSetupConfig;
  characters?: (string | null)[];
  weapons?: (string | null)[];
  artifacts?: (ArtifactSetConfig | null)[];
  reactions?: ReactionType[];
  opts?: OptionMap;
  calcContext?: Partial<CalcContext>;
  enemyAura?: Element;
  extraBuffs?: ExtraBuff[];
  selectedFormula?: { charId: string; formulaId: string } | null;
  singleReaction?: ReactionOverride;
  singleForceOnField?: boolean;
  formulaMode?: "single" | "combo";
  combo?: ComboFormula | null;
  charSettings?: Record<string, LegacyCharSettings>;
  erTimelines?: ERTimeline[];
  analyzer?: AnalyzerConfig;
}

export interface LegacyCharSettings {
  minEr?: number;
  minCr?: number;
  crMode?: "min" | "target";
  tierAwarePool?: boolean;
  fullSetOptional?: boolean;
  ignoreArtifactSets?: boolean;
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

function trimTrailingEmptySlots(slots: TeamComp["slots"]): TeamComp["slots"] {
  let last = slots.length - 1;
  while (last >= 0) {
    const slot = slots[last];
    if (slot.charId || slot.weaponId || slot.artifactSet) break;
    last--;
  }
  return slots.slice(0, last + 1);
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
  combatOptions: TeamSetupConfig["combatOptions"];
  charConfigs?: Record<string, TeamCharConfig>;
} {
  const combatOptions: TeamSetupConfig["combatOptions"] = {};
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
  settings: LegacyPersistedTeam["charSettings"]
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

export function legacyTeamToComp(
  team: Partial<LegacyPersistedTeam> & { id: string }
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
  return teamArraysToComp({
    id: team.id,
    name: team.name ?? "",
    characters: team.characters ?? [],
    weapons: team.weapons ?? [],
    artifacts: team.artifacts ?? [],
    reactions: team.reactions ?? [],
  });
}

export function legacyTeamToSetupConfig(
  team: Partial<LegacyPersistedTeam>
): TeamSetupConfig {
  const base = normalizeTeamSetupConfig(team.config ?? {});
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

  return normalizeTeamSetupConfig({
    combatOptions: split.combatOptions,
    ...(charConfigs ? { charConfigs } : {}),
    ...(cleanObject(damage) ? { damage } : {}),
    ...(cleanObject(energy) ? { energy } : {}),
    ...(investment ? { investment } : {}),
  });
}

export function createTeamPersistenceFromLegacyTeams(
  teams: LegacyPersistedTeam[]
): {
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;
} {
  let compDeltas: TeamCompDelta[] = [];
  const configsByTeamId: Record<string, TeamSetupConfig> = {};
  teams.forEach((team, displayIndex) => {
    const comp = legacyTeamToComp(team);
    compDeltas = upsertCustomTeamCompDelta(compDeltas, comp, displayIndex);
    configsByTeamId[team.id] = legacyTeamToSetupConfig(team);
  });
  return { compDeltas, configsByTeamId };
}
