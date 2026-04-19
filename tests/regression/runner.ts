/**
 * Core runner for generator regression testing.
 *
 * Builds team configs from presets, runs artifact generation in combo
 * mode, collects comprehensive results, serializes to a golden file format,
 * and provides diffing utilities.
 */

import "@/lib/team-comp/index";

import { artifactHalfSetsById } from "@/data/constants";
import type { Element, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import type { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  type GeneratorOptions,
  type GeneratorResult,
  runGenerator,
} from "@/lib/team-comp/generator/generator";
import { buffSourceKey } from "@/lib/team-comp/helpers";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  ComboLine,
  DamageTag,
  DisplayResult,
  StatKey,
  TeamSlotConfig,
} from "@/lib/team-comp/types";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Re-exports from benchmark runner ────────────────────────────────────────

export { preloadGameStats };

// ─── Types (local, matching benchmark runner conventions) ────────────────────

interface ArtifactConfig {
  type: "4pc" | "2pc+2pc";
  setId?: string;
  id1?: string | number;
  id2?: string | number;
}

interface PresetTeam {
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactConfig | null)[];
  reactions?: string[];
  opts?: Record<string, string>;
  minEr?: Record<string, number>;
  minCr?: Record<string, number>;
  enemyAura?: string;
}

interface TeamCompData {
  teams: PresetTeam[];
  author?: string;
  description?: string;
}

export const DEFAULT_CALC_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

export const PRNG_SEED = 0xdeadbeef;

// ─── Formatting / Colors ─────────────────────────────────────────────────────

export const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Data Loading ────────────────────────────────────────────────────────────

