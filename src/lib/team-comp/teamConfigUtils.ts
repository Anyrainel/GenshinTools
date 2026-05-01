import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import {
  artifactHalfSetsById,
  artifactIdToHalfSetId,
  artifactsById,
} from "@/data/gameResources";
import { getCharacterLevelTier } from "@/data/gameStatsLoader";
import type {
  AccountData,
  ArtifactData,
  ArtifactSetConfig,
  TierAssignment,
} from "@/data/types";
import type {
  CharBaseConfig,
  TeamCharConfig,
  TeamComp,
  TeamDamageConfig,
  TeamSetupConfig,
  WeaponChoiceCharConfig,
} from "@/lib/team-comp/types";
import { EMPTY_LABEL } from "../dmgcalc/core/combo";
import { StatSheet } from "../dmgcalc/core/statSheet";
import type {
  ComboFormula,
  ComboLine,
  TalentLevels,
  TeamSlotConfig,
} from "../dmgcalc/types";
import { getHalfSetIds, getSetId } from "../dmgcalc/utils";
import { teamCompToArrays } from "./teamDeltas";

type FormulaSelection = { charId: string; formulaId: string };

export function resolveSelectedFormula(
  selectedFormula: FormulaSelection | null | undefined,
  allFormulas: readonly FormulaSelection[]
): FormulaSelection | null {
  if (!selectedFormula) return allFormulas[0] ?? null;
  const isValid = allFormulas.some(
    (formula) =>
      formula.charId === selectedFormula.charId &&
      formula.formulaId === selectedFormula.formulaId
  );
  return isValid ? selectedFormula : (allFormulas[0] ?? null);
}

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

/**
 * Resolve a character's level, constellation, and raw talent data from
 * account data + team overrides.  Shared by buildTeamSlotConfigs and
 * buildWeaponChoiceCharConfigs.
 */
function resolveCharBaseConfig(
  charId: string,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null
): CharBaseConfig {
  const charConfig = setupConfig.charConfigs?.[charId];
  const acctChar = accountData?.characters.find((c) => c.key === charId);
  const defaultLevel = acctChar
    ? Number(getCharacterLevelTier(acctChar.level))
    : 90;
  const defaultConst = acctChar ? acctChar.constellation : 0;

  const charLevel =
    charConfig?.level !== undefined
      ? charConfig.level
      : setupConfig.combatOptions?.[`${charId}.overrideLevel`] !== undefined
        ? Number(setupConfig.combatOptions[`${charId}.overrideLevel`])
        : defaultLevel;
  const constellation =
    charConfig?.constellation !== undefined
      ? charConfig.constellation
      : setupConfig.combatOptions?.[`${charId}.overrideConstellation`] !==
          undefined
        ? Number(setupConfig.combatOptions[`${charId}.overrideConstellation`])
        : defaultConst;

  return { charLevel, constellation, acctTalent: acctChar?.talent };
}

/**
 * Resolve talent-level overrides for a character.  Returns the merged talent
 * levels when any override is present, or the provided fallback otherwise.
 */
function resolveTalentOverrides(
  charId: string,
  setupConfig: TeamSetupConfig,
  acctTalent: TalentLevels | undefined,
  fallback: TalentLevels | undefined
): TalentLevels | undefined {
  const charTalent = setupConfig.charConfigs?.[charId]?.talentLevels;
  const overrideAuto =
    setupConfig.combatOptions?.[`${charId}.overrideTalentAuto`];
  const overrideSkill =
    setupConfig.combatOptions?.[`${charId}.overrideTalentSkill`];
  const overrideBurst =
    setupConfig.combatOptions?.[`${charId}.overrideTalentBurst`];
  if (
    charTalent?.auto === undefined &&
    charTalent?.skill === undefined &&
    charTalent?.burst === undefined &&
    overrideAuto === undefined &&
    overrideSkill === undefined &&
    overrideBurst === undefined
  ) {
    return fallback;
  }
  const base = acctTalent ?? { auto: 10, skill: 10, burst: 10 };
  return {
    auto:
      charTalent?.auto !== undefined
        ? charTalent.auto
        : overrideAuto !== undefined
          ? Number(overrideAuto)
          : base.auto,
    skill:
      charTalent?.skill !== undefined
        ? charTalent.skill
        : overrideSkill !== undefined
          ? Number(overrideSkill)
          : base.skill,
    burst:
      charTalent?.burst !== undefined
        ? charTalent.burst
        : overrideBurst !== undefined
          ? Number(overrideBurst)
          : base.burst,
  };
}

/** Resolve the effective refinement for a weapon, checking account data + overrides. */
function resolveRefinement(
  charId: string,
  weaponId: string,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null
): number {
  const authoredRefinement = setupConfig.charConfigs?.[charId]?.refinement;
  if (authoredRefinement !== undefined) return authoredRefinement;
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
  return setupConfig.combatOptions?.[`${charId}.overrideRefinement`] !==
    undefined
    ? Number(setupConfig.combatOptions[`${charId}.overrideRefinement`])
    : defaultRefine;
}

