import { artifactEnergyById } from "@/lib/ercalc/artifactEnergy";
import {
  expectedPeriodicProcs,
  multiHitETotal,
  periodicGenerators,
} from "@/lib/ercalc/particleConfig";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import {
  BURST_ACTIONS,
  CLEAR_PARTICLE,
  DIFF_ELEMENT_PARTICLE,
  NA_FLAT_ENERGY_PER_PROC,
  NA_PROC_INTERVAL,
  NA_PROC_INTERVAL_DEFAULT,
  OFF_FIELD_MULTIPLIER,
  PARAM_DEFAULTS,
  PARTICLE_ACTIONS,
  SAME_ELEMENT_PARTICLE,
  type SelfEnergyEntry,
  allSelfEnergy,
  particles as particlesData,
  resolveParticleAvg,
} from "./constants";
import type {
  ActionType,
  EROptions,
  ERResult,
  ERTimeline,
  EnergyEvent,
  ParticleMode,
  TeamMember,
  TeamSlot,
  TickAssignment,
  Timeline,
  TimelineAction,
} from "./types";

// Re-export all public types for backwards compatibility
export type {
  ActionType,
  CalcMode,
  EROptions,
  ERResult,
  ERTimeline,
  EnergyEvent,
  ParticleMode,
  TeamMember,
  TickAssignment,
  Timeline,
  TimelineAction,
} from "./types";

/**
 * Convert an ERTimeline to a flat Timeline for the simulation engine.
 * Inserts periodicE actions just before their target main action.
 */
export function flattenERTimeline(ert: ERTimeline): Timeline {
  const ticksByTarget = new Map<number, TickAssignment[]>();
  for (const tick of ert.ticks) {
    const arr = ticksByTarget.get(tick.targetIndex);
    if (arr) arr.push(tick);
    else ticksByTarget.set(tick.targetIndex, [tick]);
  }
  const flat: Timeline = [];
  for (let i = 0; i < ert.actions.length; i++) {
    const ticks = ticksByTarget.get(i);
    if (ticks) {
      for (const tick of ticks) {
        flat.push({ char: tick.sourceChar, action: "periodicE" });
      }
    }
    flat.push(ert.actions[i]);
  }
  return flat;
}

/**
 * Convert a legacy flat Timeline (with periodicE entries) to an ERTimeline.
 * Periodic actions are assigned to the next non-periodic action.
 */
export function legacyToERTimeline(timeline: Timeline): ERTimeline {
  const actions: TimelineAction[] = [];
  const ticks: TickAssignment[] = [];
  const pending: string[] = [];
  for (const act of timeline) {
    if (act.action === "periodicE") {
      pending.push(act.char);
    } else {
      const targetIndex = actions.length;
      for (const sourceChar of pending) {
        ticks.push({ sourceChar, targetIndex });
      }
      pending.length = 0;
      actions.push(act);
    }
  }
  if (pending.length > 0 && actions.length > 0) {
    const lastIndex = actions.length - 1;
    for (const sourceChar of pending) {
      ticks.push({ sourceChar, targetIndex: lastIndex });
    }
  }
  return { actions, ticks };
}

/**
 * Auto-generate tick assignments when adding an E for a periodic generator.
 * Distributes N ticks to the next N main actions after `eIndex`.
 */
export function autoPlaceTicks(
  actions: TimelineAction[],
  eIndex: number,
  charId: string
): TickAssignment[] {
  const count = expectedPeriodicProcs[charId] ?? 0;
  if (count <= 0) return [];
  const newTicks: TickAssignment[] = [];
  let placed = 0;
  for (let i = eIndex + 1; i < actions.length && placed < count; i++) {
    newTicks.push({ sourceChar: charId, targetIndex: i });
    placed++;
  }
  if (placed < count && placed === 0) {
    newTicks.push({ sourceChar: charId, targetIndex: eIndex });
    placed++;
  }
  return newTicks;
}

const particles = particlesData;

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

  // periodicE: per-proc value from periodic data or E data
  if (action === "periodicE") {
    const periodicParticles = data.periodic?.E?.particles;
    if (periodicParticles != null) {
      return rngAdjust(resolveParticleAvg(periodicParticles), mode);
    }
    return rngAdjust(resolveParticleAvg(data.E?.particles), mode);
  }

  // Periodic deployers: E/holdE produces 0 (deployment only)
  if (periodicGenerators.has(charId)) return 0;

  // holdE: prefer holdE data
  if (action === "holdE" && data.holdE) {
    return rngAdjust(resolveParticleAvg(data.holdE.particles), mode);
  }

  // E (or holdE fallback): multi-hit override or E data
  if (multiHitETotal[charId] != null) {
    return rngAdjust(multiHitETotal[charId], mode);
  }
  return rngAdjust(resolveParticleAvg(data.E?.particles), mode);
}

