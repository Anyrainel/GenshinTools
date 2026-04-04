/**
 * Artifact substat roll solver.
 *
 * Recovers precise pre-rounding substat values from game-displayed (rounded)
 * values by enumerating possible tier combinations and backtracking over
 * roll-count assignments.
 */

import { isFlatStat, isPctStat } from "@/data/constants";
import artifactStatData from "@/data/game/artifact_stat.json";

// ─── Constants ───

const MAX_ROLLS = 9;
const SUBSTATS = [
  "hp",
  "hp%",
  "atk",
  "atk%",
  "def",
  "def%",
  "er",
  "em",
  "cr",
  "cd",
] as const;
const RARITIES = [4, 5] as const;

// ─── Types ───

/** Map<"stat:rarity", Map<displayValue, Set<rollCount>>> */
export type RollTable = Map<string, Map<number, Set<number>>>;

export interface SolveInput {
  rarity: 4 | 5;
  level: number;
  substats: Partial<Record<string, number>>;
  totalRolls?: number;
}

// ─── Display conversion helpers ───

/** Convert raw JSON decimal to display format (same logic as constants.ts toDisplay) */
function toDisplay(stat: string, val: number): number {
  if (isFlatStat(stat)) return val;
  return Math.round(val * 1e6) / 1e4;
}

/** Round a display value the way the game does: flat→integer, pct→1 decimal */
export function gameRound(stat: string, displayVal: number): number {
  if (isFlatStat(stat)) return Math.round(displayVal);
  return Math.round(displayVal * 10) / 10;
}

// ─── Raw tier data in display format ───

function getRawTiers(
  stat: string,
  rarity: 4 | 5
): [number, number, number, number] {
  const raw =
    rarity === 5
      ? artifactStatData.subStats.rarity5
      : artifactStatData.subStats.rarity4;
  const tiers = (raw as Record<string, number[]>)[stat];
  return tiers.map((v) => toDisplay(stat, v)) as [
    number,
    number,
    number,
    number,
  ];
}

// ─── Roll Table ───

let cachedTable: RollTable | null = null;

/**
 * Build a lookup table mapping (stat, rarity) → displayValue → Set<rollCount>.
 * Enumerates all possible tier combinations for 1..MAX_ROLLS rolls.
 */
export function buildRollTable(): RollTable {
  if (cachedTable) return cachedTable;

  const table: RollTable = new Map();

  for (const stat of SUBSTATS) {
    for (const rarity of RARITIES) {
      const key = `${stat}:${rarity}`;
      const displayMap = new Map<number, Set<number>>();
      const tiers = getRawTiers(stat, rarity);

      // For each roll count, enumerate all tier combos (4^n) using
      // combinations with repetition. We iterate tier indices.
      for (let n = 1; n <= MAX_ROLLS; n++) {
        enumerateCombos(tiers, n, stat, displayMap);
      }

      table.set(key, displayMap);
    }
  }

  cachedTable = table;
  return table;
}

/**
 * Enumerate all combinations of `n` rolls from 4 tiers (with repetition).
 * Uses ordered selection (tier[0] <= tier[1] <= ...) to avoid duplicates,
 * since addition is commutative.
 */
function enumerateCombos(
  tiers: [number, number, number, number],
  n: number,
  stat: string,
  displayMap: Map<number, Set<number>>
): void {
  const indices = new Array<number>(n).fill(0);

  const process = () => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += tiers[indices[i]];
    const rounded = gameRound(stat, sum);
    let set = displayMap.get(rounded);
    if (!set) {
      set = new Set();
      displayMap.set(rounded, set);
    }
    set.add(n);
  };

  // Generate combinations with repetition using iterative approach
  // indices[0] <= indices[1] <= ... <= indices[n-1], each in [0,3]
  const generate = () => {
    // Start with all zeros
    process();
    // Iterate through all ordered combinations
    while (true) {
      // Find rightmost index that can be incremented
      let pos = n - 1;
      while (pos >= 0 && indices[pos] === 3) pos--;
      if (pos < 0) break;
      indices[pos]++;
      // Reset all positions to the right to the current value (non-decreasing)
      for (let j = pos + 1; j < n; j++) indices[j] = indices[pos];
      process();
    }
  };

  generate();
}