export function loadTeamPreset(): TeamCompData {
  const presetPath = resolve(
    "src/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json"
  );
  const raw = readFileSync(presetPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { teams: parsed };
  return parsed as TeamCompData;
}

// ─── Config Building ─────────────────────────────────────────────────────────

function parseArtifactSets(goalArt: ArtifactConfig | null): {
  artifactSetId: string | null;
  artifactHalfSetIds: string[];
} {
  let artifactSetId: string | null = null;
  let artifactHalfSetIds: string[] = [];
  if (!goalArt) return { artifactSetId, artifactHalfSetIds };

  if (goalArt.type === "4pc") {
    artifactSetId = goalArt.setId ?? null;
  } else if (goalArt.type === "2pc+2pc") {
    artifactHalfSetIds = [String(goalArt.id1), String(goalArt.id2)];
  }
  return { artifactSetId, artifactHalfSetIds };
}

export interface GeneratorProblem {
  team: PresetTeam;
  configs: TeamSlotConfig[];
  teamBuild: TeamBuild;
  combo: ComboFormula;
  carryCharId: string;
  firstCarryFormulaId: string;
  perChar: Record<string, { minEr: number; minCr: number }>;
  setKeysByChar: Record<string, Record<Slot, string>>;
}

export function buildGeneratorProblem(
  team: PresetTeam,
  rand: () => number
): GeneratorProblem | null {
  const charIds = team.characters.filter((c): c is string => !!c);
  if (charIds.length === 0) return null;

  // Build configs: lv100, C6, R5 for all
  const configs: TeamSlotConfig[] = [];
  const setKeysByChar: Record<string, Record<Slot, string>> = {};

  for (let i = 0; i < team.characters.length; i++) {
    const charId = team.characters[i];
    const weaponId = team.weapons[i];
    if (!charId || !weaponId) continue;

    const { artifactSetId, artifactHalfSetIds } = parseArtifactSets(
      team.artifacts[i] ?? null
    );

    configs.push({
      charId,
      charLevel: 100,
      constellation: 6,
      weaponId,
      refinement: 5,
      artifactSetId,
      artifactHalfSetIds,
    });

    // Build set keys for each slot (used for proper rendering)
    const slotKeys: Record<string, string> = {};
    if (artifactSetId) {
      for (const slot of allSlots) slotKeys[slot] = artifactSetId;
    } else if (artifactHalfSetIds.length >= 2) {
      // Map half-set IDs to full artifact set IDs
      const fullId0 = resolveHalfSetToFullId(artifactHalfSetIds[0]);
      const fullId1 = resolveHalfSetToFullId(artifactHalfSetIds[1]);
      slotKeys.flower = fullId0;
      slotKeys.plume = fullId0;
      slotKeys.sands = fullId0;
      slotKeys.goblet = fullId1;
      slotKeys.circlet = fullId1;
    }
    if (Object.keys(slotKeys).length > 0) {
      setKeysByChar[charId] = slotKeys as Record<Slot, string>;
    }
  }

  if (configs.length === 0) return null;

  // Build TeamBuild with default options (first non-disabled option per char)
  const teamBuild = new TeamBuild(
    configs,
    team.opts ?? {},
    team.enemyAura as Element | undefined
  );

  // Get all formulas
  const allFormulas = teamBuild.getFormulaIds();
  const carryCharId = charIds[0];
  const carryFormulas = allFormulas[carryCharId];
  if (!carryFormulas || Object.keys(carryFormulas).length === 0) return null;
  const firstCarryFormulaId = Object.keys(carryFormulas)[0];

  // Build combo: every formula from every character, count=2
  const lines: ComboLine[] = [];
  for (const [cid, formulas] of Object.entries(allFormulas)) {
    for (const formulaId of Object.keys(formulas)) {
      lines.push({ charId: cid, formulaId, count: 2 });
    }
  }

  const combo: ComboFormula = {
    id: `idealgen-test-${team.id}`,
    label: { zh: "Generator Test", en: "Generator Test" },
    lines,
  };

  // Generate random perChar constraints
  const perChar: Record<string, { minEr: number; minCr: number }> = {};
  for (const cid of charIds) {
    const minCr = Math.floor(rand() * 51) / 100; // 0.00–0.50
    const minEr = 1.0 + rand() * 1.5; // 1.0–2.5 internal (100%–250%)
    perChar[cid] = { minEr, minCr };
  }

  return {
    team,
    configs,
    teamBuild,
    combo,
    carryCharId,
    firstCarryFormulaId,
    perChar,
    setKeysByChar,
  };
}

function resolveHalfSetToFullId(halfSetId: string): string {
  const entry = artifactHalfSetsById[halfSetId];
  return entry?.setIds?.[0] ?? halfSetId;
}

// ─── Execution ───────────────────────────────────────────────────────────────

export async function runGeneratorForTeam(
  problem: GeneratorProblem
): Promise<GoldenTeamResult> {
  const {
    teamBuild,
    carryCharId,
    firstCarryFormulaId,
    combo,
    perChar,
    setKeysByChar,
  } = problem;

  const opts: GeneratorOptions = {
    teamBuild,
    carryCharId,
    calcContext: DEFAULT_CALC_CONTEXT,
    combo,
    perChar,
    setKeysByChar,
  };

  let finalResult: GeneratorResult | null = null;
  for await (const result of runGenerator(opts)) {
    if (result.done) {
      finalResult = result;
      break;
    }
  }

  if (!finalResult) {
    throw new Error(
      `Generator returned no result for team "${problem.team.name}"`
    );
  }

  // Get combo display result
  const displayResult = teamBuild.getComboDisplayResult(
    combo,
    finalResult.sheetsByChar,
    DEFAULT_CALC_CONTEXT
  );

  // Compute combo-wide stack-limited buff allocation
  const activeLines = combo.lines.filter((l) => l.count > 0);
  const comboDefaults = teamBuild.getComboFormulaDefaults(
    activeLines,
    finalResult.sheetsByChar,
    DEFAULT_CALC_CONTEXT
  );

  const charIds = problem.configs.map((c) => c.charId);
  return serializeTeamResult(
    problem,
    finalResult,
    displayResult,
    charIds,
    comboDefaults
  );
}

// ─── Serialization ───────────────────────────────────────────────────────────

const STAT_ORDER: StatKey[] = [
  "atk",
  "hp",
  "def",
  "em",
  "cr",
  "cd",
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
  "dmg%",
  "baseDmg",
  "baseDmg%",
  "reactionBaseDmg%",
  "elevated%",
  "reactionDmg%",
  "reactionCr",
  "reactionCd",
  "defReduction%",
  "defIgnore%",
  "resReduction%",
  "atkSpd%",
];

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function serializeStatSheet(
  sheet: StatSheet,
  tag: DamageTag | null = null
): Record<string, number> {
  const all = sheet.getAll(tag);
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(all)) {
    if (value !== 0) {
      result[key] = r4(value as number);
    }
  }
  return result;
}

