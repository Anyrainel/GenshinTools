import type { Rarity } from "@/data/types";
import type { TeamBuild } from "../calc/teamBuild";
import type { SubstatBudgetPreset } from "../generator/substatBudget";
import type { CalcContext, ComboFormula, TeamSlotConfig } from "../types";

// ─── Types ───

export type CharInvestment = {
  constellation: number; // 0-6
  weaponId: string;
  refinement: number; // 1-5
  is5StarWeapon: boolean;
};

export type TeamInvestment = Record<string, CharInvestment>;

export type AnalyzerCharConfig = {
  charId: string;
  rarity: Rarity;
  weapon4Star?: { id: string; refinement: number };
  weapon5Star?: { id: string };
  startConstellation: number;
  startRefinement: number; // 0 = no 5★ weapon yet, 1-5 = current 5★ refinement
  maxConstellation: number; // upper bound for constellation (default 6)
  maxRefinement: number; // upper bound for refinement (default 5), 0 = no 5★ weapon
};
/** Persisted form — stores only the alt weapon (not from roster). */

export type StoredAnalyzerCharConfig = {
  charId: string;
  /** Weapon not from the team roster. 3/4★ alt includes refinement; 5★ alt does not. */
  altWeapon?: { id: string; refinement?: number };
  startConstellation: number;
  startRefinement: number;
  maxConstellation: number;
  maxRefinement: number;
};

export type AnalyzerNode = {
  id: string;
  jin: number;
  allocation: TeamInvestment;
  damage: number;
  validated: boolean;
  isBreakpoint: boolean;
};

export type AnalyzerEdge = {
  fromId: string;
  toId: string;
  charId: string;
  upgrade: string;
  marginalDamage: number;
};

export type AnalyzerDAG = {
  nodes: AnalyzerNode[];
  edges: AnalyzerEdge[];
  baselineJin: number;
  maxJin: number;
};

export type AnalyzerStep = {
  jin: number;
  allocation: TeamInvestment;
  damage: number;
  gainVsBaseline: number;
  gainVsBaselinePct: number;
  gainVsPrev: number;
  gainVsPrevPct: number;
};

export type CachedNodeRef = {
  id: string;
  allocation: TeamInvestment;
  damage: number;
};

export type AnalyzerResult = {
  dag: AnalyzerDAG;
  bestAtTier: Map<number, AnalyzerNode>;
  sequence: AnalyzerStep[];
  nodesByJin: Map<number, CachedNodeRef[]>;
};

export type AnalyzerPhase = "phase1" | "phase2" | "phase3" | "done";

export type AnalyzerProgress = {
  phase: AnalyzerPhase;
  phaseProgress: number;
  overallProgress: number;
  message: string;
}; /** Flat sparse overrides for combo counts. Key = `charId|constellation|lineKey`. */

export type ComboCountOverrides = Record<string, number>;
/** Flat sparse overrides for minEr. Key = `charId|constellation`. Value = internal format (e.g. 1.6 = 160%). */

export type MinErOverrides = Record<string, number>;
export type AnalyzerOptions = {
  configs: AnalyzerCharConfig[];
  baseConfigs: TeamSlotConfig[];
  teamBuild: TeamBuild;
  /** Template combo — provides reaction config + line ordering + formulaId set */
  templateCombo: ComboFormula;
  /** Per-(charId, constellation) combo count overrides */
  comboOverrides?: ComboCountOverrides;
  /** Base per-char constraints (from team store) */
  perChar?: Record<string, { minEr: number; minCr: number }>;
  /** Per-(charId, constellation) minEr overrides */
  minErOverrides?: MinErOverrides;
  // Optional overrides for calc settings (defaults to hardcoded analyzer constants)
  calcContext?: CalcContext;
  rollMultiplier?: number;
  substatBudget?: SubstatBudgetPreset;
};
// ─── Tier Snapshot IDs ───
export type TierSnapshot = {
  id: string;
  constellation: number;
  is5StarWeapon: boolean;
  refinement: number;
};
export type BreakpointState = {
  constellation: number;
  weaponId: string;
  refinement: number;
  is5StarWeapon: boolean;
};
