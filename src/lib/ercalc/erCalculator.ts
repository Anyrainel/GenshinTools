import { artifactEnergyById } from "@/data/ercalc/artifactEnergy";
import {
  CLEAR_PARTICLE,
  DIFF_ELEMENT_PARTICLE,
  OFF_FIELD_MULTIPLIER,
  SAME_ELEMENT_PARTICLE,
} from "@/data/ercalc/constants";
import {
  multiHitETotal,
  periodicGenerators,
} from "@/data/ercalc/particleConfig";
import particlesData from "@/data/ercalc/particles.json";
import { weaponEnergyById } from "@/data/ercalc/weaponEnergy";

import allSelfEnergyData from "@/data/ercalc/selfEnergy.json";

// ─── Public types ───

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

const PARTICLE_ACTIONS = new Set<ActionType>(["E", "holdE", "periodicE"]);
const BURST_ACTIONS = new Set<ActionType>(["Q", "specialQ"]);

/** A single action in the rotation timeline. */
export interface TimelineAction {
  /** Character performing this action. */
  char: string;
  /** Action type. */
  action: ActionType;
}

/** An ordered sequence of actions forming one rotation. */
export type Timeline = TimelineAction[];

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

// ─── Self-energy data ───

interface SelfEnergyEntry {
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

type SelfEnergyMap = Record<string, SelfEnergyEntry[]>;

const allSelfEnergy = allSelfEnergyData as SelfEnergyMap;

// ─── Particle data ───

interface ParticleEntry {
  element: string;
  press: { avgParticles: number; notes: string | null } | null;
  hold: { avgParticles: number; notes: string | null } | null;
  spawnPoint: string | null;
}

const particles = particlesData as Record<string, ParticleEntry>;

// ─── Param defaults (talent level 10) ───

const PARAM_DEFAULTS: Record<string, number> = {
  "raiden_shogun:Q:17": 2.5,
  "dori:Q:4": 1.5,
  "durin:E:5": 3.0,
};

function resolveParamAmount(
  charId: string,
  param: { source: string; index: number; multiplier: number }
): number | null {
  const key = `${charId}:${param.source}:${param.index}`;
  const base = PARAM_DEFAULTS[key];
  if (base == null) return null;
  return base * param.multiplier;
}

// ─── Particle helpers ───

function elementMatchEnergy(
  receiverElement: string,
  particleElement: string
): number {
  if (particleElement === "Clear") return CLEAR_PARTICLE;
  return receiverElement === particleElement
    ? SAME_ELEMENT_PARTICLE
    : DIFF_ELEMENT_PARTICLE;
}

/** Apply RNG mode to a fractional particle average. */
function rngAdjust(avg: number, mode: ParticleMode): number {
  if (mode === "min") return Math.floor(avg);
  if (mode === "max") return Math.ceil(avg);
  return avg;
}

/**
 * Get particle count for a timeline action.
 * - periodicE → per-proc value from particles.json press data
 * - E on periodic chars → 0 (deployment only; use periodicE for procs)
 * - E on multi-hit-instant chars → corrected total from multiHitETotal
 * - E on simple chars → press.avgParticles
 * - holdE → hold data if available, else falls back to E logic
 */
function getActionParticles(
  charId: string,
  action: ActionType,
  mode: ParticleMode
): number {
  if (!PARTICLE_ACTIONS.has(action)) return 0;

  const data = particles[charId];
  if (!data) return 0;

  // periodicE: always uses raw per-proc press data
  if (action === "periodicE") {
    return rngAdjust(data.press?.avgParticles ?? 0, mode);
  }

  // Periodic deployers: E/holdE produces 0 (deployment only)
  if (periodicGenerators.has(charId)) return 0;

  // holdE: prefer hold data
  if (action === "holdE" && data.hold) {
    return rngAdjust(data.hold.avgParticles, mode);
  }

  // E (or holdE fallback): multi-hit override or press data
  if (multiHitETotal[charId] != null) {
    return rngAdjust(multiHitETotal[charId], mode);
  }
  return rngAdjust(data.press?.avgParticles ?? 0, mode);
}

function getParticleElement(charId: string): string {
  return particles[charId]?.element ?? "Clear";
}

// ─── Self-energy helpers ───

/**
 * Compute self-energy for a character from their own passives/constellations.
 * Returns { flat, erScaling } separately:
 * - flat: energy not affected by ER% (refunds, fixed amounts)
 * - erScaling: energy per 100% ER (treated as additional particle energy in solver)
 */
function computeSelfEnergy(
  charId: string,
  constellation: number,
  burstCost: number,
  /** Actions this character performs in the timeline. Self-energy only triggers if the action matches. */
  activeActions?: Set<string>
): { flat: number; erScaling: number } {
  const entries = allSelfEnergy[charId];
  if (!entries) return { flat: 0, erScaling: 0 };

  let flat = 0;
  let erScaling = 0;
  for (const entry of entries) {
    if (constellation < entry.minC) continue;
    if (entry.target !== "self" && entry.target !== "party") continue;

    // Skip self-energy from actions not in the timeline
    // entry.action "Q" → character must have Q; "E" → must have E; "A" → always active
    if (activeActions && entry.action !== "A") {
      const actionInTimeline =
        entry.action === "Q"
          ? activeActions.has("Q") || activeActions.has("specialQ")
          : entry.action === "E"
            ? activeActions.has("E") || activeActions.has("holdE")
            : activeActions.has(entry.action);
      if (!actionInTimeline) continue;
    }

    const procs = entry.procs ?? 1;

    // ER-scaling energy: treated as pseudo-particle energy in the solver.
    // Note: entry.erScale.max (cap) is not enforced in the solver — this is an
    // approximation that works well for typical ER ranges (<300%).
    if (entry.erScale) {
      erScaling += (entry.erScale.per100 ?? 0) * procs;
      continue;
    }

    if (entry.param) {
      const paramAmount = resolveParamAmount(charId, entry.param);
      if (paramAmount != null) flat += paramAmount * procs;
      continue;
    }
    if (entry.percentRefund != null) {
      flat += (burstCost * entry.percentRefund) / 100;
    } else if (entry.amount != null) {
      flat += entry.amount * procs;
    }
  }
  return { flat, erScaling };
}

/**
 * Compute party energy that a character gives to teammates.
 * Returns { flat, erScaling } — erScaling is energy per 100% ER of the SOURCE.
 */
function computePartyEnergy(
  sourceId: string,
  sourceConstellation: number,
  /** Actions the source character performs. Party energy only triggers if matched. */
  sourceActions?: Set<string>
): { flat: number; erScaling: number } {
  const entries = allSelfEnergy[sourceId];
  if (!entries) return { flat: 0, erScaling: 0 };

  let flat = 0;
  let erScaling = 0;
  for (const entry of entries) {
    if (sourceConstellation < entry.minC) continue;
    if (
      entry.target !== "party" &&
      entry.target !== "partyOthers" &&
      entry.target !== "active"
    )
      continue;

    // Skip party energy from actions not in the timeline
    if (sourceActions && entry.action !== "A") {
      const actionInTimeline =
        entry.action === "Q"
          ? sourceActions.has("Q") || sourceActions.has("specialQ")
          : entry.action === "E"
            ? sourceActions.has("E") || sourceActions.has("holdE")
            : sourceActions.has(entry.action);
      if (!actionInTimeline) continue;
    }

    const procs = entry.procs ?? 1;

    // ER-scaling party energy (e.g., Sara P2: 1.2 per 100% ER to party)
    if (entry.erScale) {
      erScaling += (entry.erScale.per100 ?? 0) * procs;
      continue;
    }

    if (entry.param) {
      const paramAmount = resolveParamAmount(sourceId, entry.param);
      if (paramAmount != null) flat += paramAmount * procs;
      continue;
    }
    if (entry.amount != null) {
      flat += entry.amount * procs;
    }
  }
  return { flat, erScaling };
}

// ─── Flat energy computation (global per rotation) ───

/**
 * Compute all non-particle energy for a character per rotation.
 * Returns { flat, erScaling }:
 * - flat: energy not affected by ER% (self-refunds, weapons, artifacts, party)
 * - erScaling: energy per 100% ER (ER-scaling passives like Sara P2, Dori P2)
 */
function computeRotationEnergy(
  member: TeamMember,
  team: TeamMember[],
  /** Actions each character performs in the timeline. Used for conditional energy triggers. */
  allCharActions?: Map<string, Set<string>>,
  /** Actions this specific character performs. */
  activeActions?: Set<string>
): { flat: number; erScaling: number } {
  const { id, constellation = 0, burstCost } = member;
  let flat = 0;
  let erScaling = 0;

  // Self-energy effects (conditional on having the triggering action in timeline)
  const self = computeSelfEnergy(id, constellation, burstCost, activeActions);
  flat += self.flat;
  erScaling += self.erScaling;

  // Party energy from teammates (conditional on source having the trigger action)
  for (const tm of team) {
    if (tm.id === id) continue;
    // Pass source's active actions for conditional filtering
    const sourceActions = allCharActions?.get(tm.id);
    const party = computePartyEnergy(
      tm.id,
      tm.constellation ?? 0,
      sourceActions
    );
    flat += party.flat;
    // Party ER-scaling uses SOURCE's ER, not receiver's.
    // For simplicity, we add it to receiver's erScaling — this is an approximation.
    erScaling += party.erScaling;
  }

  // Weapon flat energy (goes to wielder only, conditional on trigger action)
  for (const tm of team) {
    const we = tm.weaponId ? weaponEnergyById[tm.weaponId] : undefined;
    if (!we) continue;
    if (we.energy.effect === "flatEnergy" && tm.id === id) {
      // Check if the trigger condition is met in the timeline
      const triggerAction = we.energy.trigger;
      if (activeActions) {
        const hasTrigger =
          triggerAction === "burst"
            ? activeActions.has("Q") || activeActions.has("specialQ")
            : triggerAction === "skill"
              ? activeActions.has("E") || activeActions.has("holdE")
              : // "heal", "reaction", "onField" — assume triggered if character is in rotation
                activeActions.size > 0;
        if (!hasTrigger) continue;
      }
      flat += we.energy.totalEnergy[tm.refinement ?? 0];
    }
  }

  // Artifact energy (conditional on source having the trigger action)
  for (const tm of team) {
    const ae = tm.artifactSetId
      ? artifactEnergyById[tm.artifactSetId]
      : undefined;
    if (!ae) continue;
    // Exile 4pc only triggers if the wielder bursts
    if (ae.trigger === "burst" && ae.target === "partyOthers" && tm.id !== id) {
      const tmActions = allCharActions?.get(tm.id);
      if (tmActions && !tmActions.has("Q") && !tmActions.has("specialQ"))
        continue;
      flat += ae.flatEnergy;
    }
    if (
      ae.trigger === "particleGain" &&
      ae.target === "bowCatalystParty" &&
      (member.weaponType === "Bow" || member.weaponType === "Catalyst")
    )
      flat += ae.flatEnergy;
  }

  return { flat, erScaling };
}

// ─── ER solver ───

/**
 * Solve for required ER%.
 *
 * Energy equation: flatEnergy + (particleEnergy + erScaling) × (ER/100) ≥ burstCost
 * Solving: ER = (burstCost - flatEnergy) / (particleEnergy + erScaling) × 100
 *
 * erScaling is energy per 100% ER from passives (Sara P2, Dori P2).
 * It acts like additional particle energy since it scales with ER.
 */
function solveER(
  burstCost: number,
  particleEnergy: number,
  flatEnergy: number,
  erScaling = 0
): number {
  const needed = burstCost - flatEnergy;
  if (needed <= 0) return 100;
  const totalScaling = particleEnergy + erScaling;
  if (totalScaling <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(100, (needed / totalScaling) * 100);
}

// ─── On-field tracker ───

/**
 * Determine who absorbs particles from action `i`.
 *
 * Particles travel to the character performing the NEXT action in the sequence.
 * However, periodicE actions don't represent a character swap (the character is
 * off-field), so they are skipped when determining the absorber — particles
 * pass through to the next real (non-periodicE) action.
 *
 * In repeating mode, the last action wraps to the first.
 * In one-shot mode, the last action self-absorbs.
 */
function getAbsorber(
  sequence: Timeline,
  i: number,
  isRepeating: boolean
): string {
  // Find the next non-periodicE action (since periodicE chars are off-field)
  for (let j = 1; j <= sequence.length; j++) {
    let idx: number;
    if (i + j < sequence.length) {
      idx = i + j;
    } else if (isRepeating) {
      idx = (i + j) % sequence.length;
    } else {
      // One-shot: no more actions, self-absorb
      return sequence[i].char;
    }
    if (sequence[idx].action !== "periodicE") {
      return sequence[idx].char;
    }
  }
  // All periodicE? Fallback to self
  return sequence[i].char;
}

// ─── Simulation engine ───

interface CharSimState {
  particleAccum: number;
  flatAccum: number;
  consecutiveNAs: number;
  maxER: number;
  maxERParticle: number;
  maxERFlat: number;
  maxERQIndex: number;
  maxEREvents: EnergyEvent[];
  currentEvents: EnergyEvent[];
  qEvaluated: number;
  firstQSkipped: boolean;
}

/**
 * NA energy generation model (based on gcsim pkg/core/energy.go).
 *
 * gcsim: on each NA/CA hit there's a weapon-dependent probability to generate
 * 1 flat energy, with a pity system (probability increases on miss, resets on
 * proc and swap). 12-frame ICD between procs.
 *
 * We model this as: every N-th consecutive NA/CA/PA action by the same character
 * procs 1 flat energy. The proc follows the absorber model (next-action absorber
 * is on-field, energy distributed to all team members with on/off-field rates).
 *
 * N (actions between procs) by weapon type, assuming ~3 hits per action:
 *   Sword    (10% base, +5%/miss, ~5.5 hits/proc) → every 2nd action
 *   Claymore (0% base, +10%/miss, ~4.5 hits/proc) → every 2nd action
 *   Polearm  (0% base, +4%/miss, ~7.1 hits/proc)  → every 3rd action
 *   Bow      (0% base, +5%/miss, ~6.3 hits/proc)  → every 2nd action
 *   Catalyst (0% base, +10%/miss, ~4.5 hits/proc) → every 2nd action
 */
const NA_PROC_INTERVAL: Record<string, number> = {
  sword: 2,
  claymore: 2,
  polearm: 3,
  bow: 2,
  catalyst: 2,
};
const NA_PROC_INTERVAL_DEFAULT = 2;
const NA_FLAT_ENERGY_PER_PROC = 1.0;

/**
 * Walk through a sequence of actions, tracking particle energy per Q window.
 *
 * Key model rules:
 * 1. Regular E/holdE: "next-action absorber" — particles go to whoever acts next
 * 2. periodicE: particles go to the current on-field character (not the periodicE char)
 * 3. Q drains energy to 0 and evaluates the ER needed for that window
 * 4. Favonius procs follow the same absorber as the triggering E action
 * 5. All characters receive particles (on-field at 1.0x, off-field at reduced rate)
 */
function simulateER(
  team: TeamMember[],
  sequence: Timeline,
  options: EROptions | undefined,
  isRepeating: boolean,
  skipFirstQ: boolean,
  rotationLength: number
): ERResult[] {
  const partySize = team.length;
  const offFieldMult =
    OFF_FIELD_MULTIPLIER[partySize] ?? OFF_FIELD_MULTIPLIER[4];
  const particleMode = options?.particleMode ?? "expected";
  const enemyClearParticles = options?.enemyParticles ?? 0;
  const teamById = new Map(team.map((m) => [m.id, m]));

  // Compute per-character action sets (which actions each char performs)
  const charActions = new Map<string, Set<string>>();
  for (const act of sequence) {
    if (!teamById.has(act.char)) continue;
    if (!charActions.has(act.char)) charActions.set(act.char, new Set());
    charActions.get(act.char)!.add(act.action);
  }

  // Compute rotation energy per character (flat + erScaling)
  const rotationEnergyMap = new Map<
    string,
    { flat: number; erScaling: number }
  >();
  for (const member of team) {
    rotationEnergyMap.set(
      member.id,
      computeRotationEnergy(
        member,
        team,
        charActions,
        charActions.get(member.id)
      )
    );
  }

  // Count effective Q windows per character (excluding skipped first Q)
  const qWindowCount = new Map<string, number>();
  const firstQSeen = new Set<string>();
  for (const act of sequence) {
    if (!BURST_ACTIONS.has(act.action) || !teamById.has(act.char)) continue;
    if (skipFirstQ && !firstQSeen.has(act.char)) {
      firstQSeen.add(act.char);
      continue;
    }
    qWindowCount.set(act.char, (qWindowCount.get(act.char) ?? 0) + 1);
  }

  // Simulation state per character
  const state = new Map<string, CharSimState>();
  for (const m of team) {
    state.set(m.id, {
      particleAccum: 0,
      flatAccum: 0,
      consecutiveNAs: 0,
      maxER: 0,
      maxERParticle: 0,
      maxERFlat: 0,
      maxERQIndex: -1,
      maxEREvents: [],
      currentEvents: [],
      qEvaluated: 0,
      firstQSkipped: false,
    });
  }

  const favProcced = new Set<string>();
  const repeatCount = rotationLength > 0 ? sequence.length / rotationLength : 1;

  for (let i = 0; i < sequence.length; i++) {
    // Reset Favonius tracking at rotation boundaries
    if (i > 0 && rotationLength > 0 && i % rotationLength === 0) {
      favProcced.clear();
    }

    const act = sequence[i];
    if (!teamById.has(act.char)) continue;

    // ── Particle-producing actions ──
    if (PARTICLE_ACTIONS.has(act.action)) {
      const particleCount = getActionParticles(
        act.char,
        act.action,
        particleMode
      );

      // Determine absorber
      const absorber = getAbsorber(sequence, i, isRepeating);

      if (particleCount > 0) {
        const element = getParticleElement(act.char);
        for (const m of team) {
          const s = state.get(m.id)!;
          const onField = m.id === absorber;
          const mult = onField ? 1.0 : offFieldMult;
          const energy =
            particleCount * elementMatchEnergy(m.element, element) * mult;
          s.particleAccum += energy;
          s.currentEvents.push({
            sourceIndex: i % rotationLength,
            sourceChar: act.char,
            sourceAction: act.action,
            absorberChar: absorber,
            particleCount,
            particleElement: element,
            energyAt100: energy,
            onField,
            type: "particle",
          });
        }
      }

      // Favonius-type weapon particles (one proc per wielder per rotation)
      if (
        (act.action === "E" || act.action === "holdE") &&
        !favProcced.has(act.char)
      ) {
        const source = teamById.get(act.char)!;
        const weaponEntry = source.weaponId
          ? weaponEnergyById[source.weaponId]
          : undefined;
        if (weaponEntry?.energy.effect === "particles") {
          favProcced.add(act.char);
          for (const m of team) {
            const s = state.get(m.id)!;
            const onField = m.id === absorber;
            const mult = onField ? 1.0 : offFieldMult;
            const energy =
              weaponEntry.energy.particleCount *
              elementMatchEnergy(m.element, "Clear") *
              mult;
            s.particleAccum += energy;
            s.currentEvents.push({
              sourceIndex: i % rotationLength,
              sourceChar: act.char,
              sourceAction: act.action,
              absorberChar: absorber,
              particleCount: weaponEntry.energy.particleCount,
              particleElement: "Clear",
              energyAt100: energy,
              onField,
              type: "particle",
            });
          }
        }
      }
    }

    // ── Normal attack energy (absorber model, per gcsim pity system) ──
    // gcsim: weapon-dependent pity probability per hit → 1 flat energy on proc.
    // We approximate: every N-th consecutive NA/CA/PA action by the same char procs.
    // Non-attack actions (E, Q, swap) reset the counter (gcsim resets on swap).
    // Energy follows absorber model: next-action char is on-field, distributed to team.
    if (act.action === "NA" || act.action === "CA" || act.action === "PA") {
      const s = state.get(act.char)!;
      s.consecutiveNAs++;

      const member = teamById.get(act.char)!;
      const weaponType = member.weaponType?.toLowerCase();
      const interval = weaponType
        ? (NA_PROC_INTERVAL[weaponType] ?? NA_PROC_INTERVAL_DEFAULT)
        : NA_PROC_INTERVAL_DEFAULT;

      if (s.consecutiveNAs >= interval) {
        s.consecutiveNAs = 0;
        // Proc: distribute flat energy via absorber model
        const absorber = getAbsorber(sequence, i, isRepeating);
        for (const m of team) {
          const ms = state.get(m.id)!;
          const onField = m.id === absorber;
          const mult = onField ? 1.0 : offFieldMult;
          ms.flatAccum += NA_FLAT_ENERGY_PER_PROC * mult;
        }
      }
    } else {
      // Non-attack action resets NA counter for the acting character
      const s = state.get(act.char)!;
      s.consecutiveNAs = 0;
    }

    // ── Burst checkpoint ──
    if (BURST_ACTIONS.has(act.action)) {
      const s = state.get(act.char)!;
      const member = teamById.get(act.char)!;

      // Skip first Q in FE-repeat (character starts with full energy)
      if (skipFirstQ && !s.firstQSkipped) {
        s.firstQSkipped = true;
        s.particleAccum = 0;
        s.flatAccum = 0;
        s.currentEvents = [];
        continue;
      }

      if (member.burstCost > 0) {
        const numWindows = qWindowCount.get(act.char) ?? 1;
        const rotEnergy = rotationEnergyMap.get(act.char)!;
        const windowFlat = rotEnergy.flat / numWindows + s.flatAccum;
        const windowErScaling = rotEnergy.erScaling / numWindows;

        // Add proportional enemy particles
        let windowParticle = s.particleAccum;
        if (enemyClearParticles > 0 && numWindows > 0) {
          windowParticle +=
            (enemyClearParticles / partySize / numWindows) *
            elementMatchEnergy(member.element, "Clear");
        }

        const erForQ = solveER(
          member.burstCost,
          windowParticle,
          windowFlat,
          windowErScaling
        );

        if (erForQ > s.maxER) {
          s.maxER = erForQ;
          s.maxERParticle = windowParticle;
          s.maxERFlat = windowFlat;
          s.maxERQIndex = i % rotationLength;
          s.maxEREvents = [...s.currentEvents];
        }
        s.qEvaluated++;
      }

      // Reset accumulators (energy drains to 0 on burst)
      s.particleAccum = 0;
      s.flatAccum = 0;
      s.currentEvents = [];
    }
  }

  // Build results
  return team.map((member) => {
    const { id, element, burstCost } = member;
    const s = state.get(id)!;

    if (burstCost <= 0) {
      return {
        characterId: id,
        erNeeded: 100,
        energyBreakdown: { particleEnergy: 0, flatEnergy: 0 },
        hasQ: false,
      };
    }

    // Characters with no evaluated Q: use per-rotation accumulated energy
    if (s.qEvaluated === 0) {
      const rotEnergy = rotationEnergyMap.get(id)!;
      let particleEnergy = s.particleAccum / repeatCount;
      if (enemyClearParticles > 0) {
        particleEnergy +=
          (enemyClearParticles / team.length) *
          elementMatchEnergy(element, "Clear");
      }

      return {
        characterId: id,
        erNeeded: solveER(
          burstCost,
          particleEnergy,
          rotEnergy.flat,
          rotEnergy.erScaling
        ),
        energyBreakdown: {
          particleEnergy,
          flatEnergy: rotEnergy.flat,
        },
        hasQ: false,
      };
    }

    return {
      characterId: id,
      erNeeded: s.maxER,
      energyBreakdown: {
        particleEnergy: s.maxERParticle,
        flatEnergy: s.maxERFlat,
      },
      bindingEvents: s.maxEREvents,
      bindingQIndex: s.maxERQIndex,
      hasQ: true,
    };
  });
}

// ─── Main calculator ───

/**
 * Calculate the minimum ER% for each team member to burst every rotation.
 *
 * Supports three calculation modes:
 * - **zero-energy-start**: Can I burst starting from 0? Uses T1(+T2) as one-shot.
 * - **full-energy-repeat**: Can I sustain forever? Doubles repeating timeline [T,T].
 * - **zero-energy-repeat**: Both checks; takes max ER per character.
 *
 * The `timeline` parameter is the primary (or only) timeline:
 * - With 1 timeline: it IS the repeating rotation (循环轴).
 * - With `options.timeline2`: `timeline` is the startup (启动轴),
 *   `timeline2` is the repeating rotation.
 *
 * **Absorption rules:**
 * - Regular E/holdE: "next-action absorber" — particles go to whoever acts next
 * - periodicE: particles go to current on-field character (not the periodicE char)
 * - All 4 characters receive energy (absorber at 1.0x, others at off-field rate)
 */
export function calculateTeamER(
  team: TeamMember[],
  timeline: Timeline,
  options?: EROptions
): ERResult[] {
  const calcMode = options?.calcMode ?? "full-energy-repeat";

  if (calcMode === "zero-energy-repeat") {
    const zeResults = calculateTeamER(team, timeline, {
      ...options,
      calcMode: "zero-energy-start",
    });
    const feResults = calculateTeamER(team, timeline, {
      ...options,
      calcMode: "full-energy-repeat",
    });
    return team.map((_, i) =>
      zeResults[i].erNeeded >= feResults[i].erNeeded
        ? { ...zeResults[i], bindingMode: "zero-energy-start" as const }
        : { ...feResults[i], bindingMode: "full-energy-repeat" as const }
    );
  }

  const timeline2 = options?.timeline2;

  if (calcMode === "zero-energy-start") {
    // One-shot: T1 + T2 (if present). Last action self-absorbs.
    const sequence = timeline2 ? [...timeline, ...timeline2] : [...timeline];
    return simulateER(team, sequence, options, false, false, sequence.length);
  }

  // full-energy-repeat: double the repeating timeline [T, T].
  // Repeating = timeline2 if dual-timeline, else timeline itself.
  const repeating = timeline2 ?? timeline;
  const sequence = [...repeating, ...repeating];
  return simulateER(team, sequence, options, true, true, repeating.length);
}

// ─── UI utilities ───

/** Get available action types for a character based on particle data. */
export function getAvailableActions(charId: string): ActionType[] {
  const actions: ActionType[] = ["E"];
  if (particles[charId]?.hold) actions.push("holdE");
  if (periodicGenerators.has(charId)) actions.push("periodicE");
  actions.push("Q", "NA", "CA", "PA", "wait");
  return actions;
}

/** Expose for testing and UI. */
/**
 * Get the absorber character for a particle-producing action at index `i`.
 * For UI display: shows who catches the particles from this action.
 * Uses the same logic as the simulation engine.
 */
export function getAbsorberForAction(
  timeline: Timeline,
  i: number,
  isRepeating = true
): string | null {
  const act = timeline[i];
  if (!act) return null;
  const particles = getActionParticles(act.char, act.action, "expected");
  if (particles <= 0) return null;
  return getAbsorber(timeline, i, isRepeating);
}

export { allSelfEnergy, getActionParticles, getParticleElement, particles };
