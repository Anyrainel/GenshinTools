/**
 * AST-based damage formula compiler.
 *
 * Compiles the full damage evaluation pipeline (stat resolution + buff application +
 * formula computation) into a single compiled function that takes a Float64Array
 * of artifact stat contributions and returns a damage number.
 *
 * Usage in the optimizer hot path:
 *   1. Call compileComboTeamDamage() once per B&B setup
 *   2. For each artifact combination, fill a Float64Array with artifact stat deltas
 *   3. Call compiled.evaluate(vars) → damage number
 *
 * This eliminates all Map lookups, object allocations, and virtual dispatch from
 * the inner loop, leaving ~20-50 arithmetic ops per evaluation.
 */

import { getMainStatValueAtLevel } from "@/domain/build/artifact/scoring/utils";
import type { MainStat, StatKey } from "@/domain/enums";
import type { ArtifactData } from "@/domain/models";
import { ELEMENT_ELIGIBLE_REACTIONS } from "../constants";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  DamageTag,
  FormulaPart,
  ReactionOverride,
} from "../types";
import { resolvePartReaction } from "./combo";
import { createReactionVariant } from "./damageFormula";
import { compileExpr, E, type Expr, simplify } from "./expr";
import { type ExprStatSheet, VarMapping } from "./exprStatSheet";
import { getDefaultOnFieldCharId, isPartOffField } from "./fieldState";
import { exclusionKey } from "./formulaEval";
import {
  bespokeMaxStacks,
  CrossScalingBuff,
  ScalingBuff,
  type StatBuff,
} from "./statBuff";
import type { StatSheet } from "./statSheet";
import type { TeamBuild } from "./teamBuild";
import { TeamExprStatSheet } from "./teamExprStatSheet";

// ─── Public Interface ───

export interface CompiledTeamDamage {
  /** The flat variable layout */
  varMapping: VarMapping;
  /** Evaluate total damage from artifact stat arrays */
  evaluate: (vars: Float64Array) => number;
  /** ER check: returns total ER for constraint-checked character */
  evaluateEr?: (vars: Float64Array) => number;
  /** CR check: returns total CR for constraint-checked character */
  evaluateCr?: (vars: Float64Array) => number;
  /** Number of variables */
  numVars: number;
  /** The raw expression (for testing/debugging) */
  damageExpr: Expr;
  /** Maps variable character IDs → charIdx (their position in charBuildOrder). */
  charIdxMap?: Map<string, number>;
}

// ─── Compilation Pipeline ───

/**
 * Compile a combo formula into a single optimized function.
 * Each combo line may have a different on-field character, so we build
 * a single TeamExprStatSheet that covers all on-field contexts, sharing
 * one VarMapping across all expr stat lookups.
 */
