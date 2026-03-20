/**
 * Investment Optimizer — computes the optimal order to invest 5★ constellations
 * and weapon refinements across a 4-character team.
 *
 * Algorithm:
 *
 * Phase 1: Tier-Snapshot Artifact Generation
 *   Generate ideal artifacts for 9 tier snapshots (C0/C1/C2/C6 × 4★R5/5★R1 + C6R5).
 *   Artifacts from C2 are reused for C3-C5, from R1 for R2-R4.
 *
 * Phase 2: Exhaustive Breakpoint Combination Evaluation
 *   Enumerate all combinations of breakpoint states across characters (up to 9^4 = 6561).
 *   Each combo is evaluated with assembled artifacts from Phase 1.
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

import type { Element, Rarity } from "@/data/types";

import { TeamBuild, evaluateCombo } from "./damageCalc";
import type { CombatOpts } from "./damageModels";
import { StatSheet } from "./damageModels";
import type { IdealGenResult } from "./idealArtifactGen";
import { runIdealArtifactGen } from "./idealArtifactGen";
import { IDEAL_SUBSTAT_BUDGET_DEFAULT_PRESET } from "./idealSubstatBudget";
import type {
  CalcContext,
  CharCompConfig,
  ComboFormula,
  ReactionOverride,
} from "./types";

// ─── Types ───

export type CharInvestment = {
  constellation: number; // 0-6
  weaponId: string;
  refinement: number; // 1-5
  is5StarWeapon: boolean;
};

export type TeamInvestment = Record<string, CharInvestment>;

export type InvestmentCharConfig = {
  charId: string;
  rarity: Rarity;
  weapon4Star?: { id: string; refinement: number };
  weapon5Star?: { id: string };
  startConstellation: number;
  startRefinement: number; // 0 = no 5★ weapon yet, 1-5 = current 5★ refinement
};

export type InvestmentNode = {
  id: string;
  jin: number;
  allocation: TeamInvestment;
  damage: number;
  validated: boolean;
  isBreakpoint: boolean;
};

export type InvestmentEdge = {
  fromId: string;
  toId: string;
  charId: string;
  upgrade: string;
  marginalDamage: number;
};

export type InvestmentDAG = {
  nodes: InvestmentNode[];
  edges: InvestmentEdge[];
  baselineJin: number;
  maxJin: number;
};

export type InvestmentStep = {
  jin: number;
  allocation: TeamInvestment;
  damage: number;
  gainVsBaseline: number;
  gainVsBaselinePct: number;
  gainVsPrev: number;
  gainVsPrevPct: number;
};

export type InvestmentResult = {
  dag: InvestmentDAG;
  bestAtTier: Map<number, InvestmentNode>;
  sequence: InvestmentStep[];
};

export type InvestmentPhase = "phase1" | "phase2" | "phase3" | "done";

export type InvestmentProgress = {
  phase: InvestmentPhase;
  phaseProgress: number;
  overallProgress: number;
  message: string;
};

export type InvestmentOptions = {
  configs: InvestmentCharConfig[];
  baseConfigs: CharCompConfig[];
  teamBuild: TeamBuild;
  combo: ComboFormula;
  calcContext: CalcContext;
  reactionOverrides?: Record<string, ReactionOverride>;
  perChar?: Record<string, { minEr: number; minCr: number }>;
};

// ─── Tier Snapshot IDs ───

type TierSnapshot = {
  id: string;
  constellation: number;
  is5StarWeapon: boolean;
  refinement: number;
};

const TIER_SNAPSHOTS: TierSnapshot[] = [
  { id: "C0R0", constellation: 0, is5StarWeapon: false, refinement: 5 },
  { id: "C1R0", constellation: 1, is5StarWeapon: false, refinement: 5 },
  { id: "C2R0", constellation: 2, is5StarWeapon: false, refinement: 5 },
  { id: "C6R0", constellation: 6, is5StarWeapon: false, refinement: 5 },
  { id: "C0R1", constellation: 0, is5StarWeapon: true, refinement: 1 },
  { id: "C1R1", constellation: 1, is5StarWeapon: true, refinement: 1 },
  { id: "C2R1", constellation: 2, is5StarWeapon: true, refinement: 1 },
  { id: "C6R1", constellation: 6, is5StarWeapon: true, refinement: 1 },
  { id: "C6R5", constellation: 6, is5StarWeapon: true, refinement: 5 },
];

/**
 * Map a character's investment state to the nearest tier snapshot for artifact reuse.
 * C3-C5 → C2 artifacts, R2-R4 → R1 artifacts, only C6R5 gets its own snapshot.
 */
