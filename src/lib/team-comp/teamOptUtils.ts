import { artifactIdToHalfSetId } from "@/data/constants";
import type { AccountData, ArtifactData } from "@/data/types";
import { getCharacterLevelTier } from "@/lib/gameStatsLoader";
import {
  type TeamBuild,
  evaluateCombo,
  getComboDisplayResult,
} from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import { distributeComboHits } from "@/lib/team-comp/stackAllocation";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  ComboLine,
  ComboResult,
  DisplayResult,
  PartialBuffInfo,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import type { Team } from "@/stores/useTeamStore";

export interface TeamOptDetailProps {
  team: Team;
  onBack: () => void;
}

export interface DetectedSets {
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

    let defaultRefine = 1;
    const weaponId = team.weapons[i]!;
    if (weaponId && accountData) {
      // Search all characters' equipped weapons and unequipped inventory
      // for the highest refinement. Mirrors the override select's logic.
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

    // Use the team roster's artifact set selection as the single source of truth.
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

    configs.push({
      charId,
      charLevel,
      constellation,
      weaponId,
      refinement,
      artifactSetId,
      artifactHalfSetIds,
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
 * Compute DisplayResult for a single formula.
 * Returns null when any input is missing or the formula doesn't exist.
 */
export function calcDisplayResult(
  build: TeamBuild | null,
  formula: { charId: string; formulaId: string } | null,
  sheets: Record<string, StatSheet>,
  context: CalcContext,
  override?: ReactionOverride,
  userBuffOverrides?: import("@/lib/team-comp/types").BuffActivationMap
): DisplayResult | null {
  if (!build || !formula) return null;
  const { charId, formulaId } = formula;
  const formulas = build.getFormulaIds()[charId];
  if (!formulas || !formulas[formulaId]) return null;
  return build.getDisplayResult(
    charId,
    formulaId,
    sheets,
    context,
    override,
    userBuffOverrides
  );
}

/**
 * Compute combo-mode DisplayResult (and optionally ComboResult) for a rotation.
 * Filters to active lines and returns null when inputs are missing.
 */
export function calcComboResults(
  build: TeamBuild | null,
  combo: ComboFormula,
  sheets: Record<string, StatSheet>,
  context: CalcContext,
  overrides?: Record<string, ReactionOverride>,
  linePartialBuffs?: Record<number, PartialBuffInfo[]>
): { comboResult: ComboResult | null; comboDisplay: DisplayResult | null } {
  if (!build) return { comboResult: null, comboDisplay: null };
  const activeLines = combo.lines.filter((l) => l.count > 0);
  if (activeLines.length === 0)
    return { comboResult: null, comboDisplay: null };
  const activeCombo = { ...combo, lines: activeLines };
  const comboResult = evaluateCombo(
    build,
    activeCombo,
    sheets,
    context,
    overrides,
    linePartialBuffs
  );
  const comboDisplay = getComboDisplayResult(
    build,
    activeCombo,
    sheets,
    context,
    overrides,
    linePartialBuffs
  );
  return { comboResult, comboDisplay };
}

/**
 * Build per-line PartialBuffInfo[] for a combo rotation.
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
 * @param rxnOverrides - Per-formula reaction overrides
 * @param comboOverrides - User overrides from the buff override store (optional)
 */
export function buildComboLinePartialBuffs(
  activeLines: ComboLine[],
  build: TeamBuild,
  sheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rxnOverrides?: Record<string, ReactionOverride>,
  comboOverrides?: Record<string, BuffActivationMap>
): Record<number, PartialBuffInfo[]> | undefined {
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
    rxnOverrides,
    perLineUserOverrides.size > 0 ? perLineUserOverrides : undefined
  );
}