export function compileComboTeamDamage(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  swapCharId: string | string[],
  baseSheets: Record<string, StatSheet>,
  calcContext: CalcContext,
  buffOverrides?: Record<string, BuffActivationMap>,
  erCheckCharId?: string,
  minEr?: number,
  minCr?: number
): CompiledTeamDamage {
  const allFormulas = teamBuild.catalog.getFormulaIds();
  const validLines = combo.lines.filter((line) => {
    if (line.count <= 0) return false;
    return allFormulas[line.charId]?.[line.formulaId] !== undefined;
  });

  if (validLines.length === 0) {
    const vm = new VarMapping();
    return {
      varMapping: vm,
      evaluate: () => 0,
      numVars: 0,
      damageExpr: E.const(0),
    };
  }

  const configs = teamBuild.configs;
  const variableCharIdArr = Array.isArray(swapCharId)
    ? swapCharId
    : [swapCharId];
  const variableCharIds = new Set(variableCharIdArr);

  const teamExprStats = new TeamExprStatSheet(
    teamBuild.teamStats,
    baseSheets,
    variableCharIds,
    calcContext
  );

  // Group lines by formula owner (= line.charId)
  const linesByCharId = new Map<string, typeof validLines>();
  for (const line of validLines) {
    let group = linesByCharId.get(line.charId);
    if (!group) {
      group = [];
      linesByCharId.set(line.charId, group);
    }
    group.push(line);
  }

  const allPartExprs: Expr[] = [];

  for (const [charId, lines] of linesByCharId) {
    const onFieldCharId = getDefaultOnFieldCharId(charId, configs);

    for (const line of lines) {
      const entry = teamBuild.catalog.formulaIndex.get(line.formulaId);
      if (!entry) continue;

      // Multi-contributor entries: each part has its own statsCharId and
      // weighted formula — compile per-part exprs directly.
      if (entry.isMultiContributor) {
        const partExprs: Expr[] = [];
        for (const part of entry.parts) {
          const partCharId = part.statsCharId ?? line.charId;
          const partStats = teamExprStats.getExprStats(partCharId, charId);
          if (!partStats) continue;
          const partLevel = teamExprStats.getCharLevel(partCharId);
          partExprs.push(
            part.formula.buildExpr(partStats, partLevel, calcContext)
          );
        }
        if (partExprs.length > 0) {
          allPartExprs.push(E.mul(E.add(...partExprs), E.const(line.count)));
        }
        continue;
      }

      const effectiveReaction = line.reaction;

      // Resolve the stats character: cross-scaled formulas (e.g. Nicole projection)
      // evaluate with the statsCharId's stats instead of line.charId.
      const statsCharId = entry.parts[0]?.statsCharId ?? line.charId;

      const formulaStats = teamExprStats.getExprStats(statsCharId, charId);
      const hasOffField = entry.parts.some((p) =>
        isPartOffField(p, line.forceOnField)
      );
      const offFieldFormulaStats = hasOffField
        ? teamExprStats.getExprStats(statsCharId, onFieldCharId)
        : undefined;

      // Look up by line index first (for per-line combo overrides), then formula key
      const lineIdx = validLines.indexOf(line);
      const lineKey = `${line.charId}.${line.formulaId}`;
      const lineBuffs =
        buffOverrides?.[`line:${lineIdx}`] ?? buffOverrides?.[lineKey];

      // Pre-build ExprStats variants for partial buff blending
      let lineExprVariants: Map<string, ExprStatSheet> | undefined;
      let lineOffFieldVariants: Map<string, ExprStatSheet> | undefined;
      if (lineBuffs && Object.keys(lineBuffs).length > 0) {
        lineExprVariants = teamExprStats.buildBuffVariants(
          lineBuffs,
          entry.parts,
          statsCharId,
          charId
        );
        if (hasOffField) {
          lineOffFieldVariants = teamExprStats.buildBuffVariants(
            lineBuffs,
            entry.parts,
            statsCharId,
            onFieldCharId
          );
        }
      }

      const lineCharLevel = teamExprStats.getCharLevel(statsCharId);
      const lineExpr = buildTotalDamageExpr(
        entry.parts,
        formulaStats,
        lineCharLevel,
        calcContext,
        effectiveReaction,
        offFieldFormulaStats,
        lineBuffs,
        lineExprVariants,
        lineOffFieldVariants,
        line.count,
        line.forceOnField
      );
      allPartExprs.push(lineExpr);
    }
  }

  if (allPartExprs.length === 0) {
    return {
      varMapping: teamExprStats.varMapping,
      evaluate: () => 0,
      numVars: teamExprStats.varMapping.totalVars,
      damageExpr: E.const(0),
    };
  }

  const damageExpr = simplify(E.add(...allPartExprs));
  const evaluate = compileExpr(damageExpr);

  // Compile ER/CR constraint expressions.
  // ER/CR matter when the constrained character is on-field (casting skill/burst),
  // so use their own on-field context (already included in allOnFieldCharIds).
  let evaluateEr: ((vars: Float64Array) => number) | undefined;
  let evaluateCr: ((vars: Float64Array) => number) | undefined;

  if (erCheckCharId && (minEr ?? 0) + (minCr ?? 0) > 0) {
    const erStats = teamExprStats.getExprStats(erCheckCharId, erCheckCharId);
    if (erStats) {
      if (minEr && minEr > 0) {
        const erExpr = simplify(
          E.add(erStats.get("er", null), E.const(-minEr))
        );
        evaluateEr = compileExpr(erExpr);
      }
      if (minCr && minCr > 0) {
        const crExpr = simplify(
          E.add(erStats.get("cr", null), E.const(-minCr))
        );
        evaluateCr = compileExpr(crExpr);
      }
    }
  }

  // Build charIdxMap for all variable characters
  const charIds = teamBuild.teamMeta.characters;
  const charIdxMap = new Map<string, number>();
  for (const varCharId of variableCharIdArr) {
    const idx = charIds.indexOf(varCharId);
    if (idx >= 0) charIdxMap.set(varCharId, idx);
  }

  return {
    varMapping: teamExprStats.varMapping,
    evaluate,
    evaluateEr,
    evaluateCr,
    numVars: teamExprStats.varMapping.totalVars,
    damageExpr,
    charIdxMap,
  };
}

