import {
  AVERAGE_ROLL_MULTIPLIER,
  maxSubstatRolls,
  statPools,
} from "@/data/constants";
import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import { MAIN_STAT_5STAR } from "@/lib/buildArtifactStats";

import type { TeamBuild } from "./damageCalc";
import { StatSheet } from "./damageModels";
import type { CalcContext, DamageResult, StatKey } from "./types";

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
}

export interface IdealGenResult {
  artifactsByChar: Record<string, Record<Slot, ArtifactData>>;
  sheetsByChar: Record<string, StatSheet>;
  damage: number;
  damageResult: DamageResult | null;
  phase: string;
  progress: number;
  done: boolean;
}

// ─── Constants ───

/** Compute per-stat roll values for a given multiplier */
function getRollValues(multiplier: number): Record<SubStat, number> {
  const rv = {} as Record<SubStat, number>;
  for (const [stat, maxVal] of Object.entries(maxSubstatRolls[5])) {
    rv[stat as SubStat] = maxVal * multiplier;
  }
  return rv;
}

/** Convert a roll value to StatSheet-internal representation (percent stats ÷ 100) */
function rollToInternal(
  stat: SubStat,
  rolls: number,
  rv: Record<SubStat, number>
): number {
  const raw = rv[stat] * rolls;
  return isPctStat(stat) ? raw / 100 : raw;
}

function isPctStat(k: string): boolean {
  return k.endsWith("%") || k === "cr" || k === "cd" || k === "er";
}

const ROLLS_PER_ARTIFACT = 9;
const TOTAL_ROLLS = ROLLS_PER_ARTIFACT * 5; // 45
const MAX_SUBSTATS_PER_SLOT = 4;

// Valid main stat pools per slot
const mainStatPools: Record<Slot, readonly MainStat[]> = {
  flower: statPools.flower,
  plume: statPools.plume,
  sands: statPools.sands,
  goblet: statPools.goblet,
  circlet: statPools.circlet,
};

const allSubstats: readonly SubStat[] = statPools.substat;

// ─── Helpers ───

function getValidSubstats(slotMainStat: MainStat): SubStat[] {
  return allSubstats.filter((s) => s !== slotMainStat);
}

function evaluateDamage(
  teamBuild: TeamBuild,
  sheets: Record<string, StatSheet>,
  carryCharId: string,
  formulaId: string,
  ctx: CalcContext
): number {
  try {
    const teamStats = teamBuild.getTeamStats(sheets, carryCharId, ctx);
    const result = teamBuild.getDamageResult(
      carryCharId,
      formulaId,
      teamStats,
      ctx
    );
    return result.totalDamage;
  } catch {
    return 0;
  }
}

function buildSheetFromMainAndSubs(
  mainStats: Record<Slot, MainStat>,
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  rv: Record<SubStat, number>
): StatSheet {
  const combined: Partial<Record<StatKey, number>> = {};

  for (const slot of allSlots) {
    // Main stat
    const ms = mainStats[slot];
    const mainVal = MAIN_STAT_5STAR[ms as StatKey];
    if (mainVal !== undefined) {
      combined[ms as StatKey] = (combined[ms as StatKey] ?? 0) + mainVal;
    }

    // Substats
    const slotSubs = subRolls[slot];
    for (const [stat, rolls] of Object.entries(slotSubs)) {
      if (!rolls) continue;
      const val = rollToInternal(stat as SubStat, rolls, rv);
      combined[stat as StatKey] = (combined[stat as StatKey] ?? 0) + val;
    }
  }

  return StatSheet.fromRaw(combined);
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

    result[slot] = {
      id: `ideal-${charId}-${slot}`,
      setKey: slotSetKeys?.[slot] ?? "ideal",
      slotKey: slot,
      rarity: 5,
      mainStatKey: mainStats[slot],
      level: 20,
      lock: false,
      substats: subs,
    };
  }
  return result;
}

