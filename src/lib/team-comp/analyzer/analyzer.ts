/**
 * Analyzer — computes the optimal order to invest 5★ constellations
 * and weapon refinements across a 4-character team.
 *
 * Algorithm:
 *
 * Phase 1: Tier-Snapshot Artifact Generation
 *   Generate artifacts for 12 tier snapshots:
 *     4★ weapon: C0/C1/C2 (3), 5★ R1: C0-C6 (7), 5★ R5: C2/C6 (2).
 *   Artifacts from R1 are reused for R2-R4. 4★ weapon C3+ reuses C2.
 *
 * Phase 2: Exhaustive Breakpoint Combination Evaluation
 *   Enumerate all combinations of breakpoint states across characters (up to 12^4).
 *   Each combo is evaluated with assembled artifacts from Phase 1.
 *   BuffOverrides (greedy stack allocation) are computed fresh per evaluation
 *   so constellation-dependent maxStacks are always correct.
 *   Results populate a global damage cache with auto-tracked best-at-each-M.
 *
 * Phase 3: BFS Expansion
 *   Seed BFS with all best-at-M nodes. Each node greedily expands by +1M (picking
 *   the best unvisited neighbor) until it reaches an already-visited node.
 *   All evaluations are cached. BFS edges form the investment DAG.
 *
 * M count (displayed as 金): Total investment = Σ per-character M.
 *   5★ char: M = constellation + 1 + R_value
 *   4★ char: M = R_value (constellation fixed, treated as C=-1)
 *   R_value: 0 for 4★ weapon, refinement (1-5) for 5★ weapon
 */

import type { Element, Rarity } from "@/data/enums";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  ComboLine,
  OptionMap,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import { getSetId } from "@/lib/dmgcalc/utils";
import { CharBuild } from "../../dmgcalc/core/charBuild";
import { StatSheet } from "../../dmgcalc/core/statSheet";
import { TeamBuild } from "../../dmgcalc/core/teamBuild";
import { TeamMeta } from "../../dmgcalc/core/teamMeta";
import type { GeneratorResult } from "../generator/generator";
import { runGenerator } from "../generator/generator";
import { SUBSTAT_BUDGET_DEFAULT_PRESET } from "../generator/substatBudget";
import type {
  AnalyzerCharConfig,
  AnalyzerDAG,
  AnalyzerEdge,
  AnalyzerNode,
  AnalyzerOptions,
  AnalyzerProgress,
  AnalyzerResult,
  AnalyzerStep,
  BreakpointState,
  CachedNodeRef,
  CharInvestment,
  ComboCountOverrides,
  MinErOverrides,
  TeamInvestment,
  TierSnapshot,
} from "./types";

// ─── Fixed analyzer defaults ───

/** Fixed context for all analyzer calculations. Generation and evaluation
 *  both use the same enemy params so results are self-consistent. */
const ANALYZER_CALC_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};
const ANALYZER_ROLL_MULT = 0.85;

/** Stable key for a combo line: formulaId alone for direct, formulaId:reactionType for reactions. */
export function comboLineKey(
  formulaId: string,
  reaction?: ReactionOverride
): string {
  if (!reaction?.reaction) return formulaId;
  return `${formulaId}:${reaction.reaction}`;
}

/** Build a flat key for combo count overrides. */
export function comboOverrideKey(
  charId: string,
  constellation: number,
  lineKey: string
): string {
  return `${charId}|${constellation}|${lineKey}`;
}

/** Build a flat key for minEr overrides. */
export function minErOverrideKey(
  charId: string,
  constellation: number
): string {
  return `${charId}|${constellation}`;
}

/** Key for overriding a character's base count for a reaction combo entry.
 *  Format: `_rx-char|{charId}|{formulaId}` — how many procs with this char on-field/triggering. */
export function rxCharOverrideKey(charId: string, formulaId: string): string {
  return `_rx-char|${charId}|${formulaId}`;
}

/** Key for overriding a character's constellation-gated delta for a reaction.
 *  Format: `_rx-delta|{charId}|{formulaId}` */
export function rxDeltaOverrideKey(charId: string, formulaId: string): string {
  return `_rx-delta|${charId}|${formulaId}`;
}

/** Remove all entries for a given charId from a flat override record. */
export function removeCharOverrides<T>(
  overrides: Record<string, T>,
  charId: string
): Record<string, T> {
  const prefix = `${charId}|`;
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (!k.startsWith(prefix)) result[k] = v;
  }
  return result;
}

/** Check if a flat override record has any entries for a given charId. */
export function hasCharOverrides(
  overrides: Record<string, unknown>,
  charId: string
): boolean {
  const prefix = `${charId}|`;
  return Object.keys(overrides).some((k) => k.startsWith(prefix));
}

const TIER_SNAPSHOTS: TierSnapshot[] = [
  // 4★ weapon path: C0-C2 (higher constellations reuse C2 artifacts)
  { id: "C0R0", constellation: 0, is5StarWeapon: false, refinement: 5 },
  { id: "C1R0", constellation: 1, is5StarWeapon: false, refinement: 5 },
  { id: "C2R0", constellation: 2, is5StarWeapon: false, refinement: 5 },
  // 5★ weapon R1 path: every constellation gets its own snapshot
  { id: "C0R1", constellation: 0, is5StarWeapon: true, refinement: 1 },
  { id: "C1R1", constellation: 1, is5StarWeapon: true, refinement: 1 },
  { id: "C2R1", constellation: 2, is5StarWeapon: true, refinement: 1 },
  { id: "C3R1", constellation: 3, is5StarWeapon: true, refinement: 1 },
  { id: "C4R1", constellation: 4, is5StarWeapon: true, refinement: 1 },
  { id: "C5R1", constellation: 5, is5StarWeapon: true, refinement: 1 },
  { id: "C6R1", constellation: 6, is5StarWeapon: true, refinement: 1 },
  // 5★ weapon R5 path
  { id: "C2R5", constellation: 2, is5StarWeapon: true, refinement: 5 },
  { id: "C6R5", constellation: 6, is5StarWeapon: true, refinement: 5 },
];