function computeMaxStats(
  charId: string,
  result: DisplayResult
): { onField: Record<string, number>; offField: Record<string, number> } {
  const sheets = result.statSheets[charId];
  if (!sheets) return { onField: {}, offField: {} };

  const allTags = result.charFormulaTags?.[charId] ?? [];
  const { onField, offField } = sheets;

  // Collect all keys present in either sheet
  const allKeys = new Set<StatKey>();
  for (const { key } of onField.dump()) allKeys.add(key);
  for (const { key } of offField.dump()) allKeys.add(key);
  // Always include base stats
  for (const k of ["atk", "hp", "def", "em", "cr", "cd", "er"] as StatKey[]) {
    allKeys.add(k);
  }

  const onResult: Record<string, number> = {};
  const offResult: Record<string, number> = {};

  for (const key of sortStatKeys(allKeys)) {
    if (key === "atk%" || key === "hp%" || key === "def%") continue;
    if (key === "baseAtk" || key === "baseHp" || key === "baseDef") continue;

    let maxOn: number;
    let maxOff: number;

    try {
      maxOn = onField.get(key, null);
      maxOff = offField.get(key, null);
    } catch {
      continue;
    }

    for (const tag of allTags) {
      try {
        maxOn = Math.max(maxOn, onField.get(key, tag));
        maxOff = Math.max(maxOff, offField.get(key, tag));
      } catch {
        // skip
      }
    }

    if (key === "atk" || key === "hp" || key === "def" || key === "em") {
      maxOn = Math.round(maxOn);
      maxOff = Math.round(maxOff);
    }

    if (maxOn !== 0) onResult[key] = r4(maxOn);
    if (maxOff !== 0) offResult[key] = r4(maxOff);
  }

  return { onField: onResult, offField: offResult };
}

function sortStatKeys(keys: Set<StatKey>): StatKey[] {
  const arr = Array.from(keys);
  arr.sort((a, b) => {
    let ia = STAT_ORDER.indexOf(a);
    let ib = STAT_ORDER.indexOf(b);
    if (ia === -1) ia = 999;
    if (ib === -1) ib = 999;
    return ia - ib;
  });
  return arr;
}