// ─── Precision detection ───

/**
 * Returns true if any substat already has more precision than game rounding
 * would produce (indicating the value is already a precise pre-rounding value).
 */
export function isAlreadyPrecise(
  substats: Partial<Record<string, number>>
): boolean {
  const entries = Object.entries(substats);
  if (entries.length === 0) return false;

  for (const [stat, value] of entries) {
    if (value === undefined) continue;
    if (isPctStat(stat)) {
      // Pct stats: game rounds to 1 decimal. If value has more precision, it's precise.
      const rounded = Math.round(value * 10) / 10;
      if (Math.abs(value - rounded) > 1e-9) return true;
    } else {
      // Flat stats: game rounds to integer. If value has decimals, it's precise.
      if (Math.abs(value - Math.round(value)) > 1e-9) return true;
    }
  }
  return false;
}

// ─── Solver ───

/**
 * Solve an artifact's substats to recover precise pre-rounding values.
 * Returns null if no valid solution exists.
 */
export function solveArtifact(
  input: SolveInput
): Partial<Record<string, number>> | null {
  const { rarity, level, substats } = input;

  // If already precise, return as-is
  if (isAlreadyPrecise(substats)) {
    return { ...substats };
  }

  const table = buildRollTable();
  const entries = Object.entries(substats).filter(
    ([, v]) => v !== undefined
  ) as [string, number][];

  if (entries.length === 0) return null;

  const numSubstats = entries.length;

  // Calculate upgrades from level
  const maxLevel = rarity === 5 ? 20 : 16;
  const upgradeInterval = 4;
  const upgrades = Math.min(
    Math.floor(level / upgradeInterval),
    maxLevel / upgradeInterval
  );

  // For each substat, find valid roll counts from the table
  const validRollCounts: Set<number>[] = entries.map(([stat, value]) => {
    const key = `${stat}:${rarity}`;
    const displayMap = table.get(key);
    if (!displayMap) return new Set<number>();
    const rounded = gameRound(stat, value);
    return displayMap.get(rounded) ?? new Set<number>();
  });

  // Check if any substat has no valid roll counts
  if (validRollCounts.some((s) => s.size === 0)) return null;

  // Convert sets to sorted arrays for iteration
  const rollArrays = validRollCounts.map((s) => Array.from(s).sort());

  // Determine possible totalRolls values
  // 5★: init = 3 or 4 substats, max_init = 4
  // 4★: init = 2 or 3 substats, max_init = 3
  const maxInit = rarity === 5 ? 4 : 3;
  const minInit = maxInit - 1; // 3 for 5★, 2 for 4★

  let totalRollsList: number[];
  if (input.totalRolls !== undefined) {
    totalRollsList = [input.totalRolls];
  } else {
    const possibleInits: number[] = [];
    if (level === 0) {
      // At level 0, init count = number of substats present
      possibleInits.push(numSubstats);
    } else {
      // Could have started with minInit or maxInit substats
      // Try both if artifact has 4 substats (fully upgraded)
      if (numSubstats >= maxInit) {
        // For 5★: try [3, 4]. For 4★: try [2, 3].
        possibleInits.push(minInit, maxInit);
      } else {
        possibleInits.push(Math.min(numSubstats, maxInit));
      }
    }

    totalRollsList = possibleInits.map((init) => init + upgrades);

    // Try lower init first for leveled artifacts (more common), higher first for lv0
    if (level === 0) {
      totalRollsList.sort((a, b) => b - a);
    } else {
      totalRollsList.sort((a, b) => a - b);
    }
  }

  // Try each totalRolls
  for (const totalRolls of totalRollsList) {
    const assignment = new Array<number>(numSubstats);
    if (backtrack(0, totalRolls, rollArrays, assignment, numSubstats)) {
      // Found valid assignment, reconstruct precise values
      return reconstruct(entries, assignment, rarity);
    }
  }

  return null;
}