// ─── Formula Expr Builder ───

function buildTotalDamageExpr(
  parts: FormulaPart[],
  formulaStats: ExprStatSheet,
  charLevel: number,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  offFieldFormulaStats?: ExprStatSheet,
  activation?: BuffActivationMap,
  statsVariants?: Map<string, ExprStatSheet>,
  offFieldVariants?: Map<string, ExprStatSheet>,
  comboCount = 1,
  forceOnField?: boolean
): Expr {
  const partExprs: Expr[] = [];
  // Overrides are per cast; the expression below uses rotation-wide hits.
  const comboActivation =
    activation &&
    Object.fromEntries(
      Object.entries(activation).map(([key, partMap]) => [
        key,
        Object.fromEntries(
          Object.entries(partMap).map(([idx, hits]) => [idx, hits * comboCount])
        ),
      ])
    );

  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    const { formula, hits: totalHits, bespokeBuffs } = part;
    const h = totalHits ?? 1;

    // Use off-field stats when the part deals damage while the character is off-field
    const effectiveOffField = isPartOffField(part, forceOnField);
    const baseStats =
      effectiveOffField && offFieldFormulaStats
        ? offFieldFormulaStats
        : formulaStats;
    const baseVariants =
      effectiveOffField && offFieldVariants ? offFieldVariants : statsVariants;

    const hasReaction =
      reactionOverride?.reaction && reactionOverride.reaction !== "none";

    if (!hasReaction || formula.tag.reaction !== "none") {
      emitBlendedPartExprs(
        partExprs,
        formula,
        baseStats,
        charLevel,
        ctx,
        h * comboCount,
        h * comboCount,
        idx,
        comboActivation,
        baseVariants,
        bespokeBuffs
      );
      continue;
    }

    // Reaction override logic
    const partEligible =
      ELEMENT_ELIGIBLE_REACTIONS[
        formula.tag.element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
      ];
    const targetReaction = resolvePartReaction(
      reactionOverride,
      idx,
      partEligible
    );

    const reactingHits =
      targetReaction !== "none"
        ? Math.min(reactionOverride.rxnPartHits?.[idx] ?? h, h)
        : 0;
    const nonReactingHits = h - reactingHits;

    if (reactingHits > 0) {
      const effectiveFormula =
        targetReaction !== formula.tag.reaction
          ? createReactionVariant(formula, targetReaction)
          : formula;
      emitBlendedPartExprs(
        partExprs,
        effectiveFormula,
        baseStats,
        charLevel,
        ctx,
        reactingHits * comboCount,
        h * comboCount,
        idx,
        comboActivation,
        baseVariants,
        bespokeBuffs
      );
    }
    if (nonReactingHits > 0) {
      emitBlendedPartExprs(
        partExprs,
        formula,
        baseStats,
        charLevel,
        ctx,
        nonReactingHits * comboCount,
        h * comboCount,
        idx,
        comboActivation,
        baseVariants,
        bespokeBuffs
      );
    }
  }

  if (partExprs.length === 0) return E.const(0);
  return E.add(...partExprs);
}

/**
 * Emit blended damage expressions for a part with partial buff activation.
 *
 * Uses interval-based blending: sorts buff cutoff points to create intervals
 * where different combinations of buffs are active, then emits a weighted
 * sum of expressions for each interval.
 *
 * Instead of negating buff entries, looks up pre-built ExprStats variants
 * for each exclusion combination and applies bespoke overlay on top.
 *
 * Example with buff1 (3/5 hits) and buff2 (2/5 hits) on a 5-hit part:
 *   2 × expr(b1,b2) + 1 × expr(b1) + 2 × expr()
 */