/**
 * Map a character's investment state to the nearest tier snapshot for artifact reuse.
 * 4★ weapon: C3+ → C2 artifacts.
 * 5★ weapon R1-R4: each constellation has its own snapshot.
 * 5★ weapon R5: C0/C1 → reuse R1 artifacts, C2-C5 → C2R5, C6 → C6R5.
 */
function getNearestSnapshot(inv: CharInvestment): string {
  if (!inv.is5StarWeapon) {
    // 4★ weapon path: clamp constellation to 0/1/2
    return `C${Math.min(inv.constellation, 2)}R0`;
  }
  if (inv.refinement >= 5) {
    // R5 path: C0/C1 reuse R1 artifacts, C2-C5 → C2R5, C6 → C6R5
    if (inv.constellation <= 1) return `C${inv.constellation}R1`;
    if (inv.constellation <= 5) return "C2R5";
    return "C6R5";
  }
  // 5★ weapon R1 path: every constellation 0-6 has its own snapshot
  return `C${Math.min(Math.max(inv.constellation, 0), 6)}R1`;
}

// ─── M-count helpers ───

/** Per-character M contribution: 5★ = constellation+1+R, 4★ = R */
function charM(inv: CharInvestment, rarity: Rarity): number {
  const cPart = rarity >= 5 ? inv.constellation + 1 : 0;
  const rPart = inv.is5StarWeapon ? inv.refinement : 0;
  return cPart + rPart;
}

/** Total M for a team allocation */
function computeM(
  allocation: TeamInvestment,
  cfgs: AnalyzerCharConfig[]
): number {
  let total = 0;
  for (const cfg of cfgs) {
    const inv = allocation[cfg.charId];
    if (inv) total += charM(inv, cfg.rarity);
  }
  return total;
}

function getBaselineState(
  cfg: AnalyzerCharConfig,
  base: TeamSlotConfig
): CharInvestment {
  // If player already owns the 5★ weapon (startRefinement > 0), baseline uses it
  if (cfg.startRefinement > 0 && cfg.weapon5Star) {
    return {
      constellation: cfg.startConstellation,
      weaponId: cfg.weapon5Star.id,
      refinement: cfg.startRefinement,
      is5StarWeapon: true,
    };
  }
  if (cfg.weapon4Star) {
    return {
      constellation: cfg.startConstellation,
      weaponId: cfg.weapon4Star.id,
      refinement: cfg.weapon4Star.refinement,
      is5StarWeapon: false,
    };
  }
  return {
    constellation: cfg.startConstellation,
    weaponId: cfg.weapon5Star?.id ?? base.weaponId,
    refinement: cfg.startRefinement > 0 ? cfg.startRefinement : 1,
    is5StarWeapon: true,
  };
}

function investmentToConfig(
  inv: CharInvestment,
  base: TeamSlotConfig
): TeamSlotConfig {
  return {
    ...base,
    constellation: inv.constellation,
    weaponId: inv.weaponId,
    refinement: inv.refinement,
  };
}

function isAllocationReachable(
  from: TeamInvestment,
  to: TeamInvestment
): boolean {
  for (const cid of Object.keys(from)) {
    const f = from[cid];
    const t = to[cid];
    if (!f || !t) continue;
    if (t.constellation < f.constellation) return false;
    if (f.is5StarWeapon && !t.is5StarWeapon) return false;
    if (f.is5StarWeapon && t.is5StarWeapon && t.refinement < f.refinement)
      return false;
  }
  return true;
}

function allocationNodeId(allocation: TeamInvestment): string {
  return Object.entries(allocation)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([cid, inv]) =>
        `${cid}:C${inv.constellation}${inv.is5StarWeapon ? "R" : "r"}${inv.refinement}`
    )
    .join("|");
}

function getBreakpointStates(cfg: AnalyzerCharConfig): BreakpointState[] {
  const is5Star = cfg.rarity >= 5;
  const has4Wep = !!cfg.weapon4Star;
  const has5Wep = !!cfg.weapon5Star;
  const sc = cfg.startConstellation;
  const sr = cfg.startRefinement; // 0 = no 5★ weapon, 1-5 = current refinement
  const owns5Star = sr > 0 && has5Wep;
  const states: BreakpointState[] = [];

  const maxC = cfg.maxConstellation;
  const maxR = cfg.maxRefinement;

  // 4★ weapon path: C0-C2 breakpoints (higher C reuses C2 artifacts)
  const CONS_4STAR_WEP = [0, 1, 2];
  // 5★ weapon path: every constellation is a breakpoint
  const CONS_5STAR_WEP = [0, 1, 2, 3, 4, 5, 6];

  if (is5Star) {
    if (!owns5Star && has4Wep) {
      const w4 = cfg.weapon4Star!.id;
      const r4 = cfg.weapon4Star!.refinement;
      const consBPs = CONS_4STAR_WEP.filter((c) => c >= sc && c <= maxC);
      for (const c of consBPs) {
        states.push({
          constellation: c,
          weaponId: w4,
          refinement: r4,
          is5StarWeapon: false,
        });
      }
    }

    if (has5Wep && maxR > 0) {
      const w5 = cfg.weapon5Star!.id;
      const baseR = owns5Star ? sr : 1;
      if (baseR <= maxR) {
        const consBPs = CONS_5STAR_WEP.filter((c) => c >= sc && c <= maxC);
        for (const c of consBPs) {
          states.push({
            constellation: c,
            weaponId: w5,
            refinement: baseR,
            is5StarWeapon: true,
          });
        }
        // R5 breakpoints at C2 and max constellation (skip if baseR is already R5)
        if (baseR < maxR) {
          // C2+R5 snapshot point (if C2 is reachable)
          if (2 >= sc && 2 <= maxC) {
            states.push({
              constellation: 2,
              weaponId: w5,
              refinement: maxR,
              is5StarWeapon: true,
            });
          }
          // C(max)+R5 final breakpoint
          const maxConsBP =
            consBPs.length > 0 ? consBPs[consBPs.length - 1] : maxC;
          if (maxConsBP !== 2) {
            states.push({
              constellation: maxConsBP,
              weaponId: w5,
              refinement: maxR,
              is5StarWeapon: true,
            });
          }
        }
      }
    }
  } else {
    // 4★ character: fixed constellation, only weapon tiers
    if (!owns5Star && has4Wep) {
      const w4 = cfg.weapon4Star!.id;
      const r4 = cfg.weapon4Star!.refinement;
      states.push({
        constellation: sc,
        weaponId: w4,
        refinement: r4,
        is5StarWeapon: false,
      });
    }
    if (has5Wep && maxR > 0) {
      const w5 = cfg.weapon5Star!.id;
      const baseR = owns5Star ? sr : 1;
      if (baseR <= maxR) {
        states.push({
          constellation: sc,
          weaponId: w5,
          refinement: baseR,
          is5StarWeapon: true,
        });
        if (baseR < maxR) {
          states.push({
            constellation: sc,
            weaponId: w5,
            refinement: maxR,
            is5StarWeapon: true,
          });
        }
      }
    }
  }

  return states;
}

