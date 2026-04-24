import type { Element } from "@/data/enums";
import type { ArtifactSetConfig } from "@/data/types";

// ─── Team model ───

/** A character in the team. Describes who they are, not what they do. */
export interface TeamMember {
  id: string;
  element: string;
  burstCost: number;
  constellation?: number; // 0-6
  weaponId?: string;
  refinement?: number; // 0-4 for R1-R5
  artifactSet?: ArtifactSetConfig | null;
  weaponType?: string; // for Scholar 4pc check
  /** [auto, skill, burst] talent levels, 1-based (matches Genshin in-game). */
  talentLevels?: [number, number, number];
  /** Whether this character can trigger healing (for "heal"-triggered
   *  weapons like Dialogues of the Desert Sages). Approximation:
   *  `charInfo.healerC <= constellation`. */
  isHealer?: boolean;
  /** Whether this character can trigger an elemental reaction with the
   *  current team (for "reaction"-triggered weapons). Approximation:
   *  team has ≥2 reactive elements and this char's element is one of
   *  them. Decided by the caller; engine reads this flag only. */
  canTriggerReaction?: boolean;
}

/** Slot in the team UI: character + equipment context. */
export type TeamSlot = {
  charId: string;
  element: Element;
  burstCost: number;
  constellation: number;
  weaponId?: string;
  refinement?: number; // 0-4 for R1-R5
  /** [auto, skill, burst] talent levels, 1-based. */
  talentLevels?: [number, number, number];
  isHealer?: boolean;
  canTriggerReaction?: boolean;
};

// ─── Action model ───

/**
 * Action types for the timeline.
 *
 * - `E`         — Skill press. Direct particle emission from skill data.
 * - `holdE`     — Skill hold. Falls back to `E` data if `holdE` is absent.
 * - `specialE`  — Enhanced/alternative skill variant (Cyno burst-mode E,
 *                 Freminet L4, Ayato stance, etc.). User-interwoven at runtime.
 * - `Q`         — Elemental burst. Drains energy; rarely produces particles.
 * - `specialQ`  — Alternative burst variant (Flins, Varesa). Different drain cost.
 * - `NA`/`CA`/`PA` — Attacks. Produce particles on infusion chars via a
 *                   per-hit cycling pattern.
 * - `wait`      — Stay on-field to catch incoming particles.
 *
 * Particles from summon / coordinated-attack / periodic mechanics are NOT
 * actions — they are `PeriodicProc` events attached to main actions.
 */
export type ActionType =
  | "E"
  | "holdE"
  | "specialE"
  | "Q"
  | "specialQ"
  | "NA"
  | "CA"
  | "PA"
  | "wait"
  /** Generic user-controlled flat-energy grant. Fires at the moment this
   *  node is reached. Grants are stored on `TimelineAction.energyGrants`. */
  | "grantEnergy";

/** A single action in the rotation timeline (main track). */
export interface TimelineAction {
  /** Character performing this action. For `grantEnergy` nodes `char` is
   *  just a positioning anchor (usually the on-field char at that moment);
   *  the actual grants live in `energyGrants`. */
  char: string;
  /** Action type. */
  action: ActionType;
  /** Whether a Favonius particle proc fires at this node. Default false; auto-toggled
   *  by the UI for the first N E/Q actions of a Favonius wielder (N from refinement). */
  favoniusProc?: boolean;
  /** Flat energy to grant at this node, keyed by recipient charId (team slot id).
   *  Only read when `action === "grantEnergy"`. */
  energyGrants?: Record<string, number>;
}

/** An ordered sequence of main actions. */
export type Timeline = TimelineAction[];

// ─── Periodic event model (background particles) ───

/**
 * A periodic particle proc — a single tick from a source character's summon,
 * coordinated attack, or other off-field generator. Attached to a main
 * action's index; the character performing that action absorbs the particles.
 */
export interface PeriodicProc {
  /** Character producing the particles (e.g. "fischl"). */
  sourceChar: string;
  /** Which trigger action spawned this proc (E or Q). */
  trigger: "E" | "Q";
  /** Index into `ERTimeline.actions` that absorbs this proc. */
  targetIndex: number;
}

/** Timeline with main actions and background periodic procs separated. */
export interface ERTimeline {
  /** Main actions only. */
  actions: TimelineAction[];
  /** Background periodic procs. One entry per (source, target-index) pair. */
  periodic: PeriodicProc[];
}

// ─── Particle data schema (v2) ───

