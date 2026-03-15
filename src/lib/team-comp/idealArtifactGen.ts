import { isPctStat } from "@/components/team-comp/displayFormatters";
import {
  AVERAGE_ROLL_MULTIPLIER,
  artifactsById,
  statPools,
} from "@/data/constants";
import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";

import {
  buildSheetFromMainAndSubs,
  constrainedGreedyAllocate,
  emptySubRolls,
  getRollValues,
  rollToInternal,
} from "./constrainedGreedy";
import type { TeamBuild } from "./damageCalc";
import { evaluateCombo } from "./damageCalc";
import { StatSheet } from "./damageModels";
import type {
  CalcContext,
  ComboFormula,
  ComboResult,
  DamageResult,
  ReactionOverride,
  StatKey,
} from "./types";

// ─── Types ───

export interface IdealGenOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  formulaId: string;
  calcContext: CalcContext;
  /** Per-char, per-slot artifact set key for proper icon rendering */
  setKeysByChar?: Record<string, Record<Slot, string>>;
  /** Substat roll magnitude multiplier (0.7–1.0, default 0.85) */
  rollMultiplier?: number;
  /** Override reaction types for the damage formula */
  reactionOverride?: ReactionOverride;
  /** Combo formula for combo mode */
  combo?: ComboFormula;
  /** Per-formula reaction overrides for combo mode */
  reactionOverrides?: Record<string, ReactionOverride>;
}

export interface IdealGenResult {
  artifactsByChar: Record<string, Record<Slot, ArtifactData>>;
  sheetsByChar: Record<string, StatSheet>;
  damage: number;
  damageResult: DamageResult | null;
  comboResult?: ComboResult;
  phase: string;
  progress: number;
  done: boolean;
}

// ─── Constants ───

// Valid main stat pools per slot
const mainStatPools: Record<Slot, readonly MainStat[]> = {
  flower: statPools.flower,
  plume: statPools.plume,
  sands: statPools.sands,
  goblet: statPools.goblet,
  circlet: statPools.circlet,
};

/** Determine artifact rarity for a character from their set keys */
function getCharRarity(
  charId: string,
  setKeysByChar?: Record<string, Record<Slot, string>>
): 4 | 5 {
  const slotKeys = setKeysByChar?.[charId];
  if (!slotKeys) return 5;
  for (const slot of allSlots) {
    const setKey = slotKeys[slot];
    if (setKey && artifactsById[setKey]?.rarity === 4) return 4;
  }
  return 5;
}

// ─── Helpers ───

function evaluateDamage(
  teamBuild: TeamBuild,
  sheets: Record<string, StatSheet>,
  carryCharId: string,
  formulaId: string,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): number {
  try {
    if (combo) {
      return evaluateCombo(teamBuild, combo, sheets, ctx, reactionOverrides)
        .totalDamage;
    }
    const teamStats = teamBuild.getTeamStats(sheets, carryCharId, ctx);
    const result = teamBuild.getDamageResult(
      carryCharId,
      formulaId,
      teamStats,
      ctx,
      reactionOverride
    );
    return result.totalDamage;
  } catch (e) {
    console.warn(
      `[idealArtifactGen] evaluateDamage failed for ${carryCharId}/${formulaId}:`,
      e
    );
    return 0;
  }
}

function synthesizeArtifacts(
  charId: string,
  mainStats: Record<Slot, MainStat>,
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  rv: Record<SubStat, number>,
  slotSetKeys?: Record<Slot, string>
): Record<Slot, ArtifactData> {
  const result = {} as Record<Slot, ArtifactData>;
  for (const slot of allSlots) {
    const subs: Partial<Record<SubStat, number>> = {};
    const slotSubs = subRolls[slot];
    for (const [stat, rolls] of Object.entries(slotSubs)) {
      if (!rolls) continue;
      // Display format: percent stats as e.g. 13.26 for 13.26%, flat stats as-is
      subs[stat as SubStat] = +(rv[stat as SubStat] * rolls).toFixed(2);
    }

    const setKey = slotSetKeys?.[slot] ?? "ideal";
    result[slot] = {
      id: `ideal-${charId}-${slot}`,
      setKey,
      slotKey: slot,
      rarity: artifactsById[setKey]?.rarity ?? 5,
      mainStatKey: mainStats[slot],
      level: (artifactsById[setKey]?.rarity ?? 5) === 4 ? 16 : 20,
      lock: false,
      substats: subs,
    };
  }
  return result;
}

// ─── Phase 1: Find best main stats ───