// ─── Global Damage Cache ───

type CachedNode = {
  id: string;
  jin: number; // M count (total 金)
  allocation: TeamInvestment;
  damage: number;
};

class AnalyzerCache {
  private nodes = new Map<string, CachedNode>();
  bestAtJin = new Map<number, CachedNode>();

  add(node: CachedNode): void {
    if (this.nodes.has(node.id)) return;
    this.nodes.set(node.id, node);
    const existing = this.bestAtJin.get(node.jin);
    if (!existing || node.damage > existing.damage) {
      this.bestAtJin.set(node.jin, node);
    }
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }
  get(id: string): CachedNode | undefined {
    return this.nodes.get(id);
  }
  get size(): number {
    return this.nodes.size;
  }
  allNodes(): CachedNode[] {
    return [...this.nodes.values()];
  }
}

// ─── Per-char breakpoint options (for enumeration) ───

type CharOption = { inv: CharInvestment; perCharM: number };

function getCharOptions(
  cfg: AnalyzerCharConfig,
  base: TeamSlotConfig
): CharOption[] {
  const baseline = getBaselineState(cfg, base);
  const baseM = charM(baseline, cfg.rarity);
  const options: CharOption[] = [{ inv: baseline, perCharM: baseM }];

  const breakpoints = getBreakpointStates(cfg);
  const seen = new Set([
    `${baseline.constellation}:${baseline.weaponId}:${baseline.refinement}:${baseline.is5StarWeapon}`,
  ]);

  for (const bp of breakpoints) {
    const inv: CharInvestment = {
      constellation: bp.constellation,
      weaponId: bp.weaponId,
      refinement: bp.refinement,
      is5StarWeapon: bp.is5StarWeapon,
    };
    const key = `${inv.constellation}:${inv.weaponId}:${inv.refinement}:${inv.is5StarWeapon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ inv, perCharM: charM(inv, cfg.rarity) });
  }

  return options;
}

// ─── Per-allocation combo derivation ───

/**
 * Derive an allocation-specific combo by resolving each character's combo
 * descriptor at the allocation's constellation, then applying user overrides.
 * Preserves reaction overrides from the template combo lines.
 *
 * When multiple template lines share the same formulaId (different reactions),
 * the descriptor total for that formulaId is distributed proportionally across
 * those lines based on their template count ratio.
 */
/** @internal exported for testing */
export function deriveComboForAllocation(
  allocation: TeamInvestment,
  templateCombo: ComboFormula,
  teamBuild: TeamBuild,
  comboOverrides?: ComboCountOverrides
): ComboFormula {
  // Build per-char default counts at current constellation
  const descriptorCounts: Record<string, Record<string, number>> = {};
  for (const [charId, inv] of Object.entries(allocation)) {
    const resolved = teamBuild.catalog.resolveCombo(charId, inv.constellation);
    if (resolved && Object.keys(resolved).length > 0) {
      descriptorCounts[charId] = resolved;
    }
  }

  // Pre-compute template totals per (charId, formulaId) for proportional distribution
  const templateTotals: Record<string, Record<string, number>> = {};
  for (const line of templateCombo.lines) {
    if (!templateTotals[line.charId]) templateTotals[line.charId] = {};
    templateTotals[line.charId][line.formulaId] =
      (templateTotals[line.charId][line.formulaId] ?? 0) + line.count;
  }

  // Resolve per-triggerer rx- counts with override support.
  // Template combo lines already have per-triggerer formula IDs (e.g. rx-overloaded-amber)
  // with charId and default counts. We apply user overrides on top.
  const rxGrid = teamBuild.catalog.getReactionComboGrid();

  // Pre-resolve per-triggerer counts from grid rows with overrides applied
  const rxResolvedCounts: Record<string, number> = {};
  for (const row of rxGrid) {
    const eligibleArr = [...row.eligible];

    // Check if any per-char overrides exist for this base reaction
    const hasCharOverride = eligibleArr.some(
      (c) => comboOverrides?.[rxCharOverrideKey(c, row.baseId)] != null
    );

    if (hasCharOverride) {
      for (const charId of eligibleArr) {
        const override =
          comboOverrides?.[rxCharOverrideKey(charId, row.baseId)];
        rxResolvedCounts[`${row.baseId}-${charId}`] = override ?? 0;
      }
    } else {
      let total = row.baseTotal;
      for (const b of row.bonus) {
        const delta =
          comboOverrides?.[rxDeltaOverrideKey(b.charId, row.baseId)] ?? b.delta;
        if ((allocation[b.charId]?.constellation ?? 0) >= b.minC) {
          total += delta;
        }
      }
      if (total > 0) {
        for (const charId of eligibleArr) {
          rxResolvedCounts[`${row.baseId}-${charId}`] =
            charId === row.onFieldCharId
              ? Math.max(0, total - (eligibleArr.length - 1))
              : 1;
        }
      } else {
        for (const charId of eligibleArr) {
          rxResolvedCounts[`${row.baseId}-${charId}`] = 0;
        }
      }
    }
  }

  // Build new lines from template, adjusting counts
  const lines: ComboLine[] = templateCombo.lines.flatMap((line) => {
    // Reaction combo lines: apply resolved count override
    if (line.formulaId.startsWith("rx-")) {
      const resolved = rxResolvedCounts[line.formulaId];
      if (resolved != null) {
        return resolved > 0 ? { ...line, count: resolved } : [];
      }
      return [line]; // no descriptor entry → keep template count
    }

    const charId = line.charId;
    const constellation = allocation[charId]?.constellation ?? 0;
    const lk = comboLineKey(line.formulaId, line.reaction);

    // Check user override (flat key)
    const overrideCount =
      comboOverrides?.[comboOverrideKey(charId, constellation, lk)];
    if (overrideCount != null) {
      return { ...line, count: overrideCount };
    }

    // Proportional distribution from descriptor
    const descTotal = descriptorCounts[charId]?.[line.formulaId];
    if (descTotal != null) {
      const tmplTotal = templateTotals[charId]?.[line.formulaId] ?? 0;
      if (tmplTotal > 0) {
        return {
          ...line,
          count: Math.round((line.count / tmplTotal) * descTotal),
        };
      }
      return { ...line, count: descTotal };
    }

    // Fall through to template count
    return line;
  });

  // Append per-triggerer rx- formulas not in the template (user-added via overrides)
  const rxInTemplate = new Set(
    lines.filter((l) => l.formulaId.startsWith("rx-")).map((l) => l.formulaId)
  );
  for (const [formulaId, count] of Object.entries(rxResolvedCounts)) {
    if (rxInTemplate.has(formulaId) || count <= 0) continue;
    const entry = teamBuild.catalog.formulaIndex.get(formulaId);
    const charId = entry?.parts[0]?.statsCharId ?? "";
    lines.push({ charId, formulaId, count });
  }

  return { ...templateCombo, lines };
}

/**
 * Get the effective minEr for a character at a given constellation,
 * checking per-constellation overrides first, then falling back to base.
 */
/** @internal exported for testing */
export function getEffectiveMinEr(
  charId: string,
  constellation: number,
  perChar?: Record<string, { minEr: number; minCr: number }>,
  minErOverrides?: MinErOverrides
): number {
  return (
    minErOverrides?.[minErOverrideKey(charId, constellation)] ??
    perChar?.[charId]?.minEr ??
    1.0
  );
}

/**
 * Build effective perChar constraints for a given allocation,
 * applying per-constellation minEr overrides.
 */
/** @internal exported for testing */
export function buildEffectivePerChar(
  allocation: TeamInvestment,
  perChar?: Record<string, { minEr: number; minCr: number }>,
  minErOverrides?: MinErOverrides
): Record<string, { minEr: number; minCr: number }> | undefined {
  if (!minErOverrides || Object.keys(minErOverrides).length === 0)
    return perChar;
  const result: Record<string, { minEr: number; minCr: number }> = {};
  for (const [charId, inv] of Object.entries(allocation)) {
    result[charId] = {
      minEr: getEffectiveMinEr(
        charId,
        inv.constellation,
        perChar,
        minErOverrides
      ),
      minCr: perChar?.[charId]?.minCr ?? 0,
    };
  }
  return result;
}

// ─── Artifact assembly + eval ───

type SnapshotCache = Record<string, Record<string, StatSheet>>;

function assembleSheets(
  allocation: TeamInvestment,
  configs: AnalyzerCharConfig[],
  snapshotCache: SnapshotCache
): Record<string, StatSheet> {
  const sheets: Record<string, StatSheet> = {};
  for (const cfg of configs) {
    const inv = allocation[cfg.charId];
    if (!inv) {
      sheets[cfg.charId] = new StatSheet([]);
      continue;
    }
    const snapshotId = getNearestSnapshot(inv);
    const snapshot = snapshotCache[snapshotId];
    sheets[cfg.charId] = snapshot?.[cfg.charId] ?? new StatSheet([]);
  }
  return sheets;
}

/**
 * Evaluate an allocation's combo damage.
 * Computes greedy buffOverrides fresh from the TeamBuild at the current
 * constellation/weapon state, so stack-limited buffs (e.g. maxStacks that
 * change per constellation) are always correct.
 *
 * @param charBuildCache - Optional pre-built CharBuild cache keyed by
 *   `charId:constellation:weaponId:refinement`. Avoids re-creating
 *   CharacterBase/WeaponBase/ArtifactSetBase for each evaluation.
 * @param hasAnyStackLimited - Pre-computed flag; when false, skips
 *   buffOverride computation entirely (no stack-limited buffs in any variant).
 */
function evalWithCachedArtifacts(
  allocation: TeamInvestment,
  sheets: Record<string, StatSheet>,
  baseConfigs: TeamSlotConfig[],
  combatOpts: OptionMap,
  enemyAura: Element | undefined,
  combo: ComboFormula,
  calcContext: CalcContext,
  charBuildCache?: Map<string, CharBuild>,
  hasAnyStackLimited?: boolean
): number {
  try {
    const configs = baseConfigs.map((bc) => {
      const inv = allocation[bc.charId];
      return inv ? investmentToConfig(inv, bc) : bc;
    });

    // Look up cached CharBuilds for this specific allocation
    let cachedBuilds: Record<string, CharBuild> | undefined;
    if (charBuildCache) {
      cachedBuilds = {};
      for (const cfg of configs) {
        const key = `${cfg.charId}:${cfg.constellation}:${cfg.weaponId}:${cfg.refinement}`;
        const cached = charBuildCache.get(key);
        if (cached) {
          cachedBuilds[cfg.charId] = cached;
        } else {
          // Cache miss — fall back to normal construction for this team
          cachedBuilds = undefined;
          break;
        }
      }
    }

    const tb = new TeamBuild(configs, combatOpts, enemyAura, [], cachedBuilds);

    // Compute greedy buff allocation for this specific constellation state.
    // Filter to valid lines (formulas that exist at this constellation).
    const allFormulas = tb.catalog.getFormulaIds();
    const validLines = combo.lines.filter((l) => {
      const cf = allFormulas[l.charId];
      return cf?.[l.formulaId];
    });
    const validCombo = { ...combo, lines: validLines };

    let buffOverrides: Record<number, BuffActivationMap> | undefined;
    if (validLines.length > 0 && hasAnyStackLimited !== false) {
      // If hasAnyStackLimited is undefined (no pre-check), do the per-eval check
      const needCheck =
        hasAnyStackLimited === true ||
        tb.buffLedger.allBuffs.some(
          ({ buff }) => buff.source.maxStacks != null
        );
      if (needCheck) {
        buffOverrides = tb.computeComboPartialBuffSpecs(
          validLines,
          sheets,
          calcContext
        );
      }
    }

    return tb.getComboDamageResult(
      validCombo,
      sheets,
      calcContext,
      buffOverrides
    ).totalDamage;
  } catch {
    return 0;
  }
}

/** Evaluate an allocation, using the global cache to avoid redundant computation. */
function evalAndCache(
  allocation: TeamInvestment,
  cache: AnalyzerCache,
  configs: AnalyzerCharConfig[],
  snapshotCache: SnapshotCache,
  baseConfigs: TeamSlotConfig[],
  combatOpts: OptionMap,
  enemyAura: Element | undefined,
  combo: ComboFormula,
  calcContext: CalcContext,
  charBuildCache?: Map<string, CharBuild>,
  hasAnyStackLimited?: boolean
): CachedNode {
  const id = allocationNodeId(allocation);
  const existing = cache.get(id);
  if (existing) return existing;

  const sheets = assembleSheets(allocation, configs, snapshotCache);
  const damage = evalWithCachedArtifacts(
    allocation,
    sheets,
    baseConfigs,
    combatOpts,
    enemyAura,
    combo,
    calcContext,
    charBuildCache,
    hasAnyStackLimited
  );
  const jin = computeM(allocation, configs);
  const node: CachedNode = { id, jin, allocation: { ...allocation }, damage };
  cache.add(node);
  return node;
}

// ─── Artifact Generation ───

async function runGeneration(
  allocation: TeamInvestment,
  baseConfigs: TeamSlotConfig[],
  combatOpts: OptionMap,
  enemyAura: Element | undefined,
  combo: ComboFormula,
  perChar?: Record<string, { minEr: number; minCr: number }>,
  calcContext?: CalcContext
): Promise<Record<string, StatSheet>> {
  const configs = baseConfigs.map((bc) => {
    const inv = allocation[bc.charId];
    return inv ? investmentToConfig(inv, bc) : bc;
  });
  const teamBuild = new TeamBuild(configs, combatOpts, enemyAura);
  const carryCharId =
    combo.lines.find((l) => l.count > 0)?.charId ?? configs[0].charId;

  let finalResult: GeneratorResult | null = null;
  for await (const result of runGenerator({
    teamBuild,
    carryCharId,
    calcContext: calcContext ?? ANALYZER_CALC_CONTEXT,
    combo: { ...combo, lines: combo.lines.filter((l) => l.count > 0) },
    rollMultiplier: calcContext?.rollMultiplier ?? ANALYZER_ROLL_MULT,
    substatBudget: calcContext?.substatBudget ?? SUBSTAT_BUDGET_DEFAULT_PRESET,
    perChar,
    ignoreArtifactSets: {},
  })) {
    finalResult = result;
  }

  return finalResult?.sheetsByChar ?? {};
}

// ─── Progress weight constants ───
const P1_WEIGHT = 0.4; // 0% → 40%  (artifact generation)
const P2_WEIGHT = 0.5; // 40% → 90% (breakpoint combinations)
const P3_WEIGHT = 0.1; // 90% → 100% (DAG fill)

// ─── Phase 1: Tier snapshot generation ───

async function* computePhase1(
  opts: AnalyzerOptions
): AsyncGenerator<AnalyzerProgress, SnapshotCache> {
  const {
    configs,
    baseConfigs,
    teamBuild,
    templateCombo,
    perChar,
    minErOverrides,
  } = opts;
  const combatOpts = teamBuild.combatOpts;
  const enemyAura = teamBuild.enemyAura;

  const any4StarWeapon = configs.some((c) => c.weapon4Star);
  const any5StarWeapon = configs.some((c) => c.weapon5Star);
  const relevantSnapshots = TIER_SNAPSHOTS.filter((s) => {
    if (!s.is5StarWeapon && !any4StarWeapon) return false;
    if (s.is5StarWeapon && !any5StarWeapon) return false;
    return true;
  });

  const snapshotCache: SnapshotCache = {};

  for (let i = 0; i < relevantSnapshots.length; i++) {
    const snapshot = relevantSnapshots[i];
    const phasePct = i / relevantSnapshots.length;

    yield {
      phase: "phase1",
      phaseProgress: phasePct,
      overallProgress: phasePct * P1_WEIGHT,
      message: `Generating artifacts for ${snapshot.id} (${i + 1}/${relevantSnapshots.length})...`,
    };
    // Let browser paint the progress update before starting heavy work
    await new Promise((r) => setTimeout(r, 0));

    const allocation: TeamInvestment = {};
    for (let ci = 0; ci < configs.length; ci++) {
      const cfg = configs[ci];
      const bc = baseConfigs[ci];
      const is5Star = cfg.rarity >= 5;
      const has4Wep = !!cfg.weapon4Star;
      const has5Wep = !!cfg.weapon5Star;

      let cons = snapshot.constellation;
      let weaponId = bc.weaponId;
      let refinement = bc.refinement;
      let is5StarWep = false;

      if (!is5Star) {
        cons = cfg.startConstellation;
      } else {
        cons = Math.max(snapshot.constellation, cfg.startConstellation);
      }

      if (snapshot.is5StarWeapon && has5Wep) {
        weaponId = cfg.weapon5Star!.id;
        refinement = snapshot.refinement;
        is5StarWep = true;
      } else if (!snapshot.is5StarWeapon && has4Wep) {
        weaponId = cfg.weapon4Star!.id;
        refinement = cfg.weapon4Star!.refinement;
        is5StarWep = false;
      } else if (snapshot.is5StarWeapon && !has5Wep && has4Wep) {
        weaponId = cfg.weapon4Star!.id;
        refinement = cfg.weapon4Star!.refinement;
        is5StarWep = false;
      } else if (!snapshot.is5StarWeapon && !has4Wep && has5Wep) {
        weaponId = cfg.weapon5Star!.id;
        refinement = 1;
        is5StarWep = true;
      }

      allocation[cfg.charId] = {
        constellation: cons,
        weaponId,
        refinement,
        is5StarWeapon: is5StarWep,
      };
    }

    const derivedCombo = deriveComboForAllocation(
      allocation,
      templateCombo,
      teamBuild,
      opts.comboOverrides
    );
    const effectivePerChar = buildEffectivePerChar(
      allocation,
      perChar,
      minErOverrides
    );
    const result = await runGeneration(
      allocation,
      baseConfigs,
      combatOpts,
      enemyAura,
      derivedCombo,
      effectivePerChar,
      opts.calcContext
    );

    snapshotCache[snapshot.id] = result;
  }

  yield {
    phase: "phase1",
    phaseProgress: 1,
    overallProgress: P1_WEIGHT,
    message: "Artifact generation complete",
  };
  return snapshotCache;
}

// ─── CharBuild cache for Phase 2/3 ───

type CharBuildCacheResult = {
  charBuildCache: Map<string, CharBuild>;
  hasAnyStackLimited: boolean;
};

/**
 * Pre-build CharBuild instances for every unique (charId, constellation,
 * weaponId, refinement) option. Since no implementation checks cross-character
 * constellation/refinement, each CharBuild is independent and can be reused
 * across all team combinations that share the same per-character state.
 *
 * Also pre-computes a global hasAnyStackLimited flag by checking all cached
 * builds' buff lists. When false, Phase 2/3 can skip buffOverride computation.
 */
function buildCharBuildCache(
  charOpts: { charId: string; options: CharOption[] }[],
  baseConfigs: TeamSlotConfig[],
  combatOpts: OptionMap,
  enemyAura: Element | undefined
): CharBuildCacheResult {
  const charBuildCache = new Map<string, CharBuild>();
  let hasAnyStackLimited = false;

  // Build a representative TeamMeta using baseline constellations.
  // Each CharBuild only reads self-constellation from teamMeta, so the
  // "wrong" values for other characters are harmless.
  const charIds = baseConfigs.map((c) => c.charId);
  const baseConstellations: Record<string, number> = {};
  const artifactSets: Record<string, string> = {};
  for (const c of baseConfigs) {
    baseConstellations[c.charId] = c.constellation;
    const setId = getSetId(c.artifactSet);
    if (setId) artifactSets[c.charId] = setId;
  }

  for (const { charId, options } of charOpts) {
    const baseConfig = baseConfigs.find((c) => c.charId === charId);
    if (!baseConfig) continue;

    for (const opt of options) {
      const key = `${charId}:${opt.inv.constellation}:${opt.inv.weaponId}:${opt.inv.refinement}`;
      if (charBuildCache.has(key)) continue;

      // Create a TeamMeta with the correct self-constellation
      const constellations = {
        ...baseConstellations,
        [charId]: opt.inv.constellation,
      };
      const teamMeta = new TeamMeta(
        charIds,
        constellations,
        artifactSets,
        enemyAura
      );

      const config = investmentToConfig(opt.inv, baseConfig);
      const build = new CharBuild(config, teamMeta, combatOpts);
      charBuildCache.set(key, build);

      // Check if this build contributes any stack-limited buffs
      if (!hasAnyStackLimited) {
        for (const buff of build.getAllBuffs()) {
          if (buff.source.maxStacks != null) {
            hasAnyStackLimited = true;
            break;
          }
        }
      }
    }
  }

  return { charBuildCache, hasAnyStackLimited };
}

// ─── Phase 2: Exhaustive breakpoint combination evaluation ───

async function* computePhase2(
  opts: AnalyzerOptions,
  snapshotCache: SnapshotCache,
  cache: AnalyzerCache
): AsyncGenerator<AnalyzerProgress, CharBuildCacheResult> {
  const { configs, baseConfigs, teamBuild, templateCombo } = opts;
  const combatOpts = teamBuild.combatOpts;
  const enemyAura = teamBuild.enemyAura;

  const charOpts = configs.map((cfg, i) => ({
    charId: cfg.charId,
    options: getCharOptions(cfg, baseConfigs[i]),
  }));

  // Pre-build CharBuild cache for all unique per-character options
  const { charBuildCache, hasAnyStackLimited } = buildCharBuildCache(
    charOpts,
    baseConfigs,
    combatOpts,
    enemyAura
  );

  const totalCombos = charOpts.reduce((acc, co) => acc * co.options.length, 1);
  let count = 0;

  yield {
    phase: "phase2",
    phaseProgress: 0,
    overallProgress: P1_WEIGHT,
    message: `Evaluating ${totalCombos} breakpoint combinations...`,
  };

  function enumerate(ci: number, alloc: TeamInvestment, totalM: number) {
    if (ci >= charOpts.length) {
      const id = allocationNodeId(alloc);
      if (!cache.has(id)) {
        const derivedCombo = deriveComboForAllocation(
          alloc,
          templateCombo,
          teamBuild,
          opts.comboOverrides
        );
        const activeCombo = {
          ...derivedCombo,
          lines: derivedCombo.lines.filter((l) => l.count > 0),
        };
        const sheets = assembleSheets(alloc, configs, snapshotCache);
        const damage = evalWithCachedArtifacts(
          alloc,
          sheets,
          baseConfigs,
          combatOpts,
          enemyAura,
          activeCombo,
          opts.calcContext,
          charBuildCache,
          hasAnyStackLimited
        );
        cache.add({ id, jin: totalM, allocation: { ...alloc }, damage });
      }
      count++;
      return;
    }
    const { charId, options } = charOpts[ci];
    for (const opt of options) {
      alloc[charId] = { ...opt.inv };
      enumerate(ci + 1, alloc, totalM + opt.perCharM);
    }
  }

  // Batch by top-level character options, yielding progress between batches
  if (charOpts.length > 0) {
    const { charId, options } = charOpts[0];
    for (let bi = 0; bi < options.length; bi++) {
      const opt = options[bi];
      const alloc: TeamInvestment = { [charId]: { ...opt.inv } };
      enumerate(1, alloc, opt.perCharM);

      const phasePct = (bi + 1) / options.length;
      yield {
        phase: "phase2",
        phaseProgress: phasePct,
        overallProgress: P1_WEIGHT + phasePct * P2_WEIGHT,
        message: `Evaluated ${count}/${totalCombos} combinations...`,
      };
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  yield {
    phase: "phase2",
    phaseProgress: 1,
    overallProgress: P1_WEIGHT + P2_WEIGHT,
    message: `Evaluated ${count} combinations, ${cache.bestAtJin.size} M-tiers found`,
  };

  return { charBuildCache, hasAnyStackLimited };
}

// ─── Phase 3: Constrained greedy along bestAtM parent→child edges ───
//
// 1. Build a DAG among bestAtJin nodes via transitive reduction of the
//    reachability relation. Each edge from→to is "direct" — no intermediate
//    bestAtJin node lies between them. This finds ALL minimal parent/child
//    relationships, capturing parallel investment paths.
// 2. Run greedy +1M fill along each edge, constrained to not exceed
//    the child's allocation. This prevents greedy from wandering into
//    tiny support refinements when it should be building toward a
//    character's next breakpoint.

async function* computePhase3(
  cache: AnalyzerCache,
  snapshotCache: SnapshotCache,
  opts: AnalyzerOptions,
  charBuildCacheResult?: CharBuildCacheResult
): AsyncGenerator<AnalyzerProgress, AnalyzerEdge[]> {
  const { configs, baseConfigs, teamBuild, templateCombo } = opts;
  const combatOpts = teamBuild.combatOpts;
  const enemyAura = teamBuild.enemyAura;
  const charBuildCache = charBuildCacheResult?.charBuildCache;
  const hasAnyStackLimited = charBuildCacheResult?.hasAnyStackLimited;

  // 1. Collect bestAtJin nodes sorted by 金
  const bestNodes = [...cache.bestAtJin.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, node]) => node);

  if (bestNodes.length < 2) return [];

  // 2. Build the full set of direct parent→child edges among bestAtJin nodes
  //    (transitive reduction of the reachability relation).
  //    Edge from→to is "direct" if from→to is reachable and no intermediate
  //    bestAtJin node mid exists with from→mid→to all reachable.
  type BestEdge = { from: CachedNode; to: CachedNode };
  const bestEdges: BestEdge[] = [];

  for (let i = 0; i < bestNodes.length; i++) {
    const from = bestNodes[i];
    for (let j = i + 1; j < bestNodes.length; j++) {
      const to = bestNodes[j];
      if (!isAllocationReachable(from.allocation, to.allocation)) continue;

      // Check for any intermediate bestAtJin node that makes this edge redundant
      let hasIntermediate = false;
      for (let k = 0; k < bestNodes.length; k++) {
        if (k === i || k === j) continue;
        const mid = bestNodes[k];
        if (mid.jin <= from.jin || mid.jin >= to.jin) continue;
        if (
          isAllocationReachable(from.allocation, mid.allocation) &&
          isAllocationReachable(mid.allocation, to.allocation)
        ) {
          hasIntermediate = true;
          break;
        }
      }

      if (!hasIntermediate) {
        bestEdges.push({ from, to });
      }
    }
  }

  yield {
    phase: "phase3",
    phaseProgress: 0,
    overallProgress: P1_WEIGHT + P2_WEIGHT,
    message: `Filling ${bestEdges.length} paths between optimal tiers...`,
  };

  // 3. Constrained greedy along each bestEdge.
  //    At each step, only pick +1M upgrades where the resulting allocation
  //    stays ≤ the target child's allocation (isAllocationReachable).
  //    This guarantees convergence to the child after exactly (to.jin - from.jin) steps.
  const edges: AnalyzerEdge[] = [];

  for (let ei = 0; ei < bestEdges.length; ei++) {
    const { from, to } = bestEdges[ei];
    let current: CachedNode = from;

    while (current.jin < to.jin) {
      const upgrades = getSingleStepUpgrades(
        current.allocation,
        configs
      ).filter((up) => isAllocationReachable(up.allocation, to.allocation));

      if (upgrades.length === 0) break;

      let bestUp: {
        cached: CachedNode;
        charId: string;
        upgrade: string;
      } | null = null;
      for (const up of upgrades) {
        const derivedCombo = deriveComboForAllocation(
          up.allocation,
          templateCombo,
          teamBuild,
          opts.comboOverrides
        );
        const activeCombo = {
          ...derivedCombo,
          lines: derivedCombo.lines.filter((l) => l.count > 0),
        };
        const cached = evalAndCache(
          up.allocation,
          cache,
          configs,
          snapshotCache,
          baseConfigs,
          combatOpts,
          enemyAura,
          activeCombo,
          opts.calcContext,
          charBuildCache,
          hasAnyStackLimited
        );
        if (!bestUp || cached.damage > bestUp.cached.damage) {
          bestUp = { cached, charId: up.charId, upgrade: up.upgrade };
        }
      }

      if (!bestUp) break;

      edges.push({
        fromId: current.id,
        toId: bestUp.cached.id,
        charId: bestUp.charId,
        upgrade: bestUp.upgrade,
        marginalDamage: bestUp.cached.damage - current.damage,
      });

      current = bestUp.cached;
    }

    const phasePct = (ei + 1) / bestEdges.length;
    yield {
      phase: "phase3",
      phaseProgress: phasePct,
      overallProgress: P1_WEIGHT + P2_WEIGHT + phasePct * P3_WEIGHT,
      message: `Filling path ${ei + 1}/${bestEdges.length}...`,
    };
    await new Promise((r) => setTimeout(r, 0));
  }

  yield {
    phase: "phase3",
    phaseProgress: 1,
    overallProgress: P1_WEIGHT + P2_WEIGHT + P3_WEIGHT,
    message: `Filled ${edges.length} steps across ${bestEdges.length} paths`,
  };
  return edges;
}

// ─── +1M step generation ───

function getSingleStepUpgrades(
  alloc: TeamInvestment,
  cfgs: AnalyzerCharConfig[]
): { allocation: TeamInvestment; charId: string; upgrade: string }[] {
  const ups: { allocation: TeamInvestment; charId: string; upgrade: string }[] =
    [];
  for (const cfg of cfgs) {
    const inv = alloc[cfg.charId];
    if (!inv) continue;
    if (cfg.rarity >= 5 && inv.constellation < cfg.maxConstellation) {
      const nc = inv.constellation + 1;
      ups.push({
        allocation: { ...alloc, [cfg.charId]: { ...inv, constellation: nc } },
        charId: cfg.charId,
        upgrade: `C${inv.constellation}→C${nc}`,
      });
    }
    if (inv.is5StarWeapon && inv.refinement < cfg.maxRefinement) {
      const nr = inv.refinement + 1;
      ups.push({
        allocation: { ...alloc, [cfg.charId]: { ...inv, refinement: nr } },
        charId: cfg.charId,
        upgrade: `R${inv.refinement}→R${nr}`,
      });
    }
    if (!inv.is5StarWeapon && cfg.weapon5Star && cfg.maxRefinement > 0) {
      ups.push({
        allocation: {
          ...alloc,
          [cfg.charId]: {
            ...inv,
            weaponId: cfg.weapon5Star.id,
            refinement: 1,
            is5StarWeapon: true,
          },
        },
        charId: cfg.charId,
        upgrade: "4★→5★R1",
      });
    }
  }
  return ups;
}

// ─── Sequence derivation ───

function deriveSequence(dag: AnalyzerDAG): {
  sequence: AnalyzerStep[];
  bestAtTier: Map<number, AnalyzerNode>;
} {
  const bestAtTier = new Map<number, AnalyzerNode>();
  for (const n of dag.nodes) {
    const ex = bestAtTier.get(n.jin);
    if (!ex || n.damage > ex.damage) bestAtTier.set(n.jin, n);
  }

  const seq: AnalyzerStep[] = [];
  const jins = [...bestAtTier.keys()].sort((a, b) => a - b);
  const baselineDamage =
    jins.length > 0 ? (bestAtTier.get(jins[0])?.damage ?? 0) : 0;

  for (let i = 0; i < jins.length; i++) {
    const cur = bestAtTier.get(jins[i])!;
    const prev = i > 0 ? bestAtTier.get(jins[i - 1])! : null;

    seq.push({
      jin: jins[i],
      allocation: cur.allocation,
      damage: cur.damage,
      gainVsBaseline: cur.damage - baselineDamage,
      gainVsBaselinePct:
        baselineDamage > 0
          ? ((cur.damage - baselineDamage) / baselineDamage) * 100
          : 0,
      gainVsPrev: prev ? cur.damage - prev.damage : 0,
      gainVsPrevPct:
        prev && prev.damage > 0
          ? ((cur.damage - prev.damage) / prev.damage) * 100
          : 0,
    });
  }

  return { sequence: seq, bestAtTier };
}

// ─── Main entry point ───

export async function* runAnalysis(
  opts: AnalyzerOptions
): AsyncGenerator<AnalyzerProgress | AnalyzerResult> {
  // Phase 1: Generate tier snapshots (streams progress via yield*)
  const snapshotCache: SnapshotCache = yield* computePhase1(opts);

  // Global damage cache
  const cache = new AnalyzerCache();

  // Phase 2: Exhaustive breakpoint combination evaluation
  const charBuildCacheResult: CharBuildCacheResult = yield* computePhase2(
    opts,
    snapshotCache,
    cache
  );

  // Phase 3: BFS expansion from best-at-M seeds
  const edges: AnalyzerEdge[] = yield* computePhase3(
    cache,
    snapshotCache,
    opts,
    charBuildCacheResult
  );

  // Build DAG from cache + edges
  const nodes: AnalyzerNode[] = [];
  const nodeIds = new Set<string>();

  // Include all best-at-M nodes
  for (const cn of cache.bestAtJin.values()) {
    if (!nodeIds.has(cn.id)) {
      nodeIds.add(cn.id);
      nodes.push({
        id: cn.id,
        jin: cn.jin,
        allocation: cn.allocation,
        damage: cn.damage,
        validated: true,
        isBreakpoint: true,
      });
    }
  }
  // Include edge endpoints not yet in nodes
  for (const e of edges) {
    for (const eid of [e.fromId, e.toId]) {
      if (!nodeIds.has(eid)) {
        nodeIds.add(eid);
        const cn = cache.get(eid);
        if (cn)
          nodes.push({
            id: cn.id,
            jin: cn.jin,
            allocation: cn.allocation,
            damage: cn.damage,
            validated: true,
            isBreakpoint: false,
          });
      }
    }
  }

  const jinValues = nodes.map((n) => n.jin);
  const dag: AnalyzerDAG = {
    nodes,
    edges,
    baselineJin: jinValues.length > 0 ? Math.min(...jinValues) : 0,
    maxJin: jinValues.length > 0 ? Math.max(...jinValues) : 0,
  };

  const { sequence, bestAtTier } = deriveSequence(dag);

  // Build nodesByJin from all cached evaluations
  const nodesByJin = new Map<number, CachedNodeRef[]>();
  for (const cn of cache.allNodes()) {
    let list = nodesByJin.get(cn.jin);
    if (!list) {
      list = [];
      nodesByJin.set(cn.jin, list);
    }
    list.push({ id: cn.id, allocation: cn.allocation, damage: cn.damage });
  }

  yield {
    phase: "done" as const,
    phaseProgress: 1,
    overallProgress: 1,
    message: "Done",
  };
  yield { dag, bestAtTier, sequence, nodesByJin } satisfies AnalyzerResult;
}

export function isAnalyzerResult(
  v: AnalyzerProgress | AnalyzerResult
): v is AnalyzerResult {
  return "dag" in v;
}