const emptySubRolls = (): Record<Slot, Partial<Record<SubStat, number>>> => ({
  flower: {},
  plume: {},
  sands: {},
  goblet: {},
  circlet: {},
});

// ─── Phase 1: Find best main stats ───

function findBestMainStats(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>
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

        const sheet = buildSheetFromMainAndSubs(mainStats, emptySubRolls(), rv);
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = evaluateDamage(
          teamBuild,
          sheets,
          carryCharId,
          formulaId,
          ctx
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

// ─── Phase 2: Fill substats via global one-roll-at-a-time hill climbing ───
//
// Each iteration:
//   1. Evaluate marginal gain of every substat (globally, not per-slot)
//   2. Pick the stat with highest gain
//   3. Find a slot that can accept it (not full, stat ≠ main stat,
//      stat already chosen or slot has < 4 distinct substats)
//   4. If no slot can accept the best stat, try the next best, etc.
//   5. Allocate one roll and repeat until all 45 rolls are placed.

function fillSubstats(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  mainStats: Record<Slot, MainStat>,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>
): Record<Slot, Partial<Record<SubStat, number>>> {
  const subRolls = emptySubRolls();

  // Per-slot tracking
  const slotTotalRolls: Record<Slot, number> = {
    flower: 0,
    plume: 0,
    sands: 0,
    goblet: 0,
    circlet: 0,
  };
  const chosenPerSlot: Record<Slot, Set<SubStat>> = {
    flower: new Set(),
    plume: new Set(),
    sands: new Set(),
    goblet: new Set(),
    circlet: new Set(),
  };

  const getSheet = () => buildSheetFromMainAndSubs(mainStats, subRolls, rv);
  const getSheets = () => ({ ...currentSheets, [charId]: getSheet() });

  /** Can this slot accept one more roll of `stat`? */
  const canPlace = (slot: Slot, stat: SubStat): boolean => {
    if (stat === (mainStats[slot] as string)) return false;
    if (slotTotalRolls[slot] >= ROLLS_PER_ARTIFACT) return false;
    if (chosenPerSlot[slot].has(stat)) return true; // already one of the 4
    return chosenPerSlot[slot].size < MAX_SUBSTATS_PER_SLOT; // room for a new substat
  };

  /** Find a slot to place `stat`, preferring slots with fewer total rolls. */
  const findSlot = (stat: SubStat): Slot | null => {
    let best: Slot | null = null;
    let bestRolls = Number.POSITIVE_INFINITY;
    for (const slot of allSlots) {
      if (canPlace(slot, stat) && slotTotalRolls[slot] < bestRolls) {
        best = slot;
        bestRolls = slotTotalRolls[slot];
      }
    }
    return best;
  };

  for (let roll = 0; roll < TOTAL_ROLLS; roll++) {
    const baseDmg = evaluateDamage(
      teamBuild,
      getSheets(),
      carryCharId,
      formulaId,
      ctx
    );

    // Evaluate marginal gain for every substat and rank them
    const gains: { stat: SubStat; gain: number }[] = [];
    for (const stat of allSubstats) {
      // Quick check: can any slot accept this stat?
      if (!allSlots.some((s) => canPlace(s, stat))) continue;

      // Temporarily add one roll to any slot (stat value is slot-independent)
      const testSlot = allSlots.find((s) => canPlace(s, stat))!;
      subRolls[testSlot][stat] = (subRolls[testSlot][stat] ?? 0) + 1;
      const newDmg = evaluateDamage(
        teamBuild,
        getSheets(),
        carryCharId,
        formulaId,
        ctx
      );
      subRolls[testSlot][stat]! -= 1;
      if (subRolls[testSlot][stat] === 0) delete subRolls[testSlot][stat];

      gains.push({ stat, gain: newDmg - baseDmg });
    }

    // Sort by gain descending
    gains.sort((a, b) => b.gain - a.gain);

    // Try to place the best stat; if no slot available, try next best
    let placed = false;
    for (const { stat } of gains) {
      const slot = findSlot(stat);
      if (slot) {
        subRolls[slot][stat] = (subRolls[slot][stat] ?? 0) + 1;
        slotTotalRolls[slot]++;
        chosenPerSlot[slot].add(stat);
        placed = true;
        break;
      }
    }

    if (!placed) break; // all slots full (shouldn't happen with correct math)
  }

  return subRolls;
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
  rv: Record<SubStat, number>
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
          rv
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = evaluateDamage(
          teamBuild,
          sheets,
          carryCharId,
          formulaId,
          ctx
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
  const { teamBuild, carryCharId, formulaId, calcContext, setKeysByChar } =
    opts;
  const rv = getRollValues(opts.rollMultiplier ?? AVERAGE_ROLL_MULTIPLIER);

  const allCharIds = Object.keys(teamBuild.getFormulaIds());
  const supportCharIds = allCharIds.filter((id) => id !== carryCharId);

  // Total steps: main(1+N) + sub(1+N) + reroll(1) + resub(1) = 2N+4
  const totalSteps = 2 * supportCharIds.length + 4;
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
      rv,
      setKeysByChar
    );

  // ── Step 1: Main stats for carry ──
  yield yieldProgress("carry: main stats");
  await yieldFrame();
  allMainStats[carryCharId] = findBestMainStats(
    teamBuild,
    carryCharId,
    carryCharId,
    formulaId,
    currentSheets,
    calcContext,
    rv
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    emptySubRolls(),
    rv
  );
  step++;

  // ── Step 2: Main stats for each support ──
  for (const sid of supportCharIds) {
    yield yieldProgress(`${sid}: main stats`);
    await yieldFrame();
    allMainStats[sid] = findBestMainStats(
      teamBuild,
      sid,
      carryCharId,
      formulaId,
      currentSheets,
      calcContext,
      rv
    );
    currentSheets[sid] = buildSheetFromMainAndSubs(
      allMainStats[sid],
      emptySubRolls(),
      rv
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
    rv
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    rv
  );
  step++;

  // ── Step 4: Substats for each support ──
  for (const sid of supportCharIds) {
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
      rv
    );
    currentSheets[sid] = buildSheetFromMainAndSubs(
      allMainStats[sid],
      allSubRolls[sid],
      rv
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
    rv
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    rv
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
    rv
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    rv
  );
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
      rv,
      setKeysByChar?.[charId]
    );
    sheetsByChar[charId] = currentSheets[charId] ?? new StatSheet([]);
  }

  let damage = 0;
  let damageResult: DamageResult | null = null;
  try {
    const teamStats = teamBuild.getTeamStats(
      currentSheets,
      carryCharId,
      calcContext
    );
    damageResult = teamBuild.getDamageResult(
      carryCharId,
      formulaId,
      teamStats,
      calcContext
    );
    damage = damageResult.totalDamage;
  } catch {
    // keep defaults
  }

  yield {
    artifactsByChar,
    sheetsByChar,
    damage,
    damageResult,
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
  rv: Record<SubStat, number>,
  setKeysByChar?: Record<string, Record<Slot, string>>
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
        rv,
        setKeysByChar?.[charId]
      );
      sheetsByChar[charId] = currentSheets[charId] ?? new StatSheet([]);
    }
  }

  let damage = 0;
  let damageResult: DamageResult | null = null;
  try {
    const teamStats = teamBuild.getTeamStats(currentSheets, carryCharId, ctx);
    damageResult = teamBuild.getDamageResult(
      carryCharId,
      formulaId,
      teamStats,
      ctx
    );
    damage = damageResult.totalDamage;
  } catch {
    // keep defaults
  }

  return {
    artifactsByChar,
    sheetsByChar,
    damage,
    damageResult,
    phase,
    progress,
    done: false,
  };
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