function getNearestSnapshot(inv: CharInvestment): string {
  if (inv.is5StarWeapon && inv.refinement >= 5 && inv.constellation >= 6) {
    return "C6R5";
  }
  const consTier =
    inv.constellation <= 0
      ? 0
      : inv.constellation <= 1
        ? 1
        : inv.constellation <= 2
          ? 2
          : 6;
  const weaponSuffix = inv.is5StarWeapon ? "R1" : "R0";
  return `C${consTier}${weaponSuffix}`;
}

// ─── Breakpoint State ───

type BreakpointState = {
  constellation: number;
  weaponId: string;
  refinement: number;
  is5StarWeapon: boolean;
};

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
  cfgs: InvestmentCharConfig[]
): number {
  let total = 0;
  for (const cfg of cfgs) {
    const inv = allocation[cfg.charId];
    if (inv) total += charM(inv, cfg.rarity);
  }
  return total;
}

// ─── Helpers ───

function getBaselineState(
  cfg: InvestmentCharConfig,
  base: CharCompConfig
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
  base: CharCompConfig
): CharCompConfig {
  return {
    ...base,
    constellation: inv.constellation,
    weaponId: inv.weaponId,
    refinement: inv.refinement,
  };
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

function getBreakpointStates(cfg: InvestmentCharConfig): BreakpointState[] {
  const is5Star = cfg.rarity >= 5;
  const has4Wep = !!cfg.weapon4Star;
  const has5Wep = !!cfg.weapon5Star;
  const sc = cfg.startConstellation;
  const sr = cfg.startRefinement; // 0 = no 5★ weapon, 1-5 = current refinement
  const owns5Star = sr > 0 && has5Wep;
  const states: BreakpointState[] = [];

  // Standard constellation breakpoints: {0, 1, 2, 6} filtered by startConstellation
  const CONS_BREAKPOINTS = [0, 1, 2, 6];

  if (is5Star) {
    const consBPs = CONS_BREAKPOINTS.filter((c) => c >= sc);

    if (!owns5Star && has4Wep) {
      // 4★ weapon path: all constellation breakpoints with 4★ weapon
      const w4 = cfg.weapon4Star!.id;
      const r4 = cfg.weapon4Star!.refinement;
      for (const c of consBPs) {
        states.push({
          constellation: c,
          weaponId: w4,
          refinement: r4,
          is5StarWeapon: false,
        });
      }
    }

    if (has5Wep) {
      const w5 = cfg.weapon5Star!.id;
      // 5★ weapon R1 path (or startRefinement if already owned)
      const baseR = owns5Star ? sr : 1;
      for (const c of consBPs) {
        states.push({
          constellation: c,
          weaponId: w5,
          refinement: baseR,
          is5StarWeapon: true,
        });
      }
      // C6R5 final breakpoint (skip if already at R5)
      if (baseR < 5) {
        states.push({
          constellation: 6,
          weaponId: w5,
          refinement: 5,
          is5StarWeapon: true,
        });
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
    if (has5Wep) {
      const w5 = cfg.weapon5Star!.id;
      const baseR = owns5Star ? sr : 1;
      states.push({
        constellation: sc,
        weaponId: w5,
        refinement: baseR,
        is5StarWeapon: true,
      });
      if (baseR < 5) {
        states.push({
          constellation: sc,
          weaponId: w5,
          refinement: 5,
          is5StarWeapon: true,
        });
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

class InvestmentCache {
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
}

// ─── Per-char breakpoint options (for enumeration) ───

type CharOption = { inv: CharInvestment; perCharM: number };

function getCharOptions(
  cfg: InvestmentCharConfig,
  base: CharCompConfig
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

// ─── Artifact assembly + eval ───

type SnapshotCache = Record<string, Record<string, StatSheet>>;

function assembleSheets(
  allocation: TeamInvestment,
  configs: InvestmentCharConfig[],
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

function evalWithCachedArtifacts(
  allocation: TeamInvestment,
  sheets: Record<string, StatSheet>,
  baseConfigs: CharCompConfig[],
  combatOpts: CombatOpts,
  enemyElementAura: Element | undefined,
  combo: ComboFormula,
  calcContext: CalcContext,
  reactionOverrides?: Record<string, ReactionOverride>
): number {
  try {
    const configs = baseConfigs.map((bc) => {
      const inv = allocation[bc.charId];
      return inv ? investmentToConfig(inv, bc) : bc;
    });
    const tb = new TeamBuild(configs, combatOpts, enemyElementAura);
    return evaluateCombo(tb, combo, sheets, calcContext, reactionOverrides)
      .totalDamage;
  } catch {
    return 0;
  }
}

/** Evaluate an allocation, using the global cache to avoid redundant computation. */
function evalAndCache(
  allocation: TeamInvestment,
  cache: InvestmentCache,
  configs: InvestmentCharConfig[],
  snapshotCache: SnapshotCache,
  baseConfigs: CharCompConfig[],
  combatOpts: CombatOpts,
  enemyAura: Element | undefined,
  combo: ComboFormula,
  calcContext: CalcContext,
  reactionOverrides?: Record<string, ReactionOverride>
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
    reactionOverrides
  );
  const jin = computeM(allocation, configs);
  const node: CachedNode = { id, jin, allocation: { ...allocation }, damage };
  cache.add(node);
  return node;
}

// ─── Ideal Gen ───

async function runIdealGen(
  allocation: TeamInvestment,
  baseConfigs: CharCompConfig[],
  combatOpts: CombatOpts,
  enemyElementAura: Element | undefined,
  combo: ComboFormula,
  calcContext: CalcContext,
  reactionOverrides?: Record<string, ReactionOverride>,
  perChar?: Record<string, { minEr: number; minCr: number }>
): Promise<{ damage: number; sheetsByChar: Record<string, StatSheet> }> {
  const configs = baseConfigs.map((bc) => {
    const inv = allocation[bc.charId];
    return inv ? investmentToConfig(inv, bc) : bc;
  });
  const teamBuild = new TeamBuild(configs, combatOpts, enemyElementAura);
  const carryCharId =
    combo.lines.find((l) => l.count > 0)?.charId ?? configs[0].charId;

  let finalResult: IdealGenResult | null = null;
  for await (const result of runIdealArtifactGen({
    teamBuild,
    carryCharId,
    formulaId: "",
    calcContext,
    combo: { ...combo, lines: combo.lines.filter((l) => l.count > 0) },
    reactionOverrides,
    rollMultiplier: calcContext.rollMultiplier,
    idealSubstatBudget: IDEAL_SUBSTAT_BUDGET_DEFAULT_PRESET,
    perChar,
  })) {
    finalResult = result;
  }

  return {
    damage: finalResult?.damage ?? 0,
    sheetsByChar: finalResult?.sheetsByChar ?? {},
  };
}

// ─── Phase 1: Tier snapshot generation ───

async function computePhase1(
  opts: InvestmentOptions,
  onProgress: (p: InvestmentProgress) => void
): Promise<SnapshotCache> {
  const {
    configs,
    baseConfigs,
    teamBuild,
    combo,
    calcContext,
    reactionOverrides,
    perChar,
  } = opts;
  const combatOpts = teamBuild.combatOpts;
  const enemyAura = teamBuild.enemyElementAura;

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

    onProgress({
      phase: "phase1",
      phaseProgress: i / relevantSnapshots.length,
      overallProgress: (i / relevantSnapshots.length) * 0.6,
      message: `Generating artifacts for ${snapshot.id} (${i + 1}/${relevantSnapshots.length})...`,
    });

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

    const result = await runIdealGen(
      allocation,
      baseConfigs,
      combatOpts,
      enemyAura,
      combo,
      calcContext,
      reactionOverrides,
      perChar
    );

    snapshotCache[snapshot.id] = result.sheetsByChar;
    await new Promise((r) => setTimeout(r, 0));
  }

  onProgress({
    phase: "phase1",
    phaseProgress: 1,
    overallProgress: 0.6,
    message: "Artifact generation complete",
  });
  return snapshotCache;
}

// ─── Phase 2: Exhaustive breakpoint combination evaluation ───

function computePhase2(
  opts: InvestmentOptions,
  snapshotCache: SnapshotCache,
  cache: InvestmentCache,
  onProgress: (p: InvestmentProgress) => void
): void {
  const {
    configs,
    baseConfigs,
    teamBuild,
    combo,
    calcContext,
    reactionOverrides,
  } = opts;
  const combatOpts = teamBuild.combatOpts;
  const enemyAura = teamBuild.enemyElementAura;
  const activeCombo = {
    ...combo,
    lines: combo.lines.filter((l) => l.count > 0),
  };

  const charOpts = configs.map((cfg, i) => ({
    charId: cfg.charId,
    options: getCharOptions(cfg, baseConfigs[i]),
  }));

  const totalCombos = charOpts.reduce((acc, co) => acc * co.options.length, 1);
  let count = 0;

  onProgress({
    phase: "phase2",
    phaseProgress: 0,
    overallProgress: 0.6,
    message: `Evaluating ${totalCombos} breakpoint combinations...`,
  });

  function enumerate(ci: number, alloc: TeamInvestment, totalM: number) {
    if (ci >= charOpts.length) {
      const id = allocationNodeId(alloc);
      if (!cache.has(id)) {
        const sheets = assembleSheets(alloc, configs, snapshotCache);
        const damage = evalWithCachedArtifacts(
          alloc,
          sheets,
          baseConfigs,
          combatOpts,
          enemyAura,
          activeCombo,
          calcContext,
          reactionOverrides
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

  enumerate(0, {}, 0);

  onProgress({
    phase: "phase2",
    phaseProgress: 1,
    overallProgress: 0.8,
    message: `Evaluated ${count} combinations, ${cache.bestAtJin.size} M-tiers found`,
  });
}

// ─── Phase 3: BFS expansion from best-at-M seeds ───

function computePhase3(
  cache: InvestmentCache,
  snapshotCache: SnapshotCache,
  opts: InvestmentOptions,
  onProgress: (p: InvestmentProgress) => void
): InvestmentEdge[] {
  const {
    configs,
    baseConfigs,
    teamBuild,
    combo,
    calcContext,
    reactionOverrides,
  } = opts;
  const combatOpts = teamBuild.combatOpts;
  const enemyAura = teamBuild.enemyElementAura;
  const activeCombo = {
    ...combo,
    lines: combo.lines.filter((l) => l.count > 0),
  };

  const edges: InvestmentEdge[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  // Seed with all best-at-M nodes
  for (const node of cache.bestAtJin.values()) {
    queue.push(node.id);
  }

  onProgress({
    phase: "phase3",
    phaseProgress: 0,
    overallProgress: 0.8,
    message: `BFS from ${queue.length} seeds...`,
  });

  let expanded = 0;

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = cache.get(nodeId)!;
    const upgrades = getSingleStepUpgrades(node.allocation, configs);

    // Eval all +1M neighbors (cached automatically)
    const neighbors: { cached: CachedNode; charId: string; upgrade: string }[] =
      [];
    for (const up of upgrades) {
      const cached = evalAndCache(
        up.allocation,
        cache,
        configs,
        snapshotCache,
        baseConfigs,
        combatOpts,
        enemyAura,
        activeCombo,
        calcContext,
        reactionOverrides
      );
      neighbors.push({ cached, charId: up.charId, upgrade: up.upgrade });
    }

    // Pick best unvisited neighbor
    let best: (typeof neighbors)[0] | null = null;
    for (const n of neighbors) {
      if (visited.has(n.cached.id)) continue;
      if (!best || n.cached.damage > best.cached.damage) best = n;
    }

    if (best) {
      edges.push({
        fromId: nodeId,
        toId: best.cached.id,
        charId: best.charId,
        upgrade: best.upgrade,
        marginalDamage: best.cached.damage - node.damage,
      });
      queue.push(best.cached.id);
    }

    expanded++;
  }

  onProgress({
    phase: "phase3",
    phaseProgress: 1,
    overallProgress: 0.95,
    message: `BFS expanded ${expanded} nodes, ${cache.size} total cached`,
  });
  return edges;
}

// ─── +1M step generation ───

function getSingleStepUpgrades(
  alloc: TeamInvestment,
  cfgs: InvestmentCharConfig[]
): { allocation: TeamInvestment; charId: string; upgrade: string }[] {
  const ups: { allocation: TeamInvestment; charId: string; upgrade: string }[] =
    [];
  for (const cfg of cfgs) {
    const inv = alloc[cfg.charId];
    if (!inv) continue;
    if (cfg.rarity >= 5 && inv.constellation < 6) {
      const nc = inv.constellation + 1;
      ups.push({
        allocation: { ...alloc, [cfg.charId]: { ...inv, constellation: nc } },
        charId: cfg.charId,
        upgrade: `C${inv.constellation}→C${nc}`,
      });
    }
    if (inv.is5StarWeapon && inv.refinement < 5) {
      const nr = inv.refinement + 1;
      ups.push({
        allocation: { ...alloc, [cfg.charId]: { ...inv, refinement: nr } },
        charId: cfg.charId,
        upgrade: `R${inv.refinement}→R${nr}`,
      });
    }
    if (!inv.is5StarWeapon && cfg.weapon5Star) {
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

export function deriveSequence(dag: InvestmentDAG): {
  sequence: InvestmentStep[];
  bestAtTier: Map<number, InvestmentNode>;
} {
  const bestAtTier = new Map<number, InvestmentNode>();
  for (const n of dag.nodes) {
    const ex = bestAtTier.get(n.jin);
    if (!ex || n.damage > ex.damage) bestAtTier.set(n.jin, n);
  }

  const seq: InvestmentStep[] = [];
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

export async function* runInvestmentAnalysis(
  opts: InvestmentOptions
): AsyncGenerator<InvestmentProgress | InvestmentResult> {
  const q: InvestmentProgress[] = [];
  const emit = (p: InvestmentProgress) => {
    q.push(p);
  };
  const flush = function* () {
    for (const p of q) yield p;
    q.length = 0;
  };

  // Phase 1: Generate tier snapshots
  const snapshotCache = await computePhase1(opts, emit);
  yield* flush();

  // Global damage cache
  const cache = new InvestmentCache();

  // Phase 2: Exhaustive breakpoint combination evaluation
  computePhase2(opts, snapshotCache, cache, emit);
  yield* flush();

  // Phase 3: BFS expansion from best-at-M seeds
  const edges = computePhase3(cache, snapshotCache, opts, emit);
  yield* flush();

  // Build DAG from cache + edges
  const nodes: InvestmentNode[] = [];
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
  const dag: InvestmentDAG = {
    nodes,
    edges,
    baselineJin: jinValues.length > 0 ? Math.min(...jinValues) : 0,
    maxJin: jinValues.length > 0 ? Math.max(...jinValues) : 0,
  };

  const { sequence, bestAtTier } = deriveSequence(dag);

  yield {
    phase: "done" as const,
    phaseProgress: 1,
    overallProgress: 1,
    message: "Done",
  };
  yield { dag, bestAtTier, sequence } satisfies InvestmentResult;
}

export function isInvestmentResult(
  v: InvestmentProgress | InvestmentResult
): v is InvestmentResult {
  return "dag" in v;
}
