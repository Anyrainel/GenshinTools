import {
  artifactHalfSetsById,
  artifactIdToHalfSetId,
  artifactsById,
} from "@/data/constants";
import type {
  AccountData,
  ArtifactData,
  Slot,
  TierAssignment,
} from "@/data/types";
import { allSlots } from "@/data/types";
import { getCharacterLevelTier } from "@/lib/gameStatsLoader";
import type {
  ArtifactSetConfig,
  TalentLevels,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { getHalfSetIds, getSetId } from "@/lib/team-comp/types";
import type { Team, WeaponChoiceCharConfig } from "@/stores/useTeamStore";
import { StatSheet } from "./calc/statSheet";

/** Detect what artifact set bonuses the equipped pieces actually form. */
export function detectEquippedSets(
  artifacts: (ArtifactData | null | undefined)[]
): ArtifactSetConfig | null {
  const setCounts: Record<string, number> = {};
  for (const art of artifacts) {
    if (!art) continue;
    setCounts[art.setKey] = (setCounts[art.setKey] || 0) + 1;
  }

  // 4pc check
  for (const [setKey, count] of Object.entries(setCounts)) {
    if (count >= 4) {
      return { type: "4pc", setId: setKey };
    }
  }

  // 2pc+2pc check
  const twoPcSets = Object.entries(setCounts)
    .filter(([, count]) => count >= 2)
    .map(([setKey]) => setKey);

  if (twoPcSets.length >= 2) {
    const halfSetIds = twoPcSets
      .slice(0, 2)
      .map((setKey) => {
        const hsId = artifactIdToHalfSetId[setKey];
        return hsId ?? "";
      })
      .filter(Boolean);
    if (halfSetIds.length === 2) {
      return { type: "2pc+2pc", halfSetIds: halfSetIds as [string, string] };
    }
  }

  // Single 2pc — no full config to return
  return null;
}

/**
 * Check whether a frozen character's artifacts match the given team artifact config.
 * Used by forceReuse mode to decide if the frozen artifacts should be reused as-is.
 */
export function frozenArtifactsMatchConfig(
  frozenArts: Record<Slot, ArtifactData | null>,
  goalConfig: ArtifactSetConfig | null
): boolean {
  if (!goalConfig) return false;
  const equipped = detectEquippedSets(allSlots.map((s) => frozenArts[s]));
  return setsMatch(goalConfig, equipped);
}

/** Check if equipped sets match the goal sets from team config. */
export function setsMatch(
  goal: ArtifactSetConfig | null | undefined,
  equipped: ArtifactSetConfig | null
): boolean {
  if (!goal) return true;
  if (goal.type === "4pc") {
    return equipped?.type === "4pc" && equipped.setId === goal.setId;
  }
  if (goal.type === "2pc+2pc") {
    if (equipped?.type !== "2pc+2pc") return false;
    const goalIds = [...goal.halfSetIds].sort();
    const eqIds = [...equipped.halfSetIds].sort();
    return goalIds[0] === eqIds[0] && goalIds[1] === eqIds[1];
  }
  return true;
}

interface CharBaseConfig {
  charLevel: number;
  constellation: number;
  acctTalent: TalentLevels | undefined;
}

/**
 * Resolve a character's level, constellation, and raw talent data from
 * account data + team overrides.  Shared by buildTeamConfigs and
 * buildWeaponChoiceCharConfigs.
 */
function resolveCharBaseConfig(
  charId: string,
  team: Team,
  accountData: AccountData | null
): CharBaseConfig {
  const acctChar = accountData?.characters.find((c) => c.key === charId);
  const defaultLevel = acctChar
    ? Number(getCharacterLevelTier(acctChar.level))
    : 90;
  const defaultConst = acctChar ? acctChar.constellation : 0;

  const charLevel =
    team.opts?.[`${charId}.overrideLevel`] !== undefined
      ? Number(team.opts[`${charId}.overrideLevel`])
      : defaultLevel;
  const constellation =
    team.opts?.[`${charId}.overrideConstellation`] !== undefined
      ? Number(team.opts[`${charId}.overrideConstellation`])
      : defaultConst;

  return { charLevel, constellation, acctTalent: acctChar?.talent };
}

/**
 * Resolve talent-level overrides for a character.  Returns the merged talent
 * levels when any override is present, or the provided fallback otherwise.
 */
function resolveTalentOverrides(
  charId: string,
  team: Team,
  acctTalent: TalentLevels | undefined,
  fallback: TalentLevels | undefined
): TalentLevels | undefined {
  const overrideAuto = team.opts?.[`${charId}.overrideTalentAuto`];
  const overrideSkill = team.opts?.[`${charId}.overrideTalentSkill`];
  const overrideBurst = team.opts?.[`${charId}.overrideTalentBurst`];
  if (
    overrideAuto === undefined &&
    overrideSkill === undefined &&
    overrideBurst === undefined
  ) {
    return fallback;
  }
  const base = acctTalent ?? { auto: 10, skill: 10, burst: 10 };
  return {
    auto: overrideAuto !== undefined ? Number(overrideAuto) : base.auto,
    skill: overrideSkill !== undefined ? Number(overrideSkill) : base.skill,
    burst: overrideBurst !== undefined ? Number(overrideBurst) : base.burst,
  };
}

/** Resolve the effective refinement for a weapon, checking account data + overrides. */
function resolveRefinement(
  charId: string,
  weaponId: string,
  team: Team,
  accountData: AccountData | null
): number {
  let defaultRefine = 1;
  if (accountData) {
    const refinements: number[] = [];
    for (const c of accountData.characters) {
      if (c.weapon?.key === weaponId) refinements.push(c.weapon.refinement);
    }
    for (const w of accountData.extraWeapons) {
      if (w.key === weaponId) refinements.push(w.refinement);
    }
    if (refinements.length > 0) defaultRefine = Math.max(...refinements);
  }
  return team.opts?.[`${charId}.overrideRefinement`] !== undefined
    ? Number(team.opts[`${charId}.overrideRefinement`])
    : defaultRefine;
}

/**
 * Build TeamBuild configs using ACTUAL equipped artifact sets (for accurate
 * damage calc). Falls back to goal sets if no artifacts are equipped.
 */
export function buildTeamConfigs(
  team: Team,
  accountData: AccountData | null
): TeamSlotConfig[] {
  const configs: TeamSlotConfig[] = [];
  for (let i = 0; i < 4; i++) {
    const charId = team.characters[i];
    if (!charId) continue;
    if (!team.weapons[i]) continue; // wait for weapon to be selected

    const { charLevel, constellation, acctTalent } = resolveCharBaseConfig(
      charId,
      team,
      accountData
    );

    const weaponId = team.weapons[i]!;
    const refinement = resolveRefinement(charId, weaponId, team, accountData);

    let artifactSet: ArtifactSetConfig | null = null;

    const artConfig = team.artifacts[i];
    if (artConfig) {
      if (artConfig.type === "4pc") {
        artifactSet = { type: "4pc", setId: artConfig.setId };
      } else if (artConfig.type === "2pc+2pc") {
        artifactSet = {
          type: "2pc+2pc",
          halfSetIds: artConfig.halfSetIds,
        };
      }
    }

    const talentLevels = resolveTalentOverrides(
      charId,
      team,
      acctTalent,
      acctTalent
    );

    configs.push({
      charId,
      charLevel,
      constellation,
      weaponId,
      refinement,
      artifactSet,
      talentLevels,
    });
  }
  return configs;
}

/**
 * Build WeaponChoiceCharConfig[] from the team's opts, minEr, minCr, and artifacts.
 * This derives the same values that TeamRosterCard displays, so the weapon choice
 * computation uses exactly what the user sees.
 */
export function buildWeaponChoiceCharConfigs(
  team: Team,
  accountData: AccountData | null
): WeaponChoiceCharConfig[] {
  const configs: WeaponChoiceCharConfig[] = [];
  for (let i = 0; i < 4; i++) {
    const charId = team.characters[i];
    if (!charId) continue;

    const { charLevel, constellation, acctTalent } = resolveCharBaseConfig(
      charId,
      team,
      accountData
    );

    const baseTalent = acctTalent ?? { auto: 10, skill: 10, burst: 10 };
    const overrideAuto = team.opts?.[`${charId}.overrideTalentAuto`];
    const overrideSkill = team.opts?.[`${charId}.overrideTalentSkill`];
    const overrideBurst = team.opts?.[`${charId}.overrideTalentBurst`];
    const talentLevels: [number, number, number] = [
      overrideAuto !== undefined && overrideAuto !== ""
        ? Number(overrideAuto)
        : baseTalent.auto,
      overrideSkill !== undefined && overrideSkill !== ""
        ? Number(overrideSkill)
        : baseTalent.skill,
      overrideBurst !== undefined && overrideBurst !== ""
        ? Number(overrideBurst)
        : baseTalent.burst,
    ];

    configs.push({
      charId,
      level: charLevel,
      constellation,
      talentLevels,
      artifactConfig: team.artifacts[i] ?? null,
      minEr: team.charSettings?.[charId]?.minEr ?? 1,
      minCr: team.charSettings?.[charId]?.minCr ?? 0,
    });
  }
  return configs;
}

// ─── Damage calculation helpers ──────────────────────────────────────────────

/** Build StatSheet map from a charId→artifacts record. */
export function toStatSheets(
  charIds: (string | null)[],
  artsByChar: Record<string, Record<string, ArtifactData>>
): Record<string, StatSheet> {
  const sheets: Record<string, StatSheet> = {};
  for (const charId of charIds) {
    if (!charId) continue;
    sheets[charId] = StatSheet.fromArtifacts(
      Object.values(artsByChar[charId] || {})
    );
  }
  return sheets;
}

/**
 * Collect artifact IDs equipped by characters in higher tiers than the given character.
 * Used for tier-aware pool exclusion in the optimizer.
 *
 * Tier order (highest to lowest): S, A, B, C, D, Pool.
 * Characters without a tier assignment are treated as "Pool" (lowest tier).
 */
export function getHigherTierEquippedArtifactIds(
  charId: string,
  tierAssignments: TierAssignment,
  accountData: AccountData
): Set<string> {
  const tierOrder: readonly string[] = ["S", "A", "B", "C", "D", "Pool"];
  const charTier = tierAssignments[charId]?.tier ?? "Pool";
  const charTierIdx = tierOrder.indexOf(charTier);

  const excludedIds = new Set<string>();
  for (const c of accountData.characters) {
    if (c.key === charId) continue;
    const otherTier = tierAssignments[c.key]?.tier ?? "Pool";
    const otherIdx = tierOrder.indexOf(otherTier);
    // Lower index = higher tier. Only exclude if strictly higher.
    if (otherIdx < charTierIdx) {
      for (const art of Object.values(c.artifacts ?? {})) {
        if (art?.id) excludedIds.add(art.id);
      }
    }
  }
  return excludedIds;
}
export function resolveBuildInfo(
  charId: string,
  team: Team,
  accountData: AccountData | null
) {
  const { charLevel, constellation: charConst } = resolveCharBaseConfig(
    charId,
    team,
    accountData
  );
  const idx = team.characters.indexOf(charId);
  const weaponId = idx >= 0 ? team.weapons[idx] : null;
  const weaponRefine = weaponId
    ? resolveRefinement(charId, weaponId, team, accountData)
    : 1;
  const artConfig = idx >= 0 ? team.artifacts[idx] : null;
  return { charLevel, charConst, weaponId, weaponRefine, artConfig };
}

/**
 * Derive per-slot artifact set keys from a list of configs that describe
 * 4pc or 2pc+2pc set assignments. Shared between generator and weapon choice.
 */
export function deriveSetKeysFromConfigs(
  configs: {
    charId: string;
    artifactSet?: ArtifactSetConfig | null;
  }[]
): Record<string, Record<Slot, string>> {
  const result: Record<string, Record<Slot, string>> = {};
  for (const cfg of configs) {
    const setId = getSetId(cfg.artifactSet);
    const halfSetIds = getHalfSetIds(cfg.artifactSet);
    if (setId) {
      result[cfg.charId] = {
        flower: setId,
        plume: setId,
        sands: setId,
        goblet: setId,
        circlet: setId,
      };
    } else if (halfSetIds.length === 2) {
      const hs1 = artifactHalfSetsById[halfSetIds[0]];
      const hs2 = artifactHalfSetsById[halfSetIds[1]];
      const sk1 =
        hs1?.setIds.find((id: string) => artifactsById[id]?.rarity === 5) ??
        hs1?.setIds[0] ??
        "generated";
      const sk2 =
        hs2?.setIds.find(
          (id: string) => artifactsById[id]?.rarity === 5 && id !== sk1
        ) ??
        hs2?.setIds.find((id: string) => id !== sk1) ??
        hs2?.setIds[0] ??
        "generated";
      result[cfg.charId] = {
        flower: sk1,
        plume: sk1,
        sands: sk1,
        goblet: sk2,
        circlet: sk2,
      };
    }
  }
  return result;
}