function emitBlendedPartExprs(
  partExprs: Expr[],
  formula: {
    buildExpr: (
      stats: ExprStatSheet,
      charLevel: number,
      ctx: CalcContext
    ) => Expr;
    tag: DamageTag;
  },
  baseStats: ExprStatSheet,
  charLevel: number,
  ctx: CalcContext,
  totalHits: number,
  originalPartHits: number,
  partIdx: number,
  activation: BuffActivationMap | undefined,
  statsVariants?: Map<string, ExprStatSheet>,
  bespokeBuffs?: StatBuff[]
): void {
  // Scale activation counts for reaction sub-parts: partialBuffs are stored
  // per full part (originalPartHits), but this call may evaluate only a
  // sub-slice (reacting or non-reacting). Mirrors _calcPartBlended.
  const scale = totalHits / originalPartHits;
  const bespokeMax = bespokeMaxStacks(bespokeBuffs);
  const scaledBespokeMax = bespokeMax != null ? bespokeMax * scale : undefined;
  const bespokeCutoff =
    bespokeBuffs?.length &&
    scaledBespokeMax != null &&
    scaledBespokeMax < totalHits
      ? scaledBespokeMax
      : totalHits;
  // Compute bespoke entries ONCE against baseStats so dynamic scaling
  // (e.g. EM → baseDmg) uses full base values, matching display/calc semantics.
  const bespokeEntries = bespokeBuffs?.length
    ? captureBespokeEntries(baseStats, bespokeBuffs)
    : undefined;
  const withBespoke = bespokeEntries
    ? mergeBespokeEntriesAll(baseStats, bespokeEntries, bespokeBuffs!)
    : baseStats;

  // Collect affecting partials (activations compared in the scaled sub-part frame)
  const affecting: { buffKey: string; activated: number }[] = [];
  if (activation) {
    for (const [buffKey, partMap] of Object.entries(activation)) {
      const activated = (partMap[partIdx] ?? originalPartHits) * scale;
      if (activated < totalHits) affecting.push({ buffKey, activated });
    }
  }

  // Fast path: uniform across all hits
  if (affecting.length === 0 && bespokeCutoff === totalHits) {
    const expr = formula.buildExpr(withBespoke, charLevel, ctx);
    partExprs.push(E.mul(expr, E.const(totalHits)));
    return;
  }

  // Build interval cutpoints from activation counts and bespoke cutoff
  const cutpointSet = new Set<number>([0, totalHits]);
  if (bespokeCutoff < totalHits) cutpointSet.add(bespokeCutoff);
  for (const { activated } of affecting) {
    if (activated > 0 && activated < totalHits) cutpointSet.add(activated);
  }
  const cutpoints = [...cutpointSet].sort((a, b) => a - b);

  // Emit one expression per interval
  for (let i = 0; i < cutpoints.length - 1; i++) {
    const end = cutpoints[i + 1];
    const width = cutpoints[i + 1] - cutpoints[i];
    if (width <= 0) continue;

    // Determine which buffs are inactive in this interval
    const excludeSet = new Set<string>();
    for (const { buffKey, activated } of affecting) {
      if (activated < end) excludeSet.add(buffKey);
    }

    const bespokeActive = end <= bespokeCutoff;

    let intervalStats: ExprStatSheet;
    if (excludeSet.size === 0) {
      intervalStats = bespokeActive ? withBespoke : baseStats;
    } else {
      const eKey = exclusionKey(excludeSet);
      const variant = statsVariants?.get(eKey) ?? baseStats;
      intervalStats =
        bespokeActive && bespokeEntries && bespokeBuffs
          ? mergeBespokeEntriesAll(variant, bespokeEntries, bespokeBuffs)
          : variant;
    }
    const expr = formula.buildExpr(intervalStats, charLevel, ctx);
    partExprs.push(E.mul(expr, E.const(width)));
  }
}

/**
 * Capture a bespoke buff's static + dynamic entries as (key, expr) pairs,
 * with dynamic scaling evaluated ONCE against the given baseStats. This
 * matches display/calc semantics where per-part bespoke overlays are built
 * from the character's base stats (not per-interval variant stats).
 */