function getParticleElement(charId: string): string {
  return particles[charId]?.element ?? "Clear";
}

// ─── Shared energy helpers ───

/** Check if a self-energy entry's trigger action is present in the timeline. */
function isActionTriggered(
  entryAction: string,
  activeActions: Set<string>
): boolean {
  if (entryAction === "A") return true;
  if (entryAction === "Q")
    return activeActions.has("Q") || activeActions.has("specialQ");
  if (entryAction === "E")
    return activeActions.has("E") || activeActions.has("holdE");
  return activeActions.has(entryAction);
}

/** Accumulate energy from an entry (erScale, param, or flat amount). */
function accumulateEntryEnergy(
  entry: SelfEnergyEntry,
  charId: string,
  burstCost: number | undefined,
  accum: { flat: number; erScaling: number }
): void {
  const procs = entry.procs ?? 1;

  if (entry.erScale) {
    accum.erScaling += (entry.erScale.per100 ?? 0) * procs;
    return;
  }
  if (entry.param) {
    const paramAmount = resolveParamAmount(charId, entry.param);
    if (paramAmount != null) accum.flat += paramAmount * procs;
    return;
  }
  if (entry.percentRefund != null && burstCost != null) {
    accum.flat += (burstCost * entry.percentRefund) / 100;
  } else if (entry.amount != null) {
    accum.flat += entry.amount * procs;
  }
}

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
  activeActions?: Set<string>
): { flat: number; erScaling: number } {
  const entries = allSelfEnergy[charId];
  if (!entries) return { flat: 0, erScaling: 0 };

  const accum = { flat: 0, erScaling: 0 };
  for (const entry of entries) {
    if (constellation < entry.minC) continue;
    if (entry.target !== "self" && entry.target !== "party") continue;
    if (activeActions && !isActionTriggered(entry.action, activeActions))
      continue;
    accumulateEntryEnergy(entry, charId, burstCost, accum);
  }
  return accum;
}

/**
 * Compute party energy that a character gives to teammates.
 * Returns { flat, erScaling } — erScaling is energy per 100% ER of the SOURCE.
 */
function computePartyEnergy(
  sourceId: string,
  sourceConstellation: number,
  sourceActions?: Set<string>
): { flat: number; erScaling: number } {
  const entries = allSelfEnergy[sourceId];
  if (!entries) return { flat: 0, erScaling: 0 };

  const accum = { flat: 0, erScaling: 0 };
  for (const entry of entries) {
    if (sourceConstellation < entry.minC) continue;
    if (
      entry.target !== "party" &&
      entry.target !== "partyOthers" &&
      entry.target !== "active"
    )
      continue;
    if (sourceActions && !isActionTriggered(entry.action, sourceActions))
      continue;
    accumulateEntryEnergy(entry, sourceId, undefined, accum);
  }
  return accum;
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

// ─── Simulation helpers ───

/** Distribute particle energy from a single source to all team members. */
function distributeParticles(
  team: TeamMember[],
  state: Map<string, CharSimState>,
  sourceChar: string,
  sourceAction: ActionType,
  sourceIndex: number,
  particleCount: number,
  particleElement: string,
  absorber: string,
  offFieldMult: number,
  rotationLength: number
): void {
  for (const m of team) {
    const s = state.get(m.id)!;
    const onField = m.id === absorber;
    const mult = onField ? 1.0 : offFieldMult;
    const energy =
      particleCount * elementMatchEnergy(m.element, particleElement) * mult;
    s.particleAccum += energy;
    s.currentEvents.push({
      sourceIndex: sourceIndex % rotationLength,
      sourceChar,
      sourceAction,
      absorberChar: absorber,
      particleCount,
      particleElement,
      energyAt100: energy,
      onField,
      type: "particle",
    });
  }
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
        distributeParticles(
          team,
          state,
          act.char,
          act.action,
          i,
          particleCount,
          getParticleElement(act.char),
          absorber,
          offFieldMult,
          rotationLength
        );
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
          distributeParticles(
            team,
            state,
            act.char,
            act.action,
            i,
            weaponEntry.energy.particleCount,
            "Clear",
            absorber,
            offFieldMult,
            rotationLength
          );
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

/** Get available action types for a character (periodicE is auto-managed via ticks). */
export function getAvailableActions(charId: string): ActionType[] {
  const actions: ActionType[] = ["E"];
  if (particles[charId]?.holdE) actions.push("holdE");
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

/** Convert a UI TeamSlot to an engine TeamMember. */
export function toTeamMember(slot: TeamSlot): TeamMember {
  return {
    id: slot.charId,
    element: slot.element,
    burstCost: slot.burstCost,
    constellation: slot.constellation,
    weaponId: slot.weaponId,
    refinement: slot.refinement,
  };
}

export { allSelfEnergy, getActionParticles, getParticleElement, particles };