/**
 * Backtrack to find an assignment of roll counts that sums to totalRolls.
 * Each substat must get at least 1 roll.
 */
function backtrack(
  idx: number,
  remaining: number,
  rollArrays: number[][],
  assignment: number[],
  total: number
): boolean {
  if (idx === total) {
    return remaining === 0;
  }

  const othersMin = minRemainingOthers(rollArrays, idx + 1, total);
  const othersMax = maxRemainingOthers(rollArrays, idx + 1, total);

  for (const rollCount of rollArrays[idx]) {
    const newRemaining = remaining - rollCount;
    if (newRemaining < othersMin) continue;
    if (newRemaining > othersMax) continue;
    assignment[idx] = rollCount;
    if (backtrack(idx + 1, newRemaining, rollArrays, assignment, total)) {
      return true;
    }
  }
  return false;
}

function minRemainingOthers(
  rollArrays: number[][],
  from: number,
  total: number
): number {
  let sum = 0;
  for (let i = from; i < total; i++) {
    sum += rollArrays[i][0]; // arrays are sorted, first is min
  }
  return sum;
}

function maxRemainingOthers(
  rollArrays: number[][],
  from: number,
  total: number
): number {
  let sum = 0;
  for (let i = from; i < total; i++) {
    sum += rollArrays[i][rollArrays[i].length - 1]; // last is max
  }
  return sum;
}

/**
 * Reconstruct precise values from the roll-count assignment.
 * - Pct stats: enumerate tier combos, find all sums rounding to display value,
 *   pick the HIGHEST (most generous interpretation).
 * - Flat stats: keep display-rounded value unchanged.
 */
function reconstruct(
  entries: [string, number][],
  assignment: number[],
  rarity: 4 | 5
): Partial<Record<string, number>> {
  const result: Partial<Record<string, number>> = {};

  for (let i = 0; i < entries.length; i++) {
    const [stat, displayValue] = entries[i];
    const rollCount = assignment[i];

    if (isFlatStat(stat)) {
      // Flat stats: keep rounded display value as-is
      result[stat] = displayValue;
    } else {
      // Pct stats: find highest precise sum that rounds to display value
      const tiers = getRawTiers(stat, rarity);
      const target = gameRound(stat, displayValue);
      let bestPrecise = Number.NEGATIVE_INFINITY;

      enumerateCombosPrecise(tiers, rollCount, (sum) => {
        const rounded = Math.round(sum * 10) / 10;
        if (rounded === target && sum > bestPrecise) {
          bestPrecise = sum;
        }
      });

      if (bestPrecise === Number.NEGATIVE_INFINITY) {
        // Should not happen if table lookup was correct
        result[stat] = displayValue;
      } else {
        // Keep full precision (round to 4dp to eliminate floating-point noise)
        result[stat] = Math.round(bestPrecise * 1e4) / 1e4;
      }
    }
  }

  return result;
}

/**
 * Enumerate all ordered combinations of `n` rolls from 4 tiers,
 * calling `callback` with each sum.
 */
function enumerateCombosPrecise(
  tiers: [number, number, number, number],
  n: number,
  callback: (sum: number) => void
): void {
  const indices = new Array<number>(n).fill(0);

  const process = () => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += tiers[indices[i]];
    callback(sum);
  };

  process();
  while (true) {
    let pos = n - 1;
    while (pos >= 0 && indices[pos] === 3) pos--;
    if (pos < 0) break;
    indices[pos]++;
    for (let j = pos + 1; j < n; j++) indices[j] = indices[pos];
    process();
  }
}