function findBestMainStats(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): Record<Slot, MainStat> {
  let bestDamage = -1;
  let bestMainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "atk%",
    circlet: "cr",
  };

  // flower and plume are fixed
  for (const sands of mainStatPools.sands) {
    for (const goblet of mainStatPools.goblet) {
      for (const circlet of mainStatPools.circlet) {
        const mainStats: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands,
          goblet,
          circlet,
        };

        const sheet = buildSheetFromMainAndSubs(
          mainStats,
          emptySubRolls(),
          rv,
          rarity
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = evaluateDamage(
          teamBuild,
          sheets,
          carryCharId,
          formulaId,
          ctx,
          reactionOverride,
          combo,
          reactionOverrides
        );

        if (dmg > bestDamage) {
          bestDamage = dmg;
          bestMainStats = mainStats;
        }
      }
    }
  }

  return bestMainStats;
}

// ─── Phase 2: Fill substats via constrained greedy allocation ───
//
// Delegates to the shared constrainedGreedyAllocate, which respects:
// - 4 distinct substats per artifact
// - Main stat / substat exclusion
// - Per-stat and per-artifact roll caps

function fillSubstats(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  mainStats: Record<Slot, MainStat>,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): Record<Slot, Partial<Record<SubStat, number>>> {
  return constrainedGreedyAllocate({
    charId,
    mainStats,
    currentSheets,
    evalDamage: (sheets) =>
      evaluateDamage(
        teamBuild,
        sheets,
        carryCharId,
        formulaId,
        ctx,
        reactionOverride,
        combo,
        reactionOverrides
      ),
    rv,
    rarity,
  });
}

// ─── Phase 1b: Find best main stats ignoring main/sub conflicts ───
// Used for carry refinement: substats are cleared and regenerated afterward,
// so we don't need to worry about a substat matching the new main stat.

function findBestMainStatsWithSubs(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  existingSubRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): Record<Slot, MainStat> {
  let bestDamage = -1;
  let bestMainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "atk%",
    circlet: "cr",
  };

  for (const sands of mainStatPools.sands) {
    for (const goblet of mainStatPools.goblet) {
      for (const circlet of mainStatPools.circlet) {
        const mainStats: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands,
          goblet,
          circlet,
        };

        // Evaluate with existing substats still present (ignore conflicts)
        const sheet = buildSheetFromMainAndSubs(
          mainStats,
          existingSubRolls,
          rv,
          rarity
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = evaluateDamage(
          teamBuild,
          sheets,
          carryCharId,
          formulaId,
          ctx,
          reactionOverride,
          combo,
          reactionOverrides
        );

        if (dmg > bestDamage) {
          bestDamage = dmg;
          bestMainStats = mainStats;
        }
      }
    }
  }

  return bestMainStats;
}

// ─── Multi-pass Generator ───
//
// Pass order:
//   1. Main stats for carry
//   2. Main stats for each support
//   3. Substats for carry (step by step)
//   4. Substats for each support (step by step)
//   5. Re-roll main stats for carry (with substats present, ignore conflicts)
//   6. Clear & regenerate substats for carry

