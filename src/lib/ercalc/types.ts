import type { Element } from "@/data/types";

// ─── Team model ───

/** A character in the team. Describes who they are, not what they do. */
export interface TeamMember {
  id: string;
  element: string;
  burstCost: number;
  constellation?: number; // 0-6
  weaponId?: string;
  refinement?: number; // 0-4 for R1-R5
  artifactSetId?: string; // 4pc artifact set ID
  weaponType?: string; // for Scholar 4pc check
}

/** Slot in the team UI: character + equipment context. */
export type TeamSlot = {
  charId: string;
  element: Element;
  burstCost: number;
  constellation: number;
  weaponId?: string;
  refinement?: number; // 0-4 for R1-R5
};

// ─── Action model ───

/**
 * Action types for the timeline.
 *
 * - `E`         — Skill press. Produces particles for simple/multi-hit-instant chars.
 * - `holdE`     — Skill hold. Uses hold particle data when available.
 * - `periodicE` — One proc of a periodic generator (Guoba hit, Oz attack, etc).
 *                 Unlike E, the producing char is off-field. Particles go to whoever
 *                 is currently on-field, determined by the most recent swap action.
 * - `Q`         — Burst. Drains energy to 0, triggers burst-related effects.
 * - `specialQ`  — Special burst. Same as Q for ER purposes.
 * - `NA`/`CA`/`PA` — Attacks. No particle generation (keeps char on-field).
 * - `wait`      — Stay on-field to catch incoming particles.
 */
export type ActionType =
  | "E"
  | "holdE"
  | "periodicE"
  | "Q"
  | "specialQ"
  | "NA"
  | "CA"
  | "PA"
  | "wait";

/** A single action in the rotation timeline. */
export interface TimelineAction {
  /** Character performing this action. */
  char: string;
  /** Action type. */
  action: ActionType;
}

/** An ordered sequence of actions forming one rotation. */
export type Timeline = TimelineAction[];

// ─── Tick model (UI) ───

/** A periodic tick assignment: one proc from a source char attached to a main action. */
export interface TickAssignment {
  /** Character producing the periodic particles (e.g. "fischl"). */
  sourceChar: string;
  /** Index into the main actions array that absorbs this tick. */
  targetIndex: number;
}

/**
 * Timeline with ticks separated from main actions.
 * The UI uses this model; it's flattened to a legacy Timeline before simulation.
 */
export interface ERTimeline {
  /** Main actions only — no periodicE entries. */
  actions: TimelineAction[];
  /** Periodic tick assignments. One tick per source per target index. */
  ticks: TickAssignment[];
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
  /** Clear particles from enemy HP drops (total for the rotation). */
  enemyParticles?: number;
  /** How to treat fractional particle data. Default: "expected". */
  particleMode?: ParticleMode;
  /** Calculation mode. Default: "full-energy-repeat". */
  calcMode?: CalcMode;
  /** Repeating timeline (循环轴). When provided, the main timeline is the startup (启动轴). */
  timeline2?: Timeline;
}

// ─── Results ───

/** Per-action energy event for the breakdown visualization. */
export interface EnergyEvent {
  /** Index of the action in the timeline that produced this energy. */
  sourceIndex: number;
  /** Character that produced the particles/energy. */
  sourceChar: string;
  /** Action type that produced the energy. */
  sourceAction: ActionType;
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
}
