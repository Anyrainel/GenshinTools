import { isPctStat } from "@/components/team-comp/displayFormatters";
import {
  AVERAGE_ROLL_MULTIPLIER,
  artifactsById,
  maxSubstatRolls,
  statPools,
} from "@/data/constants";
import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import { getFixedMainStatValue } from "@/lib/account-data/artifactScore";

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

/** Compute per-stat roll values for a given multiplier and rarity */
function getRollValues(
  multiplier: number,
  rarity: 4 | 5 = 5
): Record<SubStat, number> {
  const rv = {} as Record<SubStat, number>;
  for (const [stat, maxVal] of Object.entries(maxSubstatRolls[rarity])) {
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

// 5★: 4 initial + 5 upgrades = 9; 4★: 3 initial + 1 unlock + 3 upgrades = 7
function rollsPerArtifact(rarity: 4 | 5): number {
  return rarity === 5 ? 9 : 7;
}
// 5★: 1 initial + up to 5 upgrades = 6; 4★: 1 initial + up to 3 upgrades = 4
function maxRollsPerStat(rarity: 4 | 5): number {
  return rarity === 5 ? 6 : 4;
}
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

function getValidSubstats(slotMainStat: MainStat): SubStat[] {
  return allSubstats.filter((s) => s !== slotMainStat);
}

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

function buildSheetFromMainAndSubs(
  mainStats: Record<Slot, MainStat>,
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5
): StatSheet {
  const combined: Partial<Record<StatKey, number>> = {};

  for (const slot of allSlots) {
    // Main stat (getFixedMainStatValue returns display %, convert to fraction)
    const ms = mainStats[slot];
    const rawVal = getFixedMainStatValue(ms, rarity);
    if (rawVal) {
      const mainVal = isPctStat(ms) ? rawVal / 100 : rawVal;
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
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): Record<Slot, Partial<Record<SubStat, number>>> {
  const subRolls = emptySubRolls();
  const maxRolls = rollsPerArtifact(rarity);
  const totalRolls = maxRolls * 5;

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

  const getSheet = () =>
    buildSheetFromMainAndSubs(mainStats, subRolls, rv, rarity);
  const getSheets = () => ({ ...currentSheets, [charId]: getSheet() });

  const statCap = maxRollsPerStat(rarity);

  /** Can this slot accept one more roll of `stat`? */
  const canPlace = (slot: Slot, stat: SubStat): boolean => {
    if (stat === (mainStats[slot] as string)) return false;
    if (slotTotalRolls[slot] >= maxRolls) return false;
    if ((subRolls[slot][stat] ?? 0) >= statCap) return false;
    if (chosenPerSlot[slot].has(stat)) {
      // Reserve remaining rolls for unchosen substats (1 each)
      const unchosenNeeded = MAX_SUBSTATS_PER_SLOT - chosenPerSlot[slot].size;
      return maxRolls - slotTotalRolls[slot] > unchosenNeeded;
    }
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

  for (let roll = 0; roll < totalRolls; roll++) {
    const baseDmg = evaluateDamage(
      teamBuild,
      getSheets(),
      carryCharId,
      formulaId,
      ctx,
      reactionOverride,
      combo,
      reactionOverrides
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
        ctx,
        reactionOverride,
        combo,
        reactionOverrides
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
