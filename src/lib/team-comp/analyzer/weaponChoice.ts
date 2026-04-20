/**
 * Weapon Choice computation engine.
 *
 * For each character in a team, generates ideal artifacts with every compatible
 * weapon candidate and ranks them by combo damage. Supports concurrent
 * evaluation via an async generator that yields progress updates.
 */

import { weaponsById } from "@/data/constants";
import type { Element, MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import type { WeaponStatsMap } from "@/lib/gameStatsLoader";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "../calc/formulaCompiler";
import type { StatSheet } from "../calc/statSheet";
import { TeamBuild } from "../calc/teamBuild";
import { getRollValues } from "../generator/constrainedGreedy";
import type { GeneratorResult } from "../generator/generator";
import { runGenerator } from "../generator/generator";
import { deriveSetKeysFromConfigs } from "../teamConfigUtils";

import type { ExtraBuff } from "../types";
import type { CalcContext, ComboFormula, TeamSlotConfig } from "../types";

import type {
  WeaponChoiceCharConfig,
  WeaponRanking,
} from "@/stores/useTeamStore";

export interface CharProgress {
  charId: string;
  done: number;
  total: number;
  currentWeapon?: string;
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
  timestamp: number;
  perCharacter: Record<string, WeaponRanking[]>;
  done: boolean;
  progress: WeaponChoiceProgress;
}

export interface WeaponChoiceOptions {
  baseConfigs: TeamSlotConfig[];
  charConfigs: WeaponChoiceCharConfig[];
  combo: ComboFormula;
  calcContext: CalcContext;
  weaponStats: WeaponStatsMap;
  opts: Record<string, string>;
  enemyAura?: Element;
  extraBuffs?: ExtraBuff[];
}

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
): { weaponId: string; refinement: number }[] {
  const candidates: { weaponId: string; refinement: number }[] = [];

  for (const [weaponId, stats] of Object.entries(weaponStats)) {
    if (stats.type !== weaponType) continue;
    const resource = weaponsById[weaponId];
    const rarity = resource?.rarity ?? stats.rarity;
    if (rarity <= 2) continue;

    if (rarity <= 4) {
      // 3★ and 4★: R5 only
      candidates.push({ weaponId, refinement: 5 });
    } else {
      // 5★: R1 and R5
      candidates.push({ weaponId, refinement: 1 });
      candidates.push({ weaponId, refinement: 5 });
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
      ? charConfig.artifactConfig.type === "4pc"
        ? {
            artifactSetId: charConfig.artifactConfig.setId,
            artifactHalfSetIds: [],
          }
        : {
            artifactSetId: null,
            artifactHalfSetIds: [
              String(charConfig.artifactConfig.id1),
              String(charConfig.artifactConfig.id2),
            ],
          }
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
 * Mirrors the logic in DamageDetail's generate handler.
 */
/** @internal Exported for testing only. */
export function buildSetKeysByChar(
  charConfigs: WeaponChoiceCharConfig[]
): Record<string, Record<Slot, string>> {
  return deriveSetKeysFromConfigs(
    charConfigs
      .filter((cc) => cc.artifactConfig != null)
      .map((cc) => {
        const ac = cc.artifactConfig!;
        return ac.type === "4pc"
          ? { charId: cc.charId, artifactSetId: ac.setId }
          : {
              charId: cc.charId,
              artifactHalfSetIds: [String(ac.id1), String(ac.id2)],
            };
      })
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
  setKeysByChar?: Record<string, Record<Slot, string>>
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

// ─── Per-character computation ───

/**
 * Compute weapon rankings for a single character.
 * Runs independently so multiple characters can be evaluated in parallel.
 */
async function computeForChar(
  targetCharId: string,
  candidates: { weaponId: string; refinement: number }[],
  configs: TeamSlotConfig[],
  charIds: string[],
  combo: ComboFormula,
  calcContext: CalcContext,
  weaponStats: WeaponStatsMap,
  opts: Record<string, string>,
  enemyAura: Element | undefined,
  extraBuffs: ExtraBuff[],
  perChar: Record<string, { minEr: number; minCr: number }>,
  setKeysByChar: Record<string, Record<Slot, string>>,
  onProgress: (weaponsDone: number, currentWeapon?: string) => void
): Promise<WeaponRanking[]> {
  const supportCharIds = charIds.filter((id) => id !== targetCharId);

  // Step 1: Generate supporter artifacts once using the roster weapon
  const rosterTeamBuild = new TeamBuild(configs, opts, enemyAura, extraBuffs);

  const rosterResult = await runGeneratorToCompletion(
    rosterTeamBuild,
    targetCharId,
    combo,
    calcContext,
    perChar,
    setKeysByChar
  );

  if (!rosterResult) return [];

  // Extract supporter sheets (fixed across weapon swaps)
  const supporterSheets: Record<string, StatSheet> = {};
  for (const sid of supportCharIds) {
    if (rosterResult.sheetsByChar[sid]) {
      supporterSheets[sid] = rosterResult.sheetsByChar[sid];
    }
  }

  // Step 2: For each weapon candidate, generate artifacts and evaluate
  const rankings: WeaponRanking[] = [];
  let weaponsDone = 0;

  for (const { weaponId, refinement } of candidates) {
    onProgress(weaponsDone, weaponId);

    const weaponConfigs = configs.map((c) =>
      c.charId === targetCharId ? { ...c, weaponId, refinement } : c
    );

    const weaponTeamBuild = new TeamBuild(
      weaponConfigs,
      opts,
      enemyAura,
      extraBuffs
    );

    const weaponResult = await runGeneratorToCompletion(
      weaponTeamBuild,
      targetCharId,
      combo,
      calcContext,
      perChar,
      setKeysByChar
    );

    if (!weaponResult) {
      weaponsDone++;
      continue;
    }

    const combinedSheets: Record<string, StatSheet> = {
      ...supporterSheets,
    };
    if (weaponResult.sheetsByChar[targetCharId]) {
      combinedSheets[targetCharId] = weaponResult.sheetsByChar[targetCharId];
    }

    const damage = evaluateComboDamage(
      weaponTeamBuild,
      combo,
      combinedSheets,
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

    rankings.push({
      weaponId,
      refinement,
      damage,
      percentOfBest: 0, // normalized after all weapons
      mainStats,
      substatRolls,
      artifactSetIds,
    });

    weaponsDone++;
  }

  onProgress(weaponsDone);
  return rankings;
}

/**
 * Normalize rankings using community-standard baseline:
 * Best among (4★ R5 / 5★ R1) = 100%. 5★ R5 can exceed 100%.
 */
function normalizeRankings(
  rankings: WeaponRanking[],
  weaponStats: WeaponStatsMap
): void {
  if (rankings.length === 0) return;

  // Find baseline: best damage among 4★ R5 and 5★ R1 weapons
  let baselineDamage = 0;
  for (const r of rankings) {
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

  // Sort by damage descending
  rankings.sort((a, b) => b.damage - a.damage);
}

// ─── Main Generator ───

export async function* runWeaponChoice(
  options: WeaponChoiceOptions
): AsyncGenerator<WeaponChoiceResult, void> {
  const {
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
  const candidatesPerChar: Record<
    string,
    { weaponId: string; refinement: number }[]
  > = {};
  for (const config of configs) {
    const ws = weaponStats[config.weaponId];
    if (!ws) continue;
    const candidates = getWeaponCandidates(ws.type, weaponStats);
    candidatesPerChar[config.charId] = candidates;
  }

  // Yield initial progress
  yield {
    timestamp: Date.now(),
    perCharacter: {},
    done: false,
    progress: {
      phase: "initializing",
      overallProgress: 0,
    },
  };
  await yieldFrame();

  // Track per-character progress for merged reporting
  const perCharProgress: Record<
    string,
    { done: number; total: number; currentWeapon?: string }
  > = {};
  const perCharacter: Record<string, WeaponRanking[]> = {};

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
    const candidates = candidatesPerChar[targetCharId];
    if (!candidates || candidates.length === 0) {
      perCharacter[targetCharId] = [];
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
      charIds,
      combo,
      calcContext,
      weaponStats,
      opts,
      enemyAura,
      extraBuffs ?? [],
      perChar,
      setKeysByChar,
      (weaponsDone, currentWeapon) => {
        perCharProgress[targetCharId].done = weaponsDone;
        perCharProgress[targetCharId].currentWeapon = currentWeapon;
        hasPendingProgress = true;
      }
    ).then((rankings) => {
      normalizeRankings(rankings, weaponStats);
      perCharacter[targetCharId] = rankings;
    });
  });

  // Poll for progress while characters compute in parallel
  const allDone = Promise.all(charPromises);
  let settled = false;
  allDone.then(() => {
    settled = true;
  });

  while (!settled) {
    await yieldFrame();
    if (hasPendingProgress || settled) {
      hasPendingProgress = false;

      const chars: CharProgress[] = Object.entries(perCharProgress).map(
        ([charId, p]) => ({
          charId,
          done: p.done,
          total: p.total,
          currentWeapon: p.done < p.total ? p.currentWeapon : undefined,
        })
      );

      yield {
        timestamp: Date.now(),
        perCharacter: { ...perCharacter },
        done: false,
        progress: {
          phase: "evaluating weapons",
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
    timestamp: Date.now(),
    perCharacter,
    done: true,
    progress: {
      phase: "done",
      overallProgress: 1,
    },
  };
}