function captureBespokeEntries(
  baseStats: ExprStatSheet,
  bespokeBuffs: StatBuff[]
): { key: StatKey; expr: Expr; filter?: StatBuff["target"]["filter"] }[] {
  const entries: {
    key: StatKey;
    expr: Expr;
    filter?: StatBuff["target"]["filter"];
  }[] = [];
  for (const bb of bespokeBuffs) {
    const f = bb.target.filter;
    for (const { key, value } of bb.staticBuffs) {
      entries.push({ key, expr: E.const(value), filter: f });
    }
    if (bb instanceof ScalingBuff || bb instanceof CrossScalingBuff) {
      for (const { key, expr } of bb.dynamicBuffsExpr(baseStats)) {
        entries.push({ key, expr, filter: f });
      }
    }
  }
  return entries;
}

/** Merge pre-captured bespoke entries (with per-entry filters) into any ExprStats. */
function mergeBespokeEntriesAll(
  stats: ExprStatSheet,
  entries: {
    key: StatKey;
    expr: Expr;
    filter?: StatBuff["target"]["filter"];
  }[],
  _bespokeBuffs: StatBuff[]
): ExprStatSheet {
  let result = stats;
  for (const { key, expr, filter } of entries) {
    if (expr.tag === "const") {
      result = result.withMergedConst([{ key, value: expr.value }], filter);
    } else {
      result = result.withMergedExpr([{ key, expr }], filter);
    }
  }
  return result;
}

/** Apply bespoke buff array overlay to ExprStats (static + dynamic parts). */
function _applyBespokeOverlay(
  stats: ExprStatSheet,
  bespokeBuffs?: StatBuff[]
): ExprStatSheet {
  if (!bespokeBuffs?.length) return stats;

  let result = stats;
  for (const bb of bespokeBuffs) {
    result = result.withMergedConst(bb.staticBuffs, bb.target.filter);

    if (bb instanceof ScalingBuff || bb instanceof CrossScalingBuff) {
      for (const { key, expr } of bb.dynamicBuffsExpr(result)) {
        if (expr.tag === "const") {
          result = result.withMergedConst(
            [{ key, value: expr.value }],
            bb.target.filter
          );
        } else {
          result = result.withMergedExpr([{ key, expr }], bb.target.filter);
        }
      }
    }
  }

  return result;
}

// ─── Evaluation Helpers for Optimizer ───

// Elemental DMG stat keys → normalized key + filterKey
const ELEMENTAL_DMG_FILTER: Record<string, string> = {
  "pyro%": "e:Pyro",
  "hydro%": "e:Hydro",
  "electro%": "e:Electro",
  "cryo%": "e:Cryo",
  "dendro%": "e:Dendro",
  "anemo%": "e:Anemo",
  "geo%": "e:Geo",
  "phys%": "e:Physical",
};

const FLAT_STAT_SET = new Set(["hp", "atk", "def", "em"]);

/**
 * Pre-computed lookup table for fast artifact stat → var index mapping.
 * Avoids Map.get() calls and stat key normalization in the hot loop.
 */
export interface ArtifactVarLookup {
  /** Map from raw stat key (e.g. "atk%", "pyro%") → var index. -1 if unmapped. */
  keyToIdx: Map<string, number>;
  /** Map from raw stat key → true if it's a percentage stat (needs /100 conversion). */
  keyIsPct: Map<string, boolean>;
}

/**
 * Build a fast lookup table for a character's artifact stat → var index mapping.
 * Call once per compiled formula; reuse across all evaluations.
 */