function serializeTeamResult(
  problem: GeneratorProblem,
  gen: GeneratorResult,
  display: DisplayResult,
  charIds: string[],
  comboDefaults?: {
    perLine: BuffActivationMap[];
    stackLimited: import(
      "@/lib/team-comp/calc/stackRank"
    ).StackLimitedBuffInfo[];
  }
): GoldenTeamResult {
  // Artifacts
  const artifacts: GoldenTeamResult["artifacts"] = {};
  for (const [cid, slotMap] of Object.entries(gen.artifactsByChar)) {
    artifacts[cid] = {};
    for (const [slot, art] of Object.entries(slotMap)) {
      if (!art) continue;
      const substats: Record<string, number> = {};
      for (const [sk, sv] of Object.entries(art.substats)) {
        if (sv !== 0) substats[sk] = r4(sv as number);
      }
      artifacts[cid][slot] = {
        setKey: art.setKey,
        mainStat: art.mainStatKey,
        substats,
      };
    }
  }

  // Stats from sheetsByChar
  const stats: Record<string, Record<string, number>> = {};
  for (const [cid, sheet] of Object.entries(gen.sheetsByChar)) {
    stats[cid] = serializeStatSheet(sheet);
  }

  // Combo result (sourced from display path)
  const comboResult = {
    lineDamages: (display.lineDamages ?? []).map((l) => ({
      perHit: r4(l.perHit),
      total: r4(l.total),
    })),
    totalDamage: r4(display.totalDamage),
  };

  // Display parts per formula (include partialBuffs when present)
  const partsByFormula: Record<
    string,
    {
      damage: number;
      template: string;
      hits?: number;
      partialBuffs?: {
        buffKey: string;
        activatedHits: number;
        totalHits: number;
      }[];
    }[]
  > = {};
  for (const [formulaKey, formulaParts] of Object.entries(
    display.partsByFormula
  )) {
    partsByFormula[formulaKey] = formulaParts.map((p) => {
      const entry: {
        damage: number;
        template: string;
        hits?: number;
        partialBuffs?: {
          buffKey: string;
          activatedHits: number;
          totalHits: number;
        }[];
      } = {
        damage: r4(p.damage),
        template: p.template,
      };
      if (p.hits != null && p.hits > 1) entry.hits = p.hits;
      if (p.partialBuffs && p.partialBuffs.length > 0) {
        entry.partialBuffs = p.partialBuffs.map((pb) => ({
          buffKey: pb.buffKey,
          activatedHits: r4(pb.activatedHits),
          totalHits: pb.totalHits,
        }));
      }
      return entry;
    });
  }

  // Active buffs
  const activeBuffs = display.buffs
    .filter((b) => b.active)
    .map((b) => {
      const entries: { key: string; value: number }[] = [];
      for (const e of b.staticEntries) {
        if (e.value !== 0) entries.push({ key: e.key, value: r4(e.value) });
      }
      for (const e of b.dynamicEntries) {
        if (e.value !== 0) entries.push({ key: e.key, value: r4(e.value) });
      }
      const out: GoldenBuff = {
        source: {
          type: b.source.type,
          id: b.source.id,
        },
        entries,
      };
      if (b.source.origin) out.source.origin = b.source.origin;
      if (b.providerCharId) out.providerCharId = b.providerCharId;
      return out;
    });

  // Detail stats (universal, tag=null) for all chars
  const detailStats: Record<
    string,
    { onField: Record<string, number>; offField: Record<string, number> }
  > = {};
  for (const cid of charIds) {
    const sheets = display.statSheets[cid];
    if (!sheets) continue;
    detailStats[cid] = {
      onField: serializeStatSheet(sheets.onField),
      offField: serializeStatSheet(sheets.offField),
    };
  }

  // Max stats for all chars
  const maxStats: Record<
    string,
    { onField: Record<string, number>; offField: Record<string, number> }
  > = {};
  for (const cid of charIds) {
    maxStats[cid] = computeMaxStats(cid, display);
  }

  // Marginal gains (round values)
  const marginalGains: Record<string, Record<string, number>> = {};
  for (const [cid, gains] of Object.entries(display.marginalGains)) {
    const g: Record<string, number> = {};
    for (const [key, val] of Object.entries(gains)) {
      if (val != null && val !== 0) g[key] = r4(val);
    }
    if (Object.keys(g).length > 0) marginalGains[cid] = g;
  }

  // Level-up gains
  const levelUpGains: Record<
    string,
    { gain: number; from: number; to: number }[]
  > = {};
  for (const [cid, entries] of Object.entries(display.levelUpGains)) {
    if (entries.length > 0) {
      levelUpGains[cid] = entries.map((e) => ({
        gain: r4(e.gain),
        from: e.from,
        to: e.to,
      }));
    }
  }

  // Stack allocation: serialize per-buff combo-wide totals (for maxStacks validation)
  let stackAllocation: GoldenTeamResult["stackAllocation"];
  if (comboDefaults && comboDefaults.stackLimited.length > 0) {
    stackAllocation = {};
    for (const buffInfo of comboDefaults.stackLimited) {
      const bKey = buffSourceKey(buffInfo.source);
      // Sum per-line per-cast × count to get the total allocated across the combo
      let totalAllocated = 0;
      const activeLines = problem.combo.lines.filter((l) => l.count > 0);
      for (let i = 0; i < activeLines.length; i++) {
        const lineMap = comboDefaults.perLine[i];
        if (!lineMap?.[bKey]) continue;
        for (const perCast of Object.values(lineMap[bKey])) {
          totalAllocated += perCast * activeLines[i].count;
        }
      }
      stackAllocation[bKey] = {
        maxStacks: buffInfo.maxStacks,
        totalAllocated: r4(totalAllocated),
      };
    }
  }

  return {
    teamName: problem.team.name || charIds.join(" / "),
    characters: charIds,
    carryCharId: problem.carryCharId,
    perChar: Object.fromEntries(
      Object.entries(problem.perChar).map(([k, v]) => [
        k,
        { minEr: r4(v.minEr), minCr: r4(v.minCr) },
      ])
    ),
    damage: r4(display.totalDamage),
    comboResult,
    artifacts,
    stats,
    display: {
      totalDamage: r4(display.totalDamage),
      partsByFormula,
      activeBuffs,
      detailStats,
      maxStats,
      marginalGains,
      levelUpGains,
    },
    ...(stackAllocation ? { stackAllocation } : {}),
  };
}

