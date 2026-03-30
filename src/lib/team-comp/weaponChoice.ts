/**
 * Weapon Choice computation engine.
 *
 * For each character in a team, generates ideal artifacts with every compatible
 * weapon candidate and ranks them by combo damage. Supports concurrent
 * evaluation via an async generator that yields progress updates.
 */

import { weaponsById } from "@/data/constants";
import type { Element } from "@/data/types";
import type { WeaponStatsMap } from "@/lib/gameStatsLoader";
import { TeamBuild } from "./damageCalc";
import type { StatSheet } from "./damageModels";
import type { ExtraBuff } from "./extraBuffTypes";
import { compileComboTeamDamage, fillVarsFromSheet } from "./formulaCompiler";
import type { GeneratorResult } from "./generator";
import { runGenerator } from "./generator";
import type { SubstatBudgetPreset } from "./substatBudget";
import type { CalcContext, ComboFormula, TeamSlotConfig } from "./types";

import type {
  WeaponChoiceCharConfig,
  WeaponRanking,
} from "@/stores/useTeamStore";

// ─── Types ───

export interface WeaponChoiceProgress {
  phase: string;
  overallProgress: number;
  currentChar?: string;
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
  rollMultiplier?: number;
  substatBudget?: SubstatBudgetPreset;
  weaponStats: WeaponStatsMap;
  opts: Record<string, string>;
  enemyAura?: Element;
  extraBuffs?: ExtraBuff[];
}

// ─── Helpers ───

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
 * Run the generator to completion and return the final result.
 * The generator yields intermediate results; we only need the final one.
 */
async function runGeneratorToCompletion(
  teamBuild: TeamBuild,
  carryCharId: string,
  combo: ComboFormula,
  calcContext: CalcContext,
  rollMultiplier?: number,
  substatBudget?: SubstatBudgetPreset
): Promise<GeneratorResult | null> {
  let lastResult: GeneratorResult | null = null;
  const gen = runGenerator({
    teamBuild,
    carryCharId,
    formula: { combo },
    calcContext,
    rollMultiplier,
    substatBudget,
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

// ─── Main Generator ───

export async function* runWeaponChoice(
  options: WeaponChoiceOptions
): AsyncGenerator<WeaponChoiceResult, void> {
  const {
    baseConfigs,
    charConfigs,
    combo,
    calcContext,
    rollMultiplier,
    substatBudget,
    weaponStats,
    opts,
    enemyAura,
    extraBuffs,
  } = options;

  // Apply char config overrides to base configs
  const configs = buildOverriddenConfigs(baseConfigs, charConfigs);
  const configMap = new Map(charConfigs.map((c) => [c.charId, c]));

  // Identify characters to evaluate
  const charIds = configs.map((c) => c.charId);

  // Build weapon candidates per character
  const candidatesPerChar: Record<
    string,
    { weaponId: string; refinement: number }[]
  > = {};
  let totalWeapons = 0;

  for (const config of configs) {
    const ws = weaponStats[config.weaponId];
    if (!ws) continue;
    const candidates = getWeaponCandidates(ws.type, weaponStats);
    candidatesPerChar[config.charId] = candidates;
    totalWeapons += candidates.length;
  }

  // Total work: for each character, we need to generate supporters once + 1 weapon eval each
  // Progress: supporters generation + per-weapon generation
  const totalChars = charIds.length;
  const perCharacter: Record<string, WeaponRanking[]> = {};
  let overallWeaponsDone = 0;

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

  // Process each character
  for (let charIdx = 0; charIdx < charIds.length; charIdx++) {
    const targetCharId = charIds[charIdx];
    const candidates = candidatesPerChar[targetCharId];
    if (!candidates || candidates.length === 0) continue;

    const targetConfig = configs.find((c) => c.charId === targetCharId)!;
    const supportCharIds = charIds.filter((id) => id !== targetCharId);

    // Step 1: Generate supporter artifacts once using the roster weapon
    // Build a TeamBuild with the roster weapon for this character
    const rosterTeamBuild = new TeamBuild(
      configs,
      opts,
      enemyAura,
      extraBuffs ?? []
    );

    // Generate ideal artifacts with carry = targetCharId using roster weapon
    // This gives us supporter stat sheets
    const rosterResult = await runGeneratorToCompletion(
      rosterTeamBuild,
      targetCharId,
      combo,
      calcContext,
      rollMultiplier,
      substatBudget
    );

    if (!rosterResult) continue;

    // Extract supporter sheets (these stay fixed across weapon swaps)
    const supporterSheets: Record<string, StatSheet> = {};
    for (const sid of supportCharIds) {
      if (rosterResult.sheetsByChar[sid]) {
        supporterSheets[sid] = rosterResult.sheetsByChar[sid];
      }
    }

    // Step 2: For each weapon candidate, generate artifacts for the target character and evaluate
    const rankings: WeaponRanking[] = [];

    for (let wi = 0; wi < candidates.length; wi++) {
      const { weaponId, refinement } = candidates[wi];

      yield {
        timestamp: Date.now(),
        perCharacter: { ...perCharacter },
        done: false,
        progress: {
          phase: "evaluating weapons",
          overallProgress: overallWeaponsDone / totalWeapons,
          currentChar: targetCharId,
          currentWeapon: weaponId,
        },
      };
      await yieldFrame();

      // Build configs with this weapon for the target character
      const weaponConfigs = configs.map((c) =>
        c.charId === targetCharId ? { ...c, weaponId, refinement } : c
      );

      // Build TeamBuild with the candidate weapon
      const weaponTeamBuild = new TeamBuild(
        weaponConfigs,
        opts,
        enemyAura,
        extraBuffs ?? []
      );

      // Generate ideal artifacts for the target character with this weapon
      const weaponResult = await runGeneratorToCompletion(
        weaponTeamBuild,
        targetCharId,
        combo,
        calcContext,
        rollMultiplier,
        substatBudget
      );

      if (!weaponResult) {
        overallWeaponsDone++;
        continue;
      }

      // Combine: target char's sheet from weapon run + supporter sheets
      const combinedSheets: Record<string, StatSheet> = {
        ...supporterSheets,
      };
      if (weaponResult.sheetsByChar[targetCharId]) {
        combinedSheets[targetCharId] = weaponResult.sheetsByChar[targetCharId];
      }

      // Evaluate combo damage
      const damage = evaluateComboDamage(
        weaponTeamBuild,
        combo,
        combinedSheets,
        calcContext
      );

      rankings.push({
        weaponId,
        refinement,
        damage,
        percentOfBest: 0, // will be normalized after all weapons
      });

      overallWeaponsDone++;
    }

    // Normalize percentOfBest
    if (rankings.length > 0) {
      const bestDamage = Math.max(...rankings.map((r) => r.damage));
      for (const r of rankings) {
        r.percentOfBest = bestDamage > 0 ? (r.damage / bestDamage) * 100 : 0;
      }
      // Sort by damage descending
      rankings.sort((a, b) => b.damage - a.damage);
    }

    perCharacter[targetCharId] = rankings;

    // Yield after each character is fully processed
    yield {
      timestamp: Date.now(),
      perCharacter: { ...perCharacter },
      done: false,
      progress: {
        phase: `completed ${targetCharId}`,
        overallProgress: overallWeaponsDone / totalWeapons,
        currentChar: targetCharId,
      },
    };
    await yieldFrame();
  }

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
