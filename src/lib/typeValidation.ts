/**
 * Runtime validation helpers for domain union types.
 *
 * Use these instead of bare `as Type` casts when the value comes from
 * an external/dynamic source (user input, parsed strings, JSON data).
 */
import {
  type BuildConstellation,
  type Element,
  type MainStat,
  type ReactionType,
  type Slot,
  type SubStat,
  TEAM_REACTION_OPTIONS,
  allSlots,
  buildConstellations,
  elements,
} from "@/data/types";

const ELEMENTS = new Set<string>(elements);
const SLOTS = new Set<string>(allSlots);
const CONSTELLATIONS = new Set<number>(buildConstellations);
const REACTIONS = new Set<string>([
  "none",
  ...TEAM_REACTION_OPTIONS,
  "quicken",
  "shatter",
  "crystallize",
]);

const MAIN_STATS = new Set<string>([
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "er",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
  "atk",
  "hp",
]);

const SUB_STATS = new Set<string>([
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "er",
  "em",
  "atk",
  "hp",
  "def",
]);

export function isElement(v: string): v is Element {
  return ELEMENTS.has(v);
}

export function isSlot(v: string): v is Slot {
  return SLOTS.has(v);
}

export function isMainStat(v: string): v is MainStat {
  return MAIN_STATS.has(v);
}

export function isSubStat(v: string): v is SubStat {
  return SUB_STATS.has(v);
}

export function isBuildConstellation(v: number): v is BuildConstellation {
  return CONSTELLATIONS.has(v);
}

export function isReactionType(v: string): v is ReactionType {
  return REACTIONS.has(v);
}

/** Parse a string as Element, returning fallback if invalid. */
export function parseElement(v: string, fallback: Element = "Anemo"): Element {
  return isElement(v) ? v : fallback;
}

/** Parse a number as BuildConstellation, returning fallback if invalid. */
export function parseBuildConstellation(
  v: number,
  fallback: BuildConstellation = 0
): BuildConstellation {
  return isBuildConstellation(v) ? v : fallback;
}