function getTeamCharConfig(
  setupConfig: TeamSetupConfig,
  charId: string
): TeamCharConfig | undefined {
  return setupConfig.charConfigs?.[charId];
}

/**
 * Build TeamBuild configs using ACTUAL equipped artifact sets (for accurate
 * damage calc). Falls back to goal sets if no artifacts are equipped.
 */
export function buildTeamSlotConfigs(
  comp: TeamComp,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null
): TeamSlotConfig[] {
  const configs: TeamSlotConfig[] = [];
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  for (let i = 0; i < 4; i++) {
    const charId = characters[i];
    if (!charId) continue;
    if (!weapons[i]) continue; // wait for weapon to be selected

    const { charLevel, constellation, acctTalent } = resolveCharBaseConfig(
      charId,
      setupConfig,
      accountData
    );

    const weaponId = weapons[i]!;
    const refinement = resolveRefinement(
      charId,
      weaponId,
      setupConfig,
      accountData
    );

    let artifactSet: ArtifactSetConfig | null = null;

    const artConfig = artifacts[i];
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
      setupConfig,
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
  comp: TeamComp,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null
): WeaponChoiceCharConfig[] {
  const configs: WeaponChoiceCharConfig[] = [];
  const { characters, artifacts } = teamCompToArrays(comp);
  for (let i = 0; i < 4; i++) {
    const charId = characters[i];
    if (!charId) continue;

    const { charLevel, constellation, acctTalent } = resolveCharBaseConfig(
      charId,
      setupConfig,
      accountData
    );

    const baseTalent = acctTalent ?? { auto: 10, skill: 10, burst: 10 };
    const authoredTalent = setupConfig.charConfigs?.[charId]?.talentLevels;
    const overrideAuto =
      setupConfig.combatOptions?.[`${charId}.overrideTalentAuto`];
    const overrideSkill =
      setupConfig.combatOptions?.[`${charId}.overrideTalentSkill`];
    const overrideBurst =
      setupConfig.combatOptions?.[`${charId}.overrideTalentBurst`];
    const talentLevels: [number, number, number] = [
      authoredTalent?.auto !== undefined
        ? authoredTalent.auto
        : overrideAuto !== undefined && overrideAuto !== ""
          ? Number(overrideAuto)
          : baseTalent.auto,
      authoredTalent?.skill !== undefined
        ? authoredTalent.skill
        : overrideSkill !== undefined && overrideSkill !== ""
          ? Number(overrideSkill)
          : baseTalent.skill,
      authoredTalent?.burst !== undefined
        ? authoredTalent.burst
        : overrideBurst !== undefined && overrideBurst !== ""
          ? Number(overrideBurst)
          : baseTalent.burst,
    ];
    const charConfig = getTeamCharConfig(setupConfig, charId);

    configs.push({
      charId,
      level: charLevel,
      constellation,
      talentLevels,
      artifactConfig: artifacts[i] ?? null,
      minEr: charConfig?.minEr ?? 1,
      minCr: charConfig?.minCr ?? 0,
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
  comp: TeamComp,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null
) {
  const { charLevel, constellation: charConst } = resolveCharBaseConfig(
    charId,
    setupConfig,
    accountData
  );
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  const idx = characters.indexOf(charId);
  const weaponId = idx >= 0 ? weapons[idx] : null;
  const weaponRefine = weaponId
    ? resolveRefinement(charId, weaponId, setupConfig, accountData)
    : 1;
  const artConfig = idx >= 0 ? artifacts[idx] : null;
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
} /**
 * Returns the `ComboFormula` that damage-calc consumers should use.
 *
 * - Single mode: synthesizes a 1-line combo from `team.selectedFormula` +
 *   `team.singleReaction`. If no formula is selected, returns an empty combo.
 * - Combo mode: returns `team.combos[team.selectedCombo]` with `count <= 0`
 *   lines filtered out.
 */

export function getEffectiveCombo(
  damageConfig: TeamDamageConfig | undefined
): ComboFormula {
  const mode = damageConfig?.formulaMode ?? "single";

  if (mode === "single") {
    const sel = damageConfig?.selectedFormula;
    if (!sel) {
      return { id: "__single_empty__", label: EMPTY_LABEL, lines: [] };
    }
    const line: ComboLine = {
      charId: sel.charId,
      formulaId: sel.formulaId,
      count: 1,
      reaction: damageConfig?.singleReaction,
      forceOnField: damageConfig?.singleForceOnField,
    };
    return { id: "__single__", label: EMPTY_LABEL, lines: [line] };
  }

  // combo mode
  if (!damageConfig?.combo) {
    return { id: "__combo_empty__", label: EMPTY_LABEL, lines: [] };
  }
  return {
    ...damageConfig.combo,
    lines: damageConfig.combo.lines.filter((l) => l.count > 0),
  };
}