// ─── Golden File Types ───────────────────────────────────────────────────────

export interface GoldenFile {
  version: 1;
  seed: number;
  generatedAt: string;
  teams: Record<string, GoldenTeamResult>;
}

interface GoldenBuff {
  source: { type: string; id: string; origin?: string };
  providerCharId?: string;
  entries: { key: string; value: number }[];
}

export interface GoldenTeamResult {
  teamName: string;
  characters: string[];
  carryCharId: string;
  perChar: Record<string, { minEr: number; minCr: number }>;
  damage: number;
  comboResult: {
    lineDamages: { perHit: number; total: number }[];
    totalDamage: number;
  };
  artifacts: Record<
    string,
    Record<
      string,
      { setKey: string; mainStat: string; substats: Record<string, number> }
    >
  >;
  stats: Record<string, Record<string, number>>;
  display: {
    totalDamage: number;
    partsByFormula: Record<
      string,
      {
        damage: number;
        template: string;
        hits?: number;
        partialBuffs?: {
          buffKey: string;
          activatedHits: number;
          totalHits: number;
        }[];
      }[]
    >;
    activeBuffs: GoldenBuff[];
    detailStats: Record<
      string,
      { onField: Record<string, number>; offField: Record<string, number> }
    >;
    maxStats: Record<
      string,
      { onField: Record<string, number>; offField: Record<string, number> }
    >;
    marginalGains: Record<string, Record<string, number>>;
    levelUpGains: Record<string, { gain: number; from: number; to: number }[]>;
  };
  /** Per stack-limited buff: maxStacks cap and total allocated across combo. */
  stackAllocation?: Record<
    string,
    { maxStacks: number; totalAllocated: number }
  >;
}

// ─── Diffing ─────────────────────────────────────────────────────────────────

export interface DiffEntry {
  path: string;
  old: unknown;
  new: unknown;
  pctChange?: number;
}

