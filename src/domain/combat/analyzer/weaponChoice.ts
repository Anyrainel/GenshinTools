/**
 * Weapon Choice computation engine.
 *
 * For each character in a team, generates ideal artifacts while varying either
 * compatible weapons or 4pc artifact sets, then ranks by combo damage. Supports
 * concurrent evaluation via an async generator that yields progress updates.
 */

import { TIER_LIST_OTHER_ARTIFACT_SETS } from "@/config/gameConstants";
import { getRollValues } from "@/domain/build/artifact/scoring/utils";
import type {
  CalcContext,
  ComboFormula,
  ExtraBuff,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import type { Element, MainStat, Slot, StatKey, SubStat } from "@/domain/enums";
import { allSlots } from "@/domain/enums";
import type { ArtifactSetConfig } from "@/domain/models";
import {
  artifactHalfSetsById,
  artifactsById,
  weaponsById,
} from "@/domain/reference/catalog";
import type { WeaponStatsMap } from "@/domain/reference/stats";
import type {
  ArtifactAssignmentSuggestion,
  ChoiceRanking,
  InfeasibleChoice,
  WeaponChoiceCharConfig,
  WeaponRanking,
} from "@/domain/team/types";
import { deriveSetKeysFromConfigs } from "../../team/teamConfigUtils";
import { getArchaicPetraElements } from "../damage/artifactConditions";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "../damage/core/formulaCompiler";
import type { StatSheet } from "../damage/core/statSheet";
import { TeamBuild } from "../damage/core/teamBuild";
import type { TeamMeta } from "../damage/core/teamMeta";
import type { GeneratorResult } from "../generator/generator";
import { runGenerator } from "../generator/generator";
import { getErCrConstraintFailures } from "../optimizer/erCrConstraints";
import { getCompatibleOwnedWeaponChoices } from "./weaponChoiceCandidates";

export interface CharProgress {
  charId: string;
  done: number;
  total: number;
  currentWeapon?: string;
  currentTarget?: string;
}

export interface WeaponChoiceProgress {
  phase: string;
  overallProgress: number;
  /** Per-character progress for parallel display */
  chars?: CharProgress[];
  /** @deprecated use chars instead */
  currentChar?: string;
  /** @deprecated use chars instead */
  currentWeapon?: string;
}

export interface WeaponChoiceResult {
  mode: "weapon" | "artifact";
  timestamp: number;
  perCharacter: Record<string, ChoiceRanking[]>;
  excludedChoices: Record<string, InfeasibleChoice[]>;
  artifactAssignmentSuggestion?: ArtifactAssignmentSuggestion | null;
  done: boolean;
  progress: WeaponChoiceProgress;
}

export interface WeaponChoiceOptions {
  mode?: "weapon" | "artifact";
  baseConfigs: TeamSlotConfig[];
  charConfigs: WeaponChoiceCharConfig[];
  combo: ComboFormula;
  calcContext: CalcContext;
  weaponStats: WeaponStatsMap;
  opts: Record<string, string>;
  enemyAura?: Element;
  extraBuffs?: ExtraBuff[];
  /** Undefined compares the full catalog; an empty array means no owned candidates. */
  ownedWeaponChoices?: readonly { weaponId: string; refinement: number }[];
}

type WeaponCandidate = { type: "weapon"; weaponId: string; refinement: number };
type ArtifactCandidate = {
  type: "artifact";
  artifactSet: ArtifactSetConfig;
};
type ChoiceCandidate = WeaponCandidate | ArtifactCandidate;

const SUBSTAT_TO_HALF_SET_IDS: Partial<Record<SubStat, string[]>> = {
  "atk%": ["atk%-18"],
  "hp%": ["hp%-20"],
  "def%": ["def%-30"],
  em: ["em-80"],
  er: ["er-20"],
  cr: ["cr-12"],
};

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Build weapon candidates for a character's weapon type.
 * - Skip 1-2★
 * - 3★/4★: R5 only
 * - 5★: R1 and R5
 */
function getWeaponCandidates(
  weaponType: string,
  weaponStats: WeaponStatsMap
): WeaponCandidate[] {
  const candidates: WeaponCandidate[] = [];

  for (const [weaponId, stats] of Object.entries(weaponStats)) {
    if (stats.type !== weaponType) continue;
    const resource = weaponsById[weaponId];
    const rarity = resource?.rarity ?? stats.rarity;
    if (rarity <= 2) continue;

    if (rarity <= 4) {
      // 3★ and 4★: R5 only
      candidates.push({ type: "weapon", weaponId, refinement: 5 });
    } else {
      // 5★: R1 and R5
      candidates.push({ type: "weapon", weaponId, refinement: 1 });
      candidates.push({ type: "weapon", weaponId, refinement: 5 });
    }
  }

  return candidates;
}

/** @internal Exported for testing only. */
export function buildArtifactSetChoiceCandidates(): ArtifactCandidate[] {
  return Object.values(artifactsById)
    .filter(
      (artifact) =>
        artifact.rarity === 5 && !TIER_LIST_OTHER_ARTIFACT_SETS.has(artifact.id)
    )
    .map((artifact) => ({
      type: "artifact",
      artifactSet: { type: "4pc", setId: artifact.id },
    }));
}

function getCandidateProgressLabel(candidate: ChoiceCandidate): string {
  return candidate.type === "weapon"
    ? candidate.weaponId
    : getArtifactSetChoiceKey(candidate.artifactSet);
}

function getArtifactSetChoiceKey(artifactSet: ArtifactSetConfig): string {
  if (artifactSet.type === "4pc") return artifactSet.setId;
  return [...artifactSet.halfSetIds].sort().join("+");
}

function getArtifactAssignmentKey(
  artifactSet: ArtifactSetConfig | null
): string {
  if (!artifactSet) return "none";
  return getArtifactSetChoiceKey(artifactSet);
}

function getArtifactSetIds(artifactSet: ArtifactSetConfig): string[] {
  if (artifactSet.type === "4pc") return [artifactSet.setId];
  return artifactSet.halfSetIds.flatMap((halfSetId) =>
    getFiveStarSetIdsForHalfSet(halfSetId).slice(0, 1)
  );
}

function getFiveStarSetIdsForHalfSet(halfSetId: string): string[] {
  return (artifactHalfSetsById[halfSetId]?.setIds ?? []).filter(
    (setId) => artifactsById[setId]?.rarity === 5
  );
}

function getWantedHalfSetIds(statKeys: Iterable<StatKey>): string[] {
  const result = new Set<string>();
  for (const statKey of statKeys) {
    const halfSetIds = SUBSTAT_TO_HALF_SET_IDS[statKey as SubStat] ?? [];
    for (const halfSetId of halfSetIds) {
      if (getFiveStarSetIdsForHalfSet(halfSetId).length > 0) {
        result.add(halfSetId);
      }
    }
  }
  return [...result].sort();
}

/** @internal Exported for testing only. */
export function buildTwoPieceArtifactChoiceCandidates(
  statKeys: Iterable<StatKey>
): ArtifactCandidate[] {
  const halfSetIds = getWantedHalfSetIds(statKeys);
  const candidates: ArtifactCandidate[] = [];

  for (let i = 0; i < halfSetIds.length; i++) {
    for (let j = i; j < halfSetIds.length; j++) {
      const first = halfSetIds[i];
      const second = halfSetIds[j];
      if (first === second && getFiveStarSetIdsForHalfSet(first).length < 2) {
        continue;
      }
      candidates.push({
        type: "artifact",
        artifactSet: { type: "2pc+2pc", halfSetIds: [first, second] },
      });
    }
  }

  return candidates;
}

/**
 * Apply WeaponChoiceCharConfig overrides to a TeamSlotConfig.
 */
function applyCharConfig(
  config: TeamSlotConfig,
  charConfig: WeaponChoiceCharConfig
): TeamSlotConfig {
  return {
    ...config,
    charLevel: charConfig.level,
    constellation: charConfig.constellation,
    talentLevels: {
      auto: charConfig.talentLevels[0],
      skill: charConfig.talentLevels[1],
      burst: charConfig.talentLevels[2],
    },
    // Apply artifact config override if present
    ...(charConfig.artifactConfig
      ? { artifactSet: charConfig.artifactConfig }
      : {}),
  };
}

/**
 * Build configs with charConfig overrides applied.
 */
function buildOverriddenConfigs(
  baseConfigs: TeamSlotConfig[],
  charConfigs: WeaponChoiceCharConfig[]
): TeamSlotConfig[] {
  const configMap = new Map(charConfigs.map((c) => [c.charId, c]));
  return baseConfigs.map((config) => {
    const charConfig = configMap.get(config.charId);
    return charConfig ? applyCharConfig(config, charConfig) : config;
  });
}

/**
 * Build perChar ER/CR thresholds from charConfigs for the generator.
 */
function buildPerChar(
  charConfigs: WeaponChoiceCharConfig[]
): Record<string, { minEr: number; minCr: number }> {
  const perChar: Record<string, { minEr: number; minCr: number }> = {};
  for (const cc of charConfigs) {
    perChar[cc.charId] = { minEr: cc.minEr, minCr: cc.minCr };
  }
  return perChar;
}

/**
 * Build setKeysByChar from charConfigs artifact configurations.
 * Uses the same artifact assumptions as the analysis workspace generator.
 */
/** @internal Exported for testing only. */
export function buildSetKeysByChar(
  charConfigs: WeaponChoiceCharConfig[]
): Record<string, Record<Slot, string>> {
  return deriveSetKeysFromConfigs(
    charConfigs
      .filter((cc) => cc.artifactConfig != null)
      .map((cc) => ({
        charId: cc.charId,
        artifactSet: cc.artifactConfig,
      }))
  );
}

/**
 * Run the generator to completion and return the final result.
 * The generator yields intermediate results; we only need the final one.
 */
async function runGeneratorToCompletion(
  teamBuild: TeamBuild,
  carryCharId: string,
  combo: ComboFormula,
  calcContext: CalcContext,
  perChar?: Record<string, { minEr: number; minCr: number }>,
  setKeysByChar?: Record<string, Record<Slot, string>>,
  onProgress?: (progress: number, phase: string) => void
): Promise<GeneratorResult | null> {
  let lastResult: GeneratorResult | null = null;
  const gen = runGenerator({
    teamBuild,
    carryCharId,
    combo,
    calcContext,
    rollMultiplier: calcContext.rollMultiplier,
    substatBudget: calcContext.substatBudget,
    perChar,
    setKeysByChar,
  });

  for await (const result of gen) {
    lastResult = result;
    onProgress?.(result.progress, result.phase);
  }
  return lastResult;
}

/**
 * Evaluate combo damage using compiled path.
 */
function evaluateComboDamage(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  sheets: Record<string, StatSheet>,
  calcContext: CalcContext
): number {
  // Compile with all characters as variable
  const charIds = Object.keys(sheets);
  const compiled = compileComboTeamDamage(
    teamBuild,
    combo,
    charIds,
    sheets,
    calcContext
  );
  const vars = new Float64Array(compiled.numVars);
  vars.fill(0);

  // Fill vars for all characters
  for (const charId of charIds) {
    const sheet = sheets[charId];
    const charIdx = compiled.charIdxMap?.get(charId) ?? 0;
    if (sheet) fillVarsFromSheet(sheet, compiled.varMapping, charIdx, vars);
  }

  return compiled.evaluate(vars);
}

function getPetraComparisonOptions(
  teamMeta: TeamMeta,
  opts: Record<string, string>,
  wearerIds: string[]
): Record<string, string>[] {
  const elements = new Set(
    wearerIds.flatMap((charId) => getArchaicPetraElements(teamMeta, charId))
  );
  return elements.size
    ? [...elements].map((element) => ({ ...opts, archaic_petra: element }))
    : [{ ...opts, archaic_petra: "none" }];
}

// ─── Per-character computation ───

/**
 * Compute weapon rankings for a single character.
 * Runs independently so multiple characters can be evaluated in parallel.
 */
async function computeForChar(
  targetCharId: string,
  candidates: ChoiceCandidate[],
  configs: TeamSlotConfig[],
  combo: ComboFormula,
  calcContext: CalcContext,
  opts: Record<string, string>,
  enemyAura: Element | undefined,
  extraBuffs: ExtraBuff[],
  perChar: Record<string, { minEr: number; minCr: number }>,
  setKeysByChar: Record<string, Record<Slot, string>>,
  onProgress: (
    choicesDone: number,
    currentTarget?: string,
    totalChoices?: number
  ) => void
): Promise<{
  rankings: ChoiceRanking[];
  excludedChoices: InfeasibleChoice[];
}> {
  const candidateQueue = [...candidates];
  const initialCandidateCount = candidateQueue.length;
  let totalProgressSteps = initialCandidateCount;

  // Each candidate regenerates the whole team: changing a weapon or set can
  // change teammates' ER buffs and the artifact rolls needed to meet their ER.
  const rosterTeamBuild = new TeamBuild(configs, opts, enemyAura, extraBuffs);

  // Step 2: For each candidate, generate artifacts and evaluate
  const rankings: ChoiceRanking[] = [];
  const excludedChoices: InfeasibleChoice[] = [];

  for (
    let candidateIndex = 0;
    candidateIndex < candidateQueue.length;
    candidateIndex++
  ) {
    const candidate = candidateQueue[candidateIndex];
    const progressBase = candidateIndex;
    const progressLabel = getCandidateProgressLabel(candidate);
    onProgress(progressBase, progressLabel, totalProgressSteps);

    const candidateConfigs = configs.map((c) =>
      c.charId !== targetCharId
        ? c
        : candidate.type === "weapon"
          ? {
              ...c,
              weaponId: candidate.weaponId,
              refinement: candidate.refinement,
            }
          : { ...c, artifactSet: candidate.artifactSet }
    );

    const optionVariants =
      candidate.type === "artifact" &&
      candidate.artifactSet.type === "4pc" &&
      candidate.artifactSet.setId === "archaic_petra"
        ? getPetraComparisonOptions(rosterTeamBuild.teamMeta, opts, [
            targetCharId,
          ])
        : [opts];
    let bestRanking: ChoiceRanking | undefined;
    let failReasons: InfeasibleChoice["failReasons"] = {};
    for (const [optionIndex, candidateOpts] of optionVariants.entries()) {
      const candidateTeamBuild = new TeamBuild(
        candidateConfigs,
        candidateOpts,
        enemyAura,
        extraBuffs
      );

      const candidateSetKeysByChar =
        candidate.type === "artifact"
          ? {
              ...setKeysByChar,
              ...deriveSetKeysFromConfigs([
                { charId: targetCharId, artifactSet: candidate.artifactSet },
              ]),
            }
          : setKeysByChar;

      const weaponResult = await runGeneratorToCompletion(
        candidateTeamBuild,
        targetCharId,
        combo,
        calcContext,
        perChar,
        candidateSetKeysByChar,
        (progress) =>
          onProgress(
            progressBase + (optionIndex + progress) / optionVariants.length,
            progressLabel,
            totalProgressSteps
          )
      );

      if (!weaponResult) {
        throw new Error("Artifact generation ended without a result");
      }
      const constraintFailures = {
        ...getErCrConstraintFailures(
          candidateTeamBuild,
          weaponResult.sheetsByChar,
          calcContext,
          perChar
        ),
        ...weaponResult.failReasons,
      };
      if (Object.keys(constraintFailures).length > 0) {
        failReasons = constraintFailures;
        continue;
      }

      const damage = evaluateComboDamage(
        candidateTeamBuild,
        combo,
        weaponResult.sheetsByChar,
        calcContext
      );

      // Extract artifact build summary for the target character
      const arts = weaponResult.artifactsByChar[targetCharId];
      let mainStats:
        | { sands: MainStat; goblet: MainStat; circlet: MainStat }
        | undefined;
      let substatRolls: Partial<Record<SubStat, number>> | undefined;
      let artifactSetIds: string[] | undefined;

      if (arts) {
        mainStats = {
          sands: arts.sands?.mainStatKey ?? ("atk%" as MainStat),
          goblet: arts.goblet?.mainStatKey ?? ("atk%" as MainStat),
          circlet: arts.circlet?.mainStatKey ?? ("cr" as MainStat),
        };
        // Convert display-format substats to roll counts
        const rarity = arts.flower?.rarity ?? 5;
        const rv = getRollValues(
          calcContext.rollMultiplier,
          (rarity === 4 ? 4 : 5) as 4 | 5
        );
        const agg: Partial<Record<SubStat, number>> = {};
        for (const slot of allSlots) {
          const subs = arts[slot]?.substats;
          if (!subs) continue;
          for (const [stat, displayVal] of Object.entries(subs)) {
            if (!displayVal) continue;
            const rollVal = rv[stat as SubStat];
            const rolls = rollVal > 0 ? displayVal / rollVal : 0;
            agg[stat as SubStat] =
              (agg[stat as SubStat] ?? 0) + Math.round(rolls * 10) / 10;
          }
        }
        substatRolls = agg;
        // Collect unique artifact set IDs
        const setIds = new Set<string>();
        for (const slot of allSlots) {
          const sk = arts[slot]?.setKey;
          if (sk && sk !== "generated") setIds.add(sk);
        }
        if (setIds.size > 0) artifactSetIds = [...setIds];
      }

      let ranking: ChoiceRanking;
      if (candidate.type === "weapon") {
        ranking = {
          type: "weapon",
          weaponId: candidate.weaponId,
          refinement: candidate.refinement,
          damage,
          percentOfBest: 0, // normalized after all choices
          mainStats,
          substatRolls,
          artifactSetIds,
        };
      } else {
        ranking = {
          type: "artifact",
          artifactSet: candidate.artifactSet,
          artifactSetIds:
            artifactSetIds ?? getArtifactSetIds(candidate.artifactSet),
          damage,
          percentOfBest: 0, // normalized after all choices
          mainStats,
          substatRolls,
          ...(candidate.artifactSet.type === "4pc" &&
          candidate.artifactSet.setId === "archaic_petra"
            ? { combatOptions: { archaic_petra: candidateOpts.archaic_petra } }
            : {}),
        };
      }
      if (!bestRanking || ranking.damage > bestRanking.damage)
        bestRanking = ranking;
    }
    if (bestRanking) rankings.push(bestRanking);
    else if (Object.keys(failReasons).length > 0)
      excludedChoices.push({ ...candidate, failReasons });

    if (
      candidate.type === "artifact" &&
      candidateIndex === initialCandidateCount - 1
    ) {
      const statKeys = new Set(collectGeneratedSubstatKeys(rankings));
      // A constraint can make every 4pc choice infeasible. Still try the 2pc
      // bonuses that address it instead of deriving candidates only from winners.
      if (perChar[targetCharId]?.minEr > 1) statKeys.add("er");
      if (perChar[targetCharId]?.minCr > 0) statKeys.add("cr");
      const twoPieceCandidates =
        buildTwoPieceArtifactChoiceCandidates(statKeys);
      candidateQueue.push(...twoPieceCandidates);
      totalProgressSteps = candidateQueue.length;
      onProgress(progressBase + 1, undefined, totalProgressSteps);
    }
  }

  onProgress(totalProgressSteps, undefined, totalProgressSteps);
  return { rankings, excludedChoices };
}

function collectGeneratedSubstatKeys(rankings: ChoiceRanking[]): StatKey[] {
  const statKeys = new Set<StatKey>();
  for (const ranking of rankings) {
    if (ranking.type !== "artifact" || ranking.artifactSet.type !== "4pc") {
      continue;
    }
    for (const [statKey, rolls] of Object.entries(
      ranking.substatRolls ?? {}
    ) as [SubStat, number][]) {
      if (rolls > 0) statKeys.add(statKey);
    }
  }
  return [...statKeys];
}

function isWeaponRanking(ranking: ChoiceRanking): ranking is WeaponRanking {
  return ranking.type !== "artifact";
}

/**
 * Normalize weapon rankings using community-standard baseline:
 * Best among (4★ R5 / 5★ R1) = 100%. 5★ R5 can exceed 100%.
 */
function normalizeWeaponRankings(
  rankings: ChoiceRanking[],
  weaponStats: WeaponStatsMap
): void {
  if (rankings.length === 0) return;

  // Find baseline: best damage among 4★ R5 and 5★ R1 weapons
  let baselineDamage = 0;
  for (const r of rankings) {
    if (!isWeaponRanking(r)) continue;
    const rarity =
      weaponsById[r.weaponId]?.rarity ?? weaponStats[r.weaponId]?.rarity ?? 0;
    const isBaseline =
      (rarity <= 4 && r.refinement === 5) ||
      (rarity === 5 && r.refinement === 1);
    if (isBaseline && r.damage > baselineDamage) {
      baselineDamage = r.damage;
    }
  }

  // Fall back to absolute best if no baseline candidates exist (shouldn't happen)
  if (baselineDamage <= 0) {
    baselineDamage = Math.max(...rankings.map((r) => r.damage));
  }

  for (const r of rankings) {
    r.percentOfBest =
      baselineDamage > 0 ? (r.damage / baselineDamage) * 100 : 0;
  }

  rankings.sort((a, b) => b.damage - a.damage);
}

function normalizeArtifactRankings(rankings: ChoiceRanking[]): void {
  if (rankings.length === 0) return;
  const baselineDamage = Math.max(...rankings.map((r) => r.damage));

  for (const r of rankings) {
    r.percentOfBest =
      baselineDamage > 0 ? (r.damage / baselineDamage) * 100 : 0;
  }

  rankings.sort((a, b) => b.damage - a.damage);
}

function normalizeRankings(
  mode: "weapon" | "artifact",
  rankings: ChoiceRanking[],
  weaponStats: WeaponStatsMap
): void {
  if (mode === "artifact") {
    normalizeArtifactRankings(rankings);
  } else {
    normalizeWeaponRankings(rankings, weaponStats);
  }
}

function buildUniqueArtifactAssignments(
  artifactSets: (ArtifactSetConfig | null)[]
): (ArtifactSetConfig | null)[][] {
  const results: (ArtifactSetConfig | null)[][] = [];
  const used = new Array(artifactSets.length).fill(false);
  const current: (ArtifactSetConfig | null)[] = [];
  const sorted = [...artifactSets].sort((a, b) =>
    getArtifactAssignmentKey(a).localeCompare(getArtifactAssignmentKey(b))
  );

  function visit() {
    if (current.length === sorted.length) {
      results.push([...current]);
      return;
    }

    let previousKey: string | null = null;
    for (let i = 0; i < sorted.length; i++) {
      if (used[i]) continue;
      const key = getArtifactAssignmentKey(sorted[i]);
      if (key === previousKey) continue;
      previousKey = key;
      used[i] = true;
      current.push(sorted[i]);
      visit();
      current.pop();
      used[i] = false;
    }
  }

  visit();
  return results;
}

async function evaluateArtifactAssignment(
  configs: TeamSlotConfig[],
  assignment: (ArtifactSetConfig | null)[],
  combo: ComboFormula,
  calcContext: CalcContext,
  opts: Record<string, string>,
  enemyAura: Element | undefined,
  extraBuffs: ExtraBuff[],
  perChar: Record<string, { minEr: number; minCr: number }>,
  optimizePetra = false
): Promise<{ damage: number; combatOptions?: Record<string, string> } | null> {
  const candidateConfigs = configs.map((config, index) => ({
    ...config,
    artifactSet: assignment[index] ?? null,
  }));
  const rosterTeamBuild = new TeamBuild(
    candidateConfigs,
    opts,
    enemyAura,
    extraBuffs
  );
  const setKeysByChar = deriveSetKeysFromConfigs(
    candidateConfigs.map((config) => ({
      charId: config.charId,
      artifactSet: config.artifactSet,
    }))
  );
  const carryCharId = candidateConfigs[0]?.charId;
  if (!carryCharId) return null;

  const optionVariants =
    optimizePetra &&
    candidateConfigs.some(
      (config) =>
        config.artifactSet?.type === "4pc" &&
        config.artifactSet.setId === "archaic_petra"
    )
      ? getPetraComparisonOptions(
          rosterTeamBuild.teamMeta,
          opts,
          candidateConfigs
            .filter(
              (config) =>
                config.artifactSet?.type === "4pc" &&
                config.artifactSet.setId === "archaic_petra"
            )
            .map((config) => config.charId)
        )
      : [opts];
  let best: { damage: number; combatOptions?: Record<string, string> } | null =
    null;
  for (const candidateOpts of optionVariants) {
    const teamBuild =
      candidateOpts === opts
        ? rosterTeamBuild
        : new TeamBuild(candidateConfigs, candidateOpts, enemyAura, extraBuffs);
    const result = await runGeneratorToCompletion(
      teamBuild,
      carryCharId,
      combo,
      calcContext,
      perChar,
      setKeysByChar
    );
    if (
      !result ||
      Object.keys(result.failReasons).length > 0 ||
      Object.keys(
        getErCrConstraintFailures(
          teamBuild,
          result.sheetsByChar,
          calcContext,
          perChar
        )
      ).length > 0
    )
      continue;

    const sheets: Record<string, StatSheet> = {};
    for (const config of candidateConfigs) {
      const sheet = result.sheetsByChar[config.charId];
      if (sheet) sheets[config.charId] = sheet;
    }
    if (Object.keys(sheets).length === 0) continue;

    const damage = evaluateComboDamage(teamBuild, combo, sheets, calcContext);
    if (!best || damage > best.damage) {
      best = {
        damage,
        ...(candidateOpts !== opts
          ? { combatOptions: { archaic_petra: candidateOpts.archaic_petra } }
          : {}),
      };
    }
  }
  return best;
}

async function computeArtifactAssignmentSuggestion(
  configs: TeamSlotConfig[],
  combo: ComboFormula,
  calcContext: CalcContext,
  opts: Record<string, string>,
  enemyAura: Element | undefined,
  extraBuffs: ExtraBuff[],
  perChar: Record<string, { minEr: number; minCr: number }>
): Promise<ArtifactAssignmentSuggestion | null> {
  if (configs.length < 2) return null;

  const currentAssignment = configs.map((config) => config.artifactSet ?? null);
  const current = await evaluateArtifactAssignment(
    configs,
    currentAssignment,
    combo,
    calcContext,
    opts,
    enemyAura,
    extraBuffs,
    perChar
  );
  if (current == null) return null;

  const currentDamage = current.damage;
  let bestDamage = currentDamage;
  let bestAssignment = currentAssignment;
  let bestCombatOptions: Record<string, string> | undefined;
  for (const assignment of buildUniqueArtifactAssignments(currentAssignment)) {
    const evaluated = await evaluateArtifactAssignment(
      configs,
      assignment,
      combo,
      calcContext,
      opts,
      enemyAura,
      extraBuffs,
      perChar,
      true
    );
    if (evaluated != null && evaluated.damage > bestDamage) {
      bestDamage = evaluated.damage;
      bestAssignment = assignment;
      bestCombatOptions = evaluated.combatOptions;
    }
  }

  return {
    currentDamage,
    bestDamage,
    ...(bestCombatOptions ? { combatOptions: bestCombatOptions } : {}),
    percentImprovement:
      currentDamage > 0
        ? ((bestDamage - currentDamage) / currentDamage) * 100
        : 0,
    assignments: configs.map((config, index) => ({
      charId: config.charId,
      artifactSet: bestAssignment[index] ?? null,
    })),
  };
}

// ─── Main Generator ───

export async function* runWeaponChoice(
  options: WeaponChoiceOptions
): AsyncGenerator<WeaponChoiceResult, void> {
  const {
    mode = "weapon",
    baseConfigs,
    charConfigs,
    combo,
    calcContext,
    weaponStats,
    opts,
    enemyAura,
    extraBuffs,
  } = options;

  // Apply char config overrides to base configs
  const configs = buildOverriddenConfigs(baseConfigs, charConfigs);

  // Build generator-level params from char configs
  const perChar = buildPerChar(charConfigs);
  const setKeysByChar = buildSetKeysByChar(charConfigs);

  // Identify characters to evaluate
  const charIds = configs.map((c) => c.charId);

  // Build weapon candidates per character
  const candidatesPerChar: Record<string, WeaponCandidate[]> = {};
  for (const config of configs) {
    const ws = weaponStats[config.weaponId];
    if (!ws) continue;
    const candidates: WeaponCandidate[] = options.ownedWeaponChoices
      ? getCompatibleOwnedWeaponChoices(
          options.ownedWeaponChoices,
          ws.type,
          weaponStats
        ).map((choice) => ({ type: "weapon", ...choice }))
      : getWeaponCandidates(ws.type, weaponStats);
    candidatesPerChar[config.charId] = candidates;
  }

  // Yield initial progress
  yield {
    mode,
    timestamp: Date.now(),
    perCharacter: {},
    excludedChoices: {},
    artifactAssignmentSuggestion: null,
    done: false,
    progress: {
      phase: "initializing",
      overallProgress: 0,
    },
  };
  await yieldFrame();

  let artifactAssignmentSuggestion: ArtifactAssignmentSuggestion | null = null;
  if (mode === "artifact") {
    artifactAssignmentSuggestion = await computeArtifactAssignmentSuggestion(
      configs,
      combo,
      calcContext,
      opts,
      enemyAura,
      extraBuffs ?? [],
      perChar
    );
    yield {
      mode,
      timestamp: Date.now(),
      perCharacter: {},
      excludedChoices: {},
      artifactAssignmentSuggestion,
      done: false,
      progress: {
        phase: "evaluating artifact assignment",
        overallProgress: 0,
      },
    };
    await yieldFrame();
  }

  // Track per-character progress for merged reporting
  const perCharProgress: Record<
    string,
    { done: number; total: number; currentTarget?: string }
  > = {};
  const perCharacter: Record<string, ChoiceRanking[]> = {};
  const excludedChoices: Record<string, InfeasibleChoice[]> = {};

  // Pending progress updates queue — populated by parallel callbacks
  let hasPendingProgress = false;

  function getAggregatedProgress(): number {
    const entries = Object.values(perCharProgress);
    if (entries.length === 0) return 1;
    let sum = 0;
    for (const p of entries) sum += p.total > 0 ? p.done / p.total : 1;
    return sum / entries.length;
  }

  // Launch all characters in parallel
  const charPromises = charIds.map((targetCharId) => {
    const candidates =
      mode === "artifact"
        ? buildArtifactSetChoiceCandidates()
        : candidatesPerChar[targetCharId];
    if (!candidates || candidates.length === 0) {
      perCharacter[targetCharId] = [];
      excludedChoices[targetCharId] = [];
      return Promise.resolve();
    }

    perCharProgress[targetCharId] = {
      done: 0,
      total: candidates.length,
    };

    return computeForChar(
      targetCharId,
      candidates,
      configs,
      combo,
      calcContext,
      opts,
      enemyAura,
      extraBuffs ?? [],
      perChar,
      setKeysByChar,
      (choicesDone, currentTarget, totalChoices) => {
        perCharProgress[targetCharId].done = choicesDone;
        if (totalChoices != null) {
          perCharProgress[targetCharId].total = totalChoices;
        }
        perCharProgress[targetCharId].currentTarget = currentTarget;
        hasPendingProgress = true;
      }
    ).then(({ rankings, excludedChoices: excluded }) => {
      if (mode === "weapon" && options.ownedWeaponChoices) {
        // The best owned copy is 100%, including intermediate refinements.
        normalizeArtifactRankings(rankings);
      } else {
        normalizeRankings(mode, rankings, weaponStats);
      }
      perCharacter[targetCharId] = rankings;
      excludedChoices[targetCharId] = excluded;
    });
  });

  // Poll for progress while characters compute in parallel
  const allDone = Promise.all(charPromises);
  let settled = false;
  allDone.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );

  while (!settled) {
    await yieldFrame();
    if (hasPendingProgress || settled) {
      hasPendingProgress = false;

      const chars: CharProgress[] = Object.entries(perCharProgress).map(
        ([charId, p]) => ({
          charId,
          done: p.done,
          total: p.total,
          currentWeapon: p.done < p.total ? p.currentTarget : undefined,
          currentTarget: p.done < p.total ? p.currentTarget : undefined,
        })
      );

      yield {
        mode,
        timestamp: Date.now(),
        perCharacter: { ...perCharacter },
        excludedChoices: { ...excludedChoices },
        artifactAssignmentSuggestion,
        done: false,
        progress: {
          phase:
            mode === "artifact"
              ? "evaluating artifact sets"
              : "evaluating weapons",
          overallProgress: getAggregatedProgress(),
          chars,
        },
      };
    }
  }

  // Ensure all promises resolved (catches any errors)
  await allDone;

  // Final result
  yield {
    mode,
    timestamp: Date.now(),
    perCharacter,
    excludedChoices,
    artifactAssignmentSuggestion,
    done: true,
    progress: {
      phase: "done",
      overallProgress: 1,
    },
  };
}