/**
 * Particle count as a list of independent rolls. Each entry is `[count, chance]`.
 * Integer shorthand `N` is equivalent to `[[N, 1.0]]`.
 *
 * Derived values:
 *   min      = Σ count where chance == 1.0
 *   max      = Σ count
 *   expected = Σ count × chance
 */
export type Particles = number | Array<[count: number, chance: number]>;

export interface ActionParticleConfig {
  particles: Particles;
  notes?: string;
}

export interface HitPatternConfig {
  /** Cyclic pattern indexed by the char's i-th hit of this action type. */
  pattern: Particles[];
  notes?: string;
}

export interface PeriodicConfig {
  /** Default number of procs to auto-place in the UI. User-adjustable. */
  procs: number;
  /** Particle emission shape per individual proc. */
  particles: Particles;
  notes?: string;
}

/** One character's entry in particles.json. */
export interface ParticleEntry {
  element: string;
  source?: "fandom" | "gcsim" | "lunaris" | "manual";
  spawnPoint?: "Character" | "Enemy" | "Construct";
  E?: ActionParticleConfig;
  holdE?: ActionParticleConfig;
  specialE?: ActionParticleConfig;
  NA?: HitPatternConfig;
  CA?: HitPatternConfig;
  PA?: HitPatternConfig;
  periodic?: {
    E?: PeriodicConfig;
    Q?: PeriodicConfig;
  };
  _unmodeled?: string[];
}

// ─── Calc options ───

/** Particle RNG treatment. */
export type ParticleMode = "min" | "expected" | "max";

/**
 * Calculation mode.
 * - `zero-energy-start`  — Can I burst starting from 0 energy?
 * - `full-energy-repeat` — Can I sustain bursting forever (start full)?
 * - `zero-energy-repeat` — Can I start from 0 AND sustain forever?
 */
export type CalcMode =
  | "zero-energy-start"
  | "full-energy-repeat"
  | "zero-energy-repeat";

export interface EROptions {
  /** How to treat fractional particle data. Default: "expected". */
  particleMode?: ParticleMode;
  /** Calculation mode. Default: "full-energy-repeat". */
  calcMode?: CalcMode;
  /** Repeating timeline (循环轴). When provided, the main timeline is the startup (启动轴). */
  timeline2?: ERTimeline;
}

// ─── Results ───

/** Per-action energy event for the breakdown visualization. */
export interface EnergyEvent {
  /** Index of the action in the timeline that produced this energy. */
  sourceIndex: number;
  /** Character that produced the particles/energy. */
  sourceChar: string;
  /** Action type that produced the energy, or "periodic" for periodic procs,
   *  or "favonius" for Favonius weapon procs. */
  sourceAction: ActionType | "periodic" | "favonius";
  /** Character that absorbed the particles on-field. */
  absorberChar: string;
  /** Particle count (before element/field multipliers). */
  particleCount: number;
  /** Element of the particles. */
  particleElement: string;
  /** Energy received by a specific character at 100% ER. */
  energyAt100: number;
  /** Whether this character was on-field when absorbing. */
  onField: boolean;
  /** Type: 'particle' for ER-scaling energy, 'flat' for fixed energy. */
  type: "particle" | "flat";
}

export interface ERResult {
  characterId: string;
  /** ER% needed (100 = base, 200 = double). Infinity if impossible. */
  erNeeded: number;
  energyBreakdown: {
    /** Energy from all particle sources at 100% ER. Scales with ER%. */
    particleEnergy: number;
    /** Energy from flat sources. Not affected by ER%. */
    flatEnergy: number;
  };
  /** Per-action energy events for the binding Q window (the one that determines ER). */
  bindingEvents?: EnergyEvent[];
  /** Index of the Q action in the timeline that determines the ER requirement. */
  bindingQIndex?: number;
  /** For "zero-energy-repeat" mode: which sub-mode is the binding constraint. */
  bindingMode?: "zero-energy-start" | "full-energy-repeat";
  /** Whether this character has a Q in the timeline. If false, ER is hypothetical. */
  hasQ: boolean;
}

// ─── Hints ───

export interface RotationHint {
  type: "warning" | "info";
  messageEn: string;
  messageZh: string;
  /** Character ID referenced in the hint (for UI to translate). */
  charId?: string;
  /** Index of the action that triggered this hint. */
  actionIndex?: number;
} // ─── Self-energy data ───

export interface SelfEnergyEntry {
  source: string;
  action: string;
  amount?: number;
  percentRefund?: number;
  target: string;
  minC: number;
  procs?: number;
  erScale?: { per100: number; max?: number };
  param?: { source: string; index: number; multiplier: number };
  [key: string]: unknown;
}

export type SelfEnergyMap = Record<string, SelfEnergyEntry[]>;
