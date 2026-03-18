import { artifactIdToHalfSetId } from "@/data/constants";
import type { AccountData, ArtifactData } from "@/data/types";
import { getCharacterLevelTier } from "@/lib/gameStatsLoader";
import {
  type TeamBuild,
  evaluateCombo,
  getComboDisplayResult,
} from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  CharCompConfig,
  ComboFormula,
  ComboResult,
  DisplayResult,
  ReactionOverride,
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
): CharCompConfig[] {
  const configs: CharCompConfig[] = [];
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

    // Detect equipped artifact sets for accurate damage calc
    let artifactSetId: string | null = null;
    let artifactHalfSetIds: string[] = [];

    if (accountData) {
      const acctChar = accountData.characters.find((c) => c.key === charId);
      if (acctChar) {
        const equipped = Object.values(acctChar.artifacts || {});
        if (equipped.length > 0) {
          const detected = detectEquippedSets(equipped);
          artifactSetId = detected.artifactSetId;
          artifactHalfSetIds = detected.artifactHalfSetIds;
        }
      }
    }

    // Fallback to goal sets if no complete set detected.
    // A single 2pc (length 1) is incomplete — fall back so the TeamBuild
    // gets a valid set configuration (4pc or 2+2pc from goal).
    if (!artifactSetId && artifactHalfSetIds.length !== 2) {
      const artConfig = team.artifacts[i];
      if (artConfig) {
        if (artConfig.type === "4pc") {
          artifactSetId = artConfig.setId;
          artifactHalfSetIds = [];
        } else if (artConfig.type === "2pc+2pc") {
          artifactHalfSetIds = [String(artConfig.id1), String(artConfig.id2)];
        }
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
  override?: ReactionOverride
): DisplayResult | null {
  if (!build || !formula) return null;
  const { charId, formulaId } = formula;
  const formulas = build.getFormulaIds()[charId];
  if (!formulas || !formulas[formulaId]) return null;
  return build.getDisplayResult(charId, formulaId, sheets, context, override);
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
  overrides?: Record<string, ReactionOverride>
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
    overrides
  );
  const comboDisplay = getComboDisplayResult(
    build,
    activeCombo,
    sheets,
    context,
    overrides
  );
  return { comboResult, comboDisplay };
}