export function buildArtifactVarLookup(
  varMapping: VarMapping,
  charIdx: number
): ArtifactVarLookup {
  const keyToIdx = new Map<string, number>();
  const keyIsPct = new Map<string, boolean>();

  // All possible artifact stat keys (main + sub)
  const allStatKeys = [
    "hp",
    "atk",
    "def",
    "em",
    "er",
    "hp%",
    "atk%",
    "def%",
    "cr",
    "cd",
    "pyro%",
    "hydro%",
    "electro%",
    "cryo%",
    "dendro%",
    "anemo%",
    "geo%",
    "phys%",
    "heal%",
  ];

  for (const rawKey of allStatKeys) {
    const elFilter = ELEMENTAL_DMG_FILTER[rawKey];
    const normalizedKey = elFilter ? "dmg%" : rawKey;
    const filterKey = elFilter ?? "";
    const idx = varMapping.getVarIdx(
      charIdx,
      normalizedKey as StatKey,
      filterKey
    );
    if (idx !== undefined) {
      keyToIdx.set(rawKey, idx);
      keyIsPct.set(rawKey, !FLAT_STAT_SET.has(rawKey));
    }
  }

  return { keyToIdx, keyIsPct };
}

/**
 * Fill the Float64Array vars from an artifact tuple using a pre-built lookup.
 * Zero allocations, no Map construction — directly reads artifact stats.
 */
export function fillVarsFromArtifacts(
  artifacts: (ArtifactData | null)[],
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  for (const art of artifacts) {
    if (!art) continue;
    // Main stat
    const mainKey = art.mainStatKey;
    if (mainKey) {
      const idx = lookupVarIdx(varMapping, charIdx, mainKey);
      if (idx !== undefined) {
        const displayVal = getMainStatValueAtLevel(
          mainKey as MainStat,
          art.rarity,
          art.level
        );
        vars[idx] += FLAT_STAT_SET.has(mainKey) ? displayVal : displayVal / 100;
      }
    }
    // Substats
    if (art.substats) {
      for (const subKey of Object.keys(art.substats)) {
        const subVal = art.substats[subKey as keyof typeof art.substats];
        if (!subVal) continue;
        const idx = lookupVarIdx(varMapping, charIdx, subKey);
        if (idx !== undefined) {
          vars[idx] += FLAT_STAT_SET.has(subKey) ? subVal : subVal / 100;
        }
      }
    }
  }
}

/** Look up a var index for an artifact stat key, handling elemental DMG normalization. */
function lookupVarIdx(
  varMapping: VarMapping,
  charIdx: number,
  rawKey: string
): number | undefined {
  const elFilter = ELEMENTAL_DMG_FILTER[rawKey];
  if (elFilter) {
    return varMapping.getVarIdx(charIdx, "dmg%" as StatKey, elFilter);
  }
  return varMapping.getVarIdx(charIdx, rawKey as StatKey, "");
}

/**
 * Fill the Float64Array vars from a StatSheet (e.g. synthesized artifact sheet).
 * Used by generator compiled evaluation.
 */
export function fillVarsFromSheet(
  sheet: StatSheet,
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  for (const entry of sheet.dump()) {
    const idx = varMapping.getVarIdx(charIdx, entry.key, entry.filterKey);
    if (idx !== undefined) {
      vars[idx] += entry.value;
    }
  }
}

/**
 * Create a fast evalDamage callback that fills a Float64Array from a single
 * character's StatSheet and evaluates the compiled expression.
 *
 * Returned signature matches DamageEvalFn: (sheets) => number.
 */
export function makeCompiledEvalDamage(
  swapCharId: string,
  compiled: CompiledTeamDamage,
  charIdx: number,
  vars: Float64Array
): (sheets: Record<string, StatSheet>) => number {
  return (sheets: Record<string, StatSheet>) => {
    vars.fill(0);
    const sheet = sheets[swapCharId];
    if (sheet) fillVarsFromSheet(sheet, compiled.varMapping, charIdx, vars);
    return compiled.evaluate(vars);
  };
}

/**
 * Fill the Float64Array vars from raw stat maps (e.g. super-artifact stats).
 * Used for upper bound evaluation in compiled mode.
 */
export function fillVarsFromRawStats(
  rawStats: Partial<Record<StatKey, number>>[],
  /** Number of entries to read from rawStats. If undefined, reads all. */
  count: number | undefined,
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  const len = count ?? rawStats.length;
  for (let i = 0; i < len; i++) {
    const ss = rawStats[i];
    for (const [key, value] of Object.entries(ss)) {
      if (!value) continue;
      const idx = lookupVarIdx(varMapping, charIdx, key);
      if (idx !== undefined) {
        vars[idx] += value;
      }
    }
  }
}
