import type { ArtifactConfig } from "@/components/shared/ItemPicker";
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
import { distributeComboHits } from "@/lib/team-comp/calc/stackAllocation";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  ComboLine,
  DisplayResult,
  TalentLevels,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import type { Team, WeaponChoiceCharConfig } from "@/stores/useTeamStore";
import { StatSheet } from "./calc/statSheet";
import type { TeamBuild } from "./calc/teamBuild";

interface DetectedSets {
  artifactSetId: string | null;
  artifactHalfSetIds: string[];
}

/** Detect what artifact set bonuses the equipped pieces actually form. */
export function detectEquippedSets(
  artifacts: (ArtifactData | null | undefined)[]
): DetectedSets {
  const setCounts: Record<string, number> = {};
  for (const art of artifacts) {
    if (!art) continue;
    setCounts[art.setKey] = (setCounts[art.setKey] || 0) + 1;
  }

  // 4pc check
  for (const [setKey, count] of Object.entries(setCounts)) {
    if (count >= 4) {
      return { artifactSetId: setKey, artifactHalfSetIds: [] };
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
    return { artifactSetId: null, artifactHalfSetIds: halfSetIds };
  }

  // Single 2pc
  if (twoPcSets.length === 1) {
    const hsId = artifactIdToHalfSetId[twoPcSets[0]];
    return {
      artifactSetId: null,
      artifactHalfSetIds: hsId != null ? [hsId] : [],
    };
  }

  return { artifactSetId: null, artifactHalfSetIds: [] };
}

/**
 * Check whether a frozen character's artifacts match the given team artifact config.
 * Used by forceReuse mode to decide if the frozen artifacts should be reused as-is.
 */
export function frozenArtifactsMatchConfig(
  frozenArts: Record<Slot, ArtifactData | null>,
  goalConfig: ArtifactConfig | null
): boolean {
  if (!goalConfig) return false;
  const equipped = detectEquippedSets(allSlots.map((s) => frozenArts[s]));
  return setsMatch(goalConfig, equipped);
}

/** Check if equipped sets match the goal sets from team config. */
export function setsMatch(
  goal: Team["artifacts"][number],
  equipped: DetectedSets
): boolean {
  if (!goal) return true;
  if (goal.type === "4pc") {
    return equipped.artifactSetId === goal.setId;
  }
  if (goal.type === "2pc+2pc") {
    const goalIds = [String(goal.id1), String(goal.id2)].sort();
    const eqIds = [...equipped.artifactHalfSetIds].sort();
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

    let defaultRefine = 1;
    const weaponId = team.weapons[i]!;
    if (weaponId && accountData) {
      const refinements: number[] = [];
      for (const c of accountData.characters) {
        if (c.weapon?.key === weaponId) refinements.push(c.weapon.refinement);
      }
      for (const w of accountData.extraWeapons) {
        if (w.key === weaponId) refinements.push(w.refinement);
      }
      if (refinements.length > 0) defaultRefine = Math.max(...refinements);
    }

    const refinement =
      team.opts?.[`${charId}.overrideRefinement`] !== undefined
        ? Number(team.opts[`${charId}.overrideRefinement`])
        : defaultRefine;

    let artifactSetId: string | null = null;
    let artifactHalfSetIds: string[] = [];

    const artConfig = team.artifacts[i];
    if (artConfig) {
      if (artConfig.type === "4pc") {
        artifactSetId = artConfig.setId;
      } else if (artConfig.type === "2pc+2pc") {
        artifactHalfSetIds = [String(artConfig.id1), String(artConfig.id2)];
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
      artifactSetId,
      artifactHalfSetIds,
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
 * Compute combo-mode DisplayResult for a rotation.
 * Filters to active lines and returns null when inputs are missing.
 * The returned DisplayResult includes per-formula display parts, lineDamages, etc.
 */
export function calcComboResults(
  build: TeamBuild | null,
  combo: ComboFormula,
  sheets: Record<string, StatSheet>,
  context: CalcContext,
  buffOverrides?: Record<number, BuffActivationMap>
): DisplayResult | null {
  if (!build) return null;
  const activeLines = combo.lines.filter((l) => l.count > 0);
  if (activeLines.length === 0) return null;
  const activeCombo = { ...combo, lines: activeLines };
  return build.getComboDisplayResult(
    activeCombo,
    sheets,
    context,
    buffOverrides
  );
}

/**
 * Build per-line BuffActivationMap for a combo rotation.
 *
 * Computes combo-wide default activation (sharing the maxStack budget across
 * ALL lines), then merges user overrides on top. This ensures stack-limited
 * buffs are correctly distributed across the entire rotation rather than each
 * formula receiving the full budget independently.
 *
 * @param activeLines - The active combo lines (count > 0, formula exists)
 * @param build - The TeamBuild for stat resolution
 * @param sheets - Artifact stat sheets per character
 * @param ctx - Calc context
 * @param comboOverrides - User overrides from the buff override store (optional)
 */
export function buildBuffOverrides(
  activeLines: ComboLine[],
  build: TeamBuild,
  sheets: Record<string, StatSheet>,
  ctx: CalcContext,
  comboOverrides?: Record<string, BuffActivationMap>
): Record<number, BuffActivationMap> | undefined {
  // ── Distribute user overrides across lines ──
  const perLineUserOverrides = new Map<number, BuffActivationMap>();

  if (comboOverrides) {
    // Group active lines by formula key, preserving line index
    const formulaLineIndices = new Map<string, number[]>();
    for (let i = 0; i < activeLines.length; i++) {
      const line = activeLines[i];
      const fKey = `${line.charId}.${line.formulaId}`;
      const arr = formulaLineIndices.get(fKey) ?? [];
      arr.push(i);
      formulaLineIndices.set(fKey, arr);
    }

    for (const [formulaKey, comboActivation] of Object.entries(
      comboOverrides
    )) {
      const lineIndices = formulaLineIndices.get(formulaKey);
      if (!lineIndices || lineIndices.length === 0) continue;

      const lineCounts = lineIndices.map((i) => activeLines[i].count);
      const [charId, formulaId] = formulaKey.split(".");
      const entry =
        build.charBuilds[charId]?.charBase.getFormulaEntry(formulaId);
      if (!entry) continue;

      for (const [buffKey, partMap] of Object.entries(comboActivation)) {
        for (const [partIdxStr, totalActivated] of Object.entries(partMap)) {
          const partIdx = Number(partIdxStr);
          const partHits = entry.parts[partIdx]?.hits ?? 1;
          const distributed = distributeComboHits(
            totalActivated,
            partHits,
            lineCounts
          );
          for (let j = 0; j < lineIndices.length; j++) {
            const lineIdx = lineIndices[j];
            const lineCount = lineCounts[j];
            if (lineCount === 0) continue;
            const perCast = distributed[j] / lineCount;
            let lineMap = perLineUserOverrides.get(lineIdx);
            if (!lineMap) {
              lineMap = {};
              perLineUserOverrides.set(lineIdx, lineMap);
            }
            if (!lineMap[buffKey]) lineMap[buffKey] = {};
            lineMap[buffKey][partIdx] = perCast;
          }
        }
      }
    }
  }

  // Delegate to TeamBuild which handles stat resolution, combo-wide default
  // activation, and merging with user overrides.
  return build.computeComboPartialBuffSpecs(
    activeLines,
    sheets,
    ctx,
    undefined,
    perLineUserOverrides.size > 0 ? perLineUserOverrides : undefined
  );
}

/**
 * Extract per-formula user overrides from the flat combo override store
 * for a given combo ID.
 *
 * Store keys have format "combo:{comboId}:{charId}.{formulaId}".
 * Returns a map of formulaKey → BuffActivationMap, suitable for passing
 * to buildBuffOverrides as `comboOverrides`.
 */
export function extractComboOverrides(
  storeOverrides: Record<string, BuffActivationMap>,
  comboId: string
): Record<string, BuffActivationMap> | undefined {
  const prefix = `combo:${comboId}:`;
  const result: Record<string, BuffActivationMap> = {};
  for (const key of Object.keys(storeOverrides)) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = storeOverrides[key];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Aggregate per-line per-cast combo defaults into a single per-formula
 * combo-total BuffActivationMap.
 *
 * For each combo line matching `charId`/`formulaId`, sums:
 *   comboTotal[bKey][partIdx] += perCast * line.count
 *
 * The result is suitable for the drill-down dialog's default activation
 * (where slider values represent the total across the entire combo).
 */
export function aggregateComboFormulaDefaults(
  activeLines: ComboLine[],
  perLine: BuffActivationMap[],
  charId: string,
  formulaId: string
): BuffActivationMap {
  const result: BuffActivationMap = {};

  for (let i = 0; i < activeLines.length; i++) {
    const line = activeLines[i];
    if (line.charId !== charId || line.formulaId !== formulaId) continue;

    const lineMap = perLine[i];
    if (!lineMap) continue;

    for (const [bKey, partMap] of Object.entries(lineMap)) {
      if (!result[bKey]) result[bKey] = {};
      for (const [pidxStr, perCast] of Object.entries(partMap)) {
        const pidx = Number(pidxStr);
        result[bKey][pidx] = (result[bKey][pidx] ?? 0) + perCast * line.count;
      }
    }
  }

  return result;
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
  let defaultRefine = 1;
  if (weaponId && accountData) {
    const refinements: number[] = [];
    for (const c of accountData.characters) {
      if (c.weapon?.key === weaponId) refinements.push(c.weapon.refinement);
    }
    for (const w of accountData.extraWeapons) {
      if (w.key === weaponId) refinements.push(w.refinement);
    }
    if (refinements.length > 0) defaultRefine = Math.max(...refinements);
  }
  const weaponRefine =
    team.opts?.[`${charId}.overrideRefinement`] !== undefined
      ? Number(team.opts[`${charId}.overrideRefinement`])
      : defaultRefine;
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
    artifactSetId?: string | null;
    artifactHalfSetIds?: string[];
  }[]
): Record<string, Record<Slot, string>> {
  const result: Record<string, Record<Slot, string>> = {};
  for (const cfg of configs) {
    if (cfg.artifactSetId) {
      const sk = cfg.artifactSetId;
      result[cfg.charId] = {
        flower: sk,
        plume: sk,
        sands: sk,
        goblet: sk,
        circlet: sk,
      };
    } else if (cfg.artifactHalfSetIds && cfg.artifactHalfSetIds.length === 2) {
      const hs1 = artifactHalfSetsById[cfg.artifactHalfSetIds[0]];
      const hs2 = artifactHalfSetsById[cfg.artifactHalfSetIds[1]];
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