export function deepDiff(
  oldObj: unknown,
  newObj: unknown,
  path: string,
  diffs: DiffEntry[]
): void {
  if (oldObj === newObj) return;

  if (oldObj == null && newObj != null) {
    diffs.push({ path, old: oldObj, new: newObj });
    return;
  }
  if (oldObj != null && newObj == null) {
    diffs.push({ path, old: oldObj, new: newObj });
    return;
  }

  if (typeof oldObj === "number" && typeof newObj === "number") {
    if (Math.abs(oldObj - newObj) > 1e-6) {
      const pct =
        oldObj !== 0 ? ((newObj - oldObj) / Math.abs(oldObj)) * 100 : undefined;
      diffs.push({ path, old: oldObj, new: newObj, pctChange: pct });
    }
    return;
  }

  if (typeof oldObj === "string" && typeof newObj === "string") {
    if (oldObj !== newObj) {
      diffs.push({ path, old: oldObj, new: newObj });
    }
    return;
  }

  if (typeof oldObj === "boolean" && typeof newObj === "boolean") {
    if (oldObj !== newObj) {
      diffs.push({ path, old: oldObj, new: newObj });
    }
    return;
  }

  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    const maxLen = Math.max(oldObj.length, newObj.length);
    for (let i = 0; i < maxLen; i++) {
      deepDiff(
        i < oldObj.length ? oldObj[i] : undefined,
        i < newObj.length ? newObj[i] : undefined,
        `${path}[${i}]`,
        diffs
      );
    }
    return;
  }

  if (
    typeof oldObj === "object" &&
    typeof newObj === "object" &&
    oldObj !== null &&
    newObj !== null
  ) {
    const oldRec = oldObj as Record<string, unknown>;
    const newRec = newObj as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(oldRec), ...Object.keys(newRec)]);
    for (const key of allKeys) {
      deepDiff(oldRec[key], newRec[key], path ? `${path}.${key}` : key, diffs);
    }
    return;
  }

  // Type mismatch
  if (oldObj !== newObj) {
    diffs.push({ path, old: oldObj, new: newObj });
  }
}

export function formatDiffEntry(d: DiffEntry): string {
  const oldStr = formatValue(d.old);
  const newStr = formatValue(d.new);

  if (d.pctChange != null) {
    const sign = d.pctChange >= 0 ? "+" : "";
    const pctStr = `${sign}${d.pctChange.toFixed(2)}%`;
    const color =
      d.pctChange > 0 ? C.green : d.pctChange < 0 ? C.red : C.yellow;
    return `  ${d.path}: ${oldStr} -> ${newStr} (${color}${pctStr}${C.reset})`;
  }

  return `  ${d.path}: ${oldStr} -> ${newStr}`;
}

function formatValue(v: unknown): string {
  if (v === undefined) return "(missing)";
  if (v === null) return "(null)";
  if (typeof v === "number") {
    // Format with reasonable precision
    if (Number.isInteger(v) || Math.abs(v) >= 100) return fmt(v);
    return v.toFixed(4);
  }
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

export function formatTeamDiff(teamName: string, diffs: DiffEntry[]): string {
  if (diffs.length === 0) {
    return `${C.green}team "${teamName}" — no changes${C.reset}`;
  }

  const lines = [
    `${C.yellow}team "${teamName}"${C.reset} (${diffs.length} diffs)`,
  ];
  for (const d of diffs) {
    lines.push(formatDiffEntry(d));
  }
  return lines.join("\n");
}

export function formatSummary(
  totalTeams: number,
  teamDiffs: Map<string, DiffEntry[]>
): string {
  let changedTeams = 0;
  let totalDiffs = 0;
  let damageChanges = 0;

  for (const [, diffs] of teamDiffs) {
    if (diffs.length > 0) {
      changedTeams++;
      totalDiffs += diffs.length;
      for (const d of diffs) {
        if (d.path === "damage" || d.path === "comboResult.totalDamage") {
          if (d.pctChange != null && Math.abs(d.pctChange) > 1e-6)
            damageChanges++;
        }
      }
    }
  }

  const lines = [
    "",
    `${C.bold}Summary:${C.reset} ${totalTeams} teams, ${changedTeams} with changes, ${totalDiffs} diffs total`,
  ];
  if (damageChanges > 0) {
    lines.push(
      `  Damage: ${C.red}${damageChanges} changed${C.reset} (any change = regression)`
    );
  }
  return lines.join("\n");
}

export function hasRegressions(teamDiffs: Map<string, DiffEntry[]>): boolean {
  for (const [, diffs] of teamDiffs) {
    for (const d of diffs) {
      if (d.path === "damage" || d.path === "comboResult.totalDamage") {
        if (d.pctChange != null && Math.abs(d.pctChange) > 1e-6) return true;
      }
    }
  }
  return false;
}
