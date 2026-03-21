import type { MainStat, Slot, SubStat } from "@/data/types";
import { allSlots, mainStatsPlus } from "@/data/types";
import { SUB_WEIGHTS, pJoint } from "./tierMath";
import { getMainProb } from "./tierTableBuilder";
import type { FlexPattern, TriageRule } from "./types";

export const ELEMENT_MAINS = new Set<MainStat>([
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
]);

const SUB_ORDER: Record<SubStat, number> = {
  cr: 0,
  cd: 1,
  "atk%": 2,
  "hp%": 3,
  "def%": 4,
  er: 5,
  em: 6,
  atk: 7,
  hp: 8,
  def: 9,
};

export function sortSubs(subs: SubStat[]): SubStat[] {
  return [...subs].sort((a, b) => (SUB_ORDER[a] ?? 99) - (SUB_ORDER[b] ?? 99));
}

// ---------------------------------------------------------------------------
// Curated templates (compact authoring format)
// ---------------------------------------------------------------------------

type FlexSub = SubStat | "flat";
type RawFlex = [Slot, (MainStat | "elemental%")[], FlexSub[], boolean?];

const CURATED: RawFlex[] = [
  // ── Flower ──────────────────────────────────────────────────────────────
  ["flower", ["hp"], ["cr", "cd", "atk%", "atk"]],
  ["flower", ["hp"], ["cr", "cd", "def%", "def"]],
  ["flower", ["hp"], ["cr", "cd", "atk%", "er"]],
  ["flower", ["hp"], ["cr", "cd", "hp%", "er"]],
  ["flower", ["hp"], ["cr", "cd", "def%", "er"]],
  ["flower", ["hp"], ["cr", "cd", "atk%", "em"]],
  ["flower", ["hp"], ["cr", "cd", "hp%", "em"]],
  ["flower", ["hp"], ["cr", "cd", "def%", "em"]],

  // ── Plume ──────────────────────────────────────────────────────────────
  ["plume", ["atk"], ["cr", "cd", "hp%", "hp"]],
  ["plume", ["atk"], ["cr", "cd", "def%", "def"]],
  ["plume", ["atk"], ["cr", "cd", "atk%", "er"]],
  ["plume", ["atk"], ["cr", "cd", "hp%", "er"]],
  ["plume", ["atk"], ["cr", "cd", "def%", "er"]],
  ["plume", ["atk"], ["cr", "cd", "atk%", "em"]],
  ["plume", ["atk"], ["cr", "cd", "hp%", "em"]],
  ["plume", ["atk"], ["cr", "cd", "def%", "em"]],

  // ── Sands ──────────────────────────────────────────────────────────────
  ["sands", ["em"], ["cr", "cd"]],
  ["sands", ["er"], ["cr", "cd"]],
  ["sands", ["atk%", "hp%", "def%"], ["cr", "cd"]],
  ["sands", ["atk%", "hp%", "def%"], ["cr", "cd", "flat"]],
  ["sands", ["atk%", "hp%", "def%"], ["cr", "cd", "er"]],
  ["sands", ["atk%", "hp%", "def%"], ["cr", "cd", "em"]],
  ["sands", ["er"], ["cr", "atk%", "atk"]],
  ["sands", ["er"], ["cr", "def%", "def"]],
  ["sands", ["er"], ["cr", "hp%", "hp"]],

  // ── Goblet ─────────────────────────────────────────────────────────────
  ["goblet", ["elemental%"], ["cr", "cd"]],
  ["goblet", ["phys%"], ["cr", "cd"]],
  ["goblet", ["em"], ["cr", "cd"]],
  ["goblet", ["atk%", "hp%", "def%"], ["cr", "cd"]],
  ["goblet", ["atk%", "hp%", "def%"], ["cr", "cd", "flat"]],
  ["goblet", ["atk%", "hp%", "def%"], ["cr", "cd", "er"]],
  ["goblet", ["atk%", "hp%", "def%"], ["cr", "cd", "em"]],
  ["goblet", ["atk%"], ["cr", "er", "atk"]],

  // ── Circlet ────────────────────────────────────────────────────────────
  ["circlet", ["em"], ["cr", "cd"]],
  ["circlet", ["cr"], ["cd", "atk%"]],
  ["circlet", ["cr"], ["cd", "def%"]],
  ["circlet", ["cr"], ["cd", "hp%"]],
  ["circlet", ["cr"], ["cd", "em"]],
  ["circlet", ["cd"], ["cr", "atk%"]],
  ["circlet", ["cd"], ["cr", "def%"]],
  ["circlet", ["cd"], ["cr", "hp%"]],
  ["circlet", ["cd"], ["cr", "em"]],
  ["circlet", ["atk%", "hp%", "def%"], ["cr", "cd"], true],
  ["circlet", ["atk%", "hp%", "def%"], ["cr", "cd", "flat"]],
  ["circlet", ["atk%", "hp%", "def%"], ["cr", "cd", "er"]],
  ["circlet", ["atk%", "hp%", "def%"], ["cr", "cd", "em"]],
  ["circlet", ["heal%"], ["atk%", "er"]],
  ["circlet", ["heal%"], ["hp%", "er"]],
  ["circlet", ["heal%"], ["def%", "er"]],
  ["circlet", ["heal%"], ["cr", "cd"], true],
  ["circlet", ["atk%"], ["cr", "er", "atk"]],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NON_SUB = new Set([
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
]);

function makePool(exclude: string[]): Record<string, number> {
  const pool: Record<string, number> = { ...SUB_WEIGHTS };
  for (const s of exclude) delete pool[s];
  return pool;
}

function resolveFlat(mainStat: MainStat): SubStat | null {
  if (mainStat === "atk%") return "atk";
  if (mainStat === "hp%") return "hp";
  if (mainStat === "def%") return "def";
  return null;
}

function resolveSubs(subs: FlexSub[], mainStat: MainStat): SubStat[] | null {
  const result: SubStat[] = [];
  for (const s of subs) {
    if (s === "flat") {
      const f = resolveFlat(mainStat);
      if (!f) return null;
      result.push(f);
    } else {
      result.push(s);
    }
  }
  return result;
}

function expandMainStats(mainStats: (MainStat | "elemental%")[]): MainStat[] {
  const result: MainStat[] = [];
  for (const ms of mainStats) {
    if (ms === "elemental%") {
      for (const e of ELEMENT_MAINS) result.push(e);
    } else {
      result.push(ms);
    }
  }
  return result;
}

function computeRarity(
  slot: Slot,
  mainStat: MainStat,
  subs: SubStat[]
): number {
  const pool = makePool(NON_SUB.has(mainStat) ? [] : [mainStat]);
  if (!subs.every((s) => pool[s] != null)) return -1;
  const p = pJoint(pool, subs, [], subs.length, 0, 3);
  if (p <= 0) return -1;
  return getMainProb(slot, mainStat) * p;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expands the curated templates into individual FlexPatterns —
 * one per (slot, mainStat, resolvedSubs) combination.
 */
export function buildFlexPatterns(_rules: TriageRule[]): FlexPattern[] {
  const mainOrder = Object.fromEntries(mainStatsPlus.map((s, i) => [s, i]));
  const slotOrder = Object.fromEntries(allSlots.map((s, i) => [s, i]));
  const results: FlexPattern[] = [];

  for (const [slot, mainStats, subs, defaultOff] of CURATED) {
    for (const ms of expandMainStats(mainStats)) {
      const resolved = resolveSubs(subs, ms);
      if (!resolved) continue;

      const sorted = sortSubs(resolved);
      const rarity = computeRarity(slot, ms, sorted);
      if (rarity < 0) continue;

      const key = `flex:${slot}:${ms}:${sorted.join(",")}`;
      const pattern: FlexPattern = {
        key,
        slot,
        mainStat: ms,
        requiredSubs: sorted,
        rarity,
      };
      if (defaultOff) pattern.defaultOff = true;
      results.push(pattern);
    }
  }

  // Sort: slot → main stat → substats
  results.sort((a, b) => {
    const s = (slotOrder[a.slot] ?? 99) - (slotOrder[b.slot] ?? 99);
    if (s !== 0) return s;
    const m = (mainOrder[a.mainStat] ?? 99) - (mainOrder[b.mainStat] ?? 99);
    if (m !== 0) return m;
    return a.requiredSubs.join(",").localeCompare(b.requiredSubs.join(","));
  });

  return results;
}
