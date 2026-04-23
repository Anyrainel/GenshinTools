import type {
  Element,
  MainStat,
  ReactionType,
  Slot,
  SubStat,
} from "@/data/enums";
import type { ArtifactData, ArtifactSetConfig } from "@/data/types";
import type { BuildMatchResult } from "@/lib/artifact/scoring/artifactScore";
import type { ERTimeline } from "@/lib/ercalc/types";
import type { StatSheet } from "../dmgcalc/core/statSheet";
import type { TeamBuild } from "../dmgcalc/core/teamBuild";
import type {
  CalcContext,
  ComboFormula,
  DamageResult,
  ExtraBuff,
  OptionMap,
  ReactionOverride,
  TalentLevels,
} from "../dmgcalc/types";
import type {
  ComboCountOverrides,
  MinErOverrides,
  StoredAnalyzerCharConfig,
} from "./analyzer/types";

// ─── Optimizer Types (shared across V1, V2, Mona, benchmark) ───

export type OptFailReason =
  | { kind: "empty-pool"; emptySlots: Slot[] }
  | { kind: "no-seeds"; artifactSet?: ArtifactSetConfig | null }
  | { kind: "er-unmet"; minEr: number; bestEr: number }
  | { kind: "cr-unmet"; minCr: number; bestCr: number }
  | {
      kind: "set-impossible";
      artifactSet?: ArtifactSetConfig | null;
      slotCounts: Record<string, number>;
    }
  | { kind: "all-filtered"; combinationsTotal: number }
  | { kind: "timeout" }
  | { kind: "worker-error"; message: string };

export type TeamOptPassId = "carry-1" | "support" | "carry-2";

export interface TeamOptPassResult {
  passId: TeamOptPassId;
  charId: string;
  bestDamage: number;
  bestArtifacts: Record<Slot, ArtifactData | null>;
  failReason?: OptFailReason;
  /** Per-substat weights used for artifact ranking (debug display). */
  substatWeights?: Record<string, number>;
}

export type OptPhase = "init" | "phase1" | "phase2" | "phase3";

export interface TeamOptimizationProgress {
  currentPass: TeamOptPassId;
  currentPassCharId: string;
  passIndex: number;
  totalPasses: number;
  passPhase: "pruning" | "evaluating";
  passProgress: number;
  overallProgress: number;
  /** Current optimizer phase for display. */
  phase: OptPhase;
  passResults: TeamOptPassResult[];
  /** Live per-character best damage from in-progress Phase 1 workers. */
  workerBestDamage?: Record<string, number>;
  done: false;
}

interface TeamOptResultBase {
  bestDamage: number;
  bestArtifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  passResults: TeamOptPassResult[];
  failReasons: Record<string, OptFailReason>;
  teamBuild?: TeamBuild;
  done: true;
}

export type TeamOptimizationResult = TeamOptResultBase;

export type TeamOptYield = TeamOptimizationProgress | TeamOptimizationResult;

export interface CharOptConfig {
  minEr: number;
  minCr: number;
  buildMatch?: BuildMatchResult | null;
  artifactSet?: ArtifactSetConfig | null;
}

export interface TeamOptimizerOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  combo: ComboFormula;
  inventory: ArtifactData[];
  calcContext: CalcContext;
  baseSheets: Record<string, StatSheet>;
  perChar: Record<string, CharOptConfig>;
  ignoreArtifactSets?: Record<string, boolean>;
  perCharDeadlineMs?: number;
  teamDeadlineMs?: number;
  maxArtsPerSlot?: number;
  /** Extra artifacts available only to specific characters (e.g. same-char frozen reuse) */
  perCharExtraArtifacts?: Record<string, ArtifactData[]>;
  /** Artifact IDs to exclude from the pool per character (e.g. tier-aware exclusion) */
  perCharExcludedArtifactIds?: Record<string, string[]>;
  /** Enable Lagrangian relaxation for shared-set artifact allocation (Phase 2.5). */
  useLagrangianAlloc?: boolean;
}

// ─── Team state shape ──────────────────────────────────────────────

// These describe the persisted / in-memory team state. The Zustand
// store in src/stores/useTeamStore.ts holds instances of these, and
// pure team logic across src/lib/ reads them as inputs.
export interface OptimizationResult {
  artifacts: Record<string, ArtifactData>;
  damage: DamageResult;
  erTargets: Record<string, number>;
}

export interface WeaponRanking {
  weaponId: string;
  refinement: number;
  damage: number;
  percentOfBest: number; // 0-100
  /** Main stat choices for sands/goblet/circlet. */
  mainStats?: { sands: MainStat; goblet: MainStat; circlet: MainStat };
  /** Aggregated substat roll counts across all 5 artifact slots. */
  substatRolls?: Partial<Record<SubStat, number>>;
  /** Artifact set IDs used (first set from flower). */
  artifactSetIds?: string[];
}

export interface WeaponChoiceResult {
  timestamp: number;
  perCharacter: Record<string, WeaponRanking[]>;
}

export interface WeaponChoiceCharConfig {
  charId: string;
  level: number;
  constellation: number;
  talentLevels: [number, number, number];
  artifactConfig: ArtifactSetConfig | null;
  minEr: number;
  minCr: number;
}

/** Per-character optimizer/generator settings, keyed by charId. */
export interface CharSettings {
  minEr?: number;
  minCr?: number;
  crMode?: "min" | "target";
  tierAwarePool?: boolean;
  ignoreArtifactSets?: boolean;
}

/** Analyzer-specific configuration, grouped under team.analyzer. */
export interface AnalyzerConfig {
  configs?: StoredAnalyzerCharConfig[];
  comboOverrides?: ComboCountOverrides;
  minErOverrides?: MinErOverrides;
  reactionOverrides?: Record<string, ReactionOverride>;
  enemyAura?: Element;
  extraBuffs?: ExtraBuff[];
}

export interface Team {
  id: string;
  name: string;
  // ─── Composition ───
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
  reactions: ReactionType[];
  opts: OptionMap;
  // ─── Shared config ───
  calcContext: Partial<CalcContext>;
  enemyAura?: Element;
  extraBuffs?: ExtraBuff[];
  // ─── Formula / combo ───
  selectedFormula: { charId: string; formulaId: string } | null;
  singleReaction?: ReactionOverride;
  singleForceOnField?: boolean;
  formulaMode: "single" | "combo";
  combo: ComboFormula | null;
  // ─── Per-character settings ───
  charSettings?: Record<string, CharSettings>;
  // ─── ER calculator ───
  erTimelines?: ERTimeline[];
  // ─── Result caches ───
  optimizationResult: OptimizationResult | null;
  weaponChoiceResult?: WeaponChoiceResult | null;
  // ─── Analyzer ───
  analyzer?: AnalyzerConfig;
}

/** Exported artifact — discriminator omitted since field names differ. */
export type ExportedArtifact =
  | { setId: string }
  | { halfSetIds: [string, string] };

/** Exported team shape — only composition metadata, no user/account state. */
export interface ExportedTeam {
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ExportedArtifact | null)[];
  reactions?: ReactionType[];
  minEr?: Record<string, number>;
  minCr?: Record<string, number>;
}

/** Importable/exportable team composition envelope. */
export interface TeamCompData {
  teams: ExportedTeam[];
  author?: string;
  description?: string;
}
export interface CharBaseConfig {
  charLevel: number;
  constellation: number;
  acctTalent: TalentLevels | undefined;
}