export async function* runIdealArtifactGen(
  opts: IdealGenOptions
): AsyncGenerator<IdealGenResult> {
  const {
    teamBuild,
    carryCharId,
    formulaId,
    calcContext,
    setKeysByChar,
    reactionOverride,
    combo,
    reactionOverrides,
  } = opts;
  const rollMult = opts.rollMultiplier ?? AVERAGE_ROLL_MULTIPLIER;

  // Per-character rarity and roll values
  const charRarity: Record<string, 4 | 5> = {};
  const charRv: Record<string, Record<SubStat, number>> = {};
  const allCharIds = Object.keys(teamBuild.getFormulaIds());
  for (const cid of allCharIds) {
    const r = getCharRarity(cid, setKeysByChar);
    charRarity[cid] = r;
    charRv[cid] = getRollValues(rollMult, r);
  }
  // Default rv for makeResult (uses 5★ for progress display)
  const rv = getRollValues(rollMult);
  const supportCharIds = allCharIds.filter((id) => id !== carryCharId);

  // Total steps: main(1+N) + sub(1+N) + reroll(1) + resub(1) + crcd(1) = 2N+5
  const totalSteps = 2 * supportCharIds.length + 5;
  let step = 0;

  const currentSheets: Record<string, StatSheet> = {};
  for (const cid of allCharIds) {
    currentSheets[cid] = new StatSheet([]);
  }

  const allMainStats: Record<string, Record<Slot, MainStat>> = {};
  const allSubRolls: Record<
    string,
    Record<Slot, Partial<Record<SubStat, number>>>
  > = {};

  const yieldProgress = (phase: string) =>
    makeResult(
      currentSheets,
      allMainStats,
      allSubRolls,
      allCharIds,
      phase,
      step / totalSteps,
      teamBuild,
      carryCharId,
      formulaId,
      calcContext,
      charRv,
      setKeysByChar,
      reactionOverride,
      combo,
      reactionOverrides
    );

  // ── Step 1: Main stats for carry ──
  const carryR = charRarity[carryCharId] ?? 5;
  const carryRv = charRv[carryCharId] ?? rv;
  yield yieldProgress("carry: main stats");
  await yieldFrame();
  allMainStats[carryCharId] = findBestMainStats(
    teamBuild,
    carryCharId,
    carryCharId,
    formulaId,
    currentSheets,
    calcContext,
    carryRv,
    carryR,
    reactionOverride,
    combo,
    reactionOverrides
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    emptySubRolls(),
    carryRv,
    carryR
  );
  step++;

  // ── Step 2: Main stats for each support ──
  for (const sid of supportCharIds) {
    const sR = charRarity[sid] ?? 5;
    const sRv = charRv[sid] ?? rv;
    yield yieldProgress(`${sid}: main stats`);
    await yieldFrame();
    allMainStats[sid] = findBestMainStats(
      teamBuild,
      sid,
      carryCharId,
      formulaId,
      currentSheets,
      calcContext,
      sRv,
      sR,
      reactionOverride,
      combo,
      reactionOverrides
    );
    currentSheets[sid] = buildSheetFromMainAndSubs(
      allMainStats[sid],
      emptySubRolls(),
      sRv,
      sR
    );
    step++;
  }

  // ── Step 3: Substats for carry ──
  yield yieldProgress("carry: substats");
  await yieldFrame();
  allSubRolls[carryCharId] = fillSubstats(
    teamBuild,
    carryCharId,
    carryCharId,
    formulaId,
    allMainStats[carryCharId],
    currentSheets,
    calcContext,
    carryRv,
    carryR,
    reactionOverride,
    combo,
    reactionOverrides
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    carryRv,
    carryR
  );
  step++;

  // ── Step 4: Substats for each support ──
  for (const sid of supportCharIds) {
    const sR = charRarity[sid] ?? 5;
    const sRv = charRv[sid] ?? rv;
    yield yieldProgress(`${sid}: substats`);
    await yieldFrame();
    allSubRolls[sid] = fillSubstats(
      teamBuild,
      sid,
      carryCharId,
      formulaId,
      allMainStats[sid],
      currentSheets,
      calcContext,
      sRv,
      sR,
      reactionOverride,
      combo,
      reactionOverrides
    );
    currentSheets[sid] = buildSheetFromMainAndSubs(
      allMainStats[sid],
      allSubRolls[sid],
      sRv,
      sR
    );
    step++;
  }

  // ── Step 5: Re-roll main stats for carry (ignore main/sub conflicts) ──
  yield yieldProgress("carry: refine main stats");
  await yieldFrame();
  allMainStats[carryCharId] = findBestMainStatsWithSubs(
    teamBuild,
    carryCharId,
    carryCharId,
    formulaId,
    currentSheets,
    allSubRolls[carryCharId],
    calcContext,
    carryRv,
    carryR,
    reactionOverride,
    combo,
    reactionOverrides
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    carryRv,
    carryR
  );
  step++;

  // ── Step 6: Clear & regenerate substats for carry ──
  yield yieldProgress("carry: refine substats");
  await yieldFrame();
  allSubRolls[carryCharId] = fillSubstats(
    teamBuild,
    carryCharId,
    carryCharId,
    formulaId,
    allMainStats[carryCharId],
    currentSheets,
    calcContext,
    carryRv,
    carryR,
    reactionOverride,
    combo,
    reactionOverrides
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    carryRv,
    carryR
  );
  step++;

  // ── Step 7: CR/CD circlet branching ──
  // Greedy tends to lock into one CR/CD path due to their multiplicative
  // relationship. If circlet is CR or CD, try the alternative with fresh
  // substat allocation and keep whichever yields higher damage.
  const currentCirclet = allMainStats[carryCharId].circlet;
  const altCirclet: MainStat | null =
    currentCirclet === "cr" ? "cd" : currentCirclet === "cd" ? "cr" : null;

  if (altCirclet) {
    yield yieldProgress("carry: compare cr/cd circlet");
    await yieldFrame();

    const currentDmg = evaluateDamage(
      teamBuild,
      currentSheets,
      carryCharId,
      formulaId,
      calcContext,
      reactionOverride,
      combo,
      reactionOverrides
    );

    // Try the alternative circlet with fresh substats
    const altMainStats = { ...allMainStats[carryCharId], circlet: altCirclet };
    const altSubRolls = fillSubstats(
      teamBuild,
      carryCharId,
      carryCharId,
      formulaId,
      altMainStats,
      currentSheets,
      calcContext,
      carryRv,
      carryR,
      reactionOverride,
      combo,
      reactionOverrides
    );
    const altSheet = buildSheetFromMainAndSubs(
      altMainStats,
      altSubRolls,
      carryRv,
      carryR
    );
    const altSheets = { ...currentSheets, [carryCharId]: altSheet };
    const altDmg = evaluateDamage(
      teamBuild,
      altSheets,
      carryCharId,
      formulaId,
      calcContext,
      reactionOverride,
      combo,
      reactionOverrides
    );

    if (altDmg > currentDmg) {
      allMainStats[carryCharId] = altMainStats;
      allSubRolls[carryCharId] = altSubRolls;
      currentSheets[carryCharId] = altSheet;
    }
  }
  step++;

  // ── Final result ──
  const artifactsByChar: Record<string, Record<Slot, ArtifactData>> = {};
  const sheetsByChar: Record<string, StatSheet> = {};

  for (const charId of allCharIds) {
    const ms = allMainStats[charId] ?? {
      flower: "hp" as MainStat,
      plume: "atk" as MainStat,
      sands: "atk%" as MainStat,
      goblet: "atk%" as MainStat,
      circlet: "cr" as MainStat,
    };
    const sr = allSubRolls[charId] ?? emptySubRolls();
    artifactsByChar[charId] = synthesizeArtifacts(
      charId,
      ms,
      sr,
      charRv[charId] ?? rv,
      setKeysByChar?.[charId]
    );
    sheetsByChar[charId] = currentSheets[charId] ?? new StatSheet([]);
  }

  let damage = 0;
  let damageResult: DamageResult | null = null;
  let finalComboResult: ComboResult | undefined;
  try {
    if (combo) {
      finalComboResult = evaluateCombo(
        teamBuild,
        combo,
        currentSheets,
        calcContext,
        reactionOverrides
      );
      damage = finalComboResult.totalDamage;
    } else {
      const teamStats = teamBuild.getTeamStats(
        currentSheets,
        carryCharId,
        calcContext
      );
      damageResult = teamBuild.getDamageResult(
        carryCharId,
        formulaId,
        teamStats,
        calcContext,
        reactionOverride
      );
      damage = damageResult.totalDamage;
    }
  } catch (e) {
    console.warn(
      `[idealArtifactGen] final damage calc failed for ${carryCharId}:`,
      e
    );
  }

  yield {
    artifactsByChar,
    sheetsByChar,
    damage,
    damageResult,
    comboResult: finalComboResult,
    phase: "done",
    progress: 1,
    done: true,
  };
}

// ─── Utility ───

function makeResult(
  currentSheets: Record<string, StatSheet>,
  allMainStats: Record<string, Record<Slot, MainStat>>,
  allSubRolls: Record<string, Record<Slot, Partial<Record<SubStat, number>>>>,
  allCharIds: string[],
  phase: string,
  progress: number,
  teamBuild: TeamBuild,
  carryCharId: string,
  formulaId: string,
  ctx: CalcContext,
  charRvMap: Record<string, Record<SubStat, number>>,
  setKeysByChar?: Record<string, Record<Slot, string>>,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): IdealGenResult {
  const artifactsByChar: Record<string, Record<Slot, ArtifactData>> = {};
  const sheetsByChar: Record<string, StatSheet> = {};

  for (const charId of allCharIds) {
    const ms = allMainStats[charId];
    const sr = allSubRolls[charId];
    if (ms && sr) {
      artifactsByChar[charId] = synthesizeArtifacts(
        charId,
        ms,
        sr,
        charRvMap[charId],
        setKeysByChar?.[charId]
      );
      sheetsByChar[charId] = currentSheets[charId] ?? new StatSheet([]);
    }
  }

  let damage = 0;
  let damageResult: DamageResult | null = null;
  let comboResult: ComboResult | undefined;
  try {
    if (combo) {
      comboResult = evaluateCombo(
        teamBuild,
        combo,
        currentSheets,
        ctx,
        reactionOverrides
      );
      damage = comboResult.totalDamage;
    } else {
      const teamStats = teamBuild.getTeamStats(currentSheets, carryCharId, ctx);
      damageResult = teamBuild.getDamageResult(
        carryCharId,
        formulaId,
        teamStats,
        ctx,
        reactionOverride
      );
      damage = damageResult.totalDamage;
    }
  } catch (e) {
    console.warn(
      `[idealArtifactGen] snapshot damage calc failed for ${carryCharId}:`,
      e
    );
  }

  return {
    artifactsByChar,
    sheetsByChar,
    damage,
    damageResult,
    comboResult,
    phase,
    progress,
    done: false,
  };
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
