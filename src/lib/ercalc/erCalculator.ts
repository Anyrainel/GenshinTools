import { artifactEnergyById } from "@/lib/ercalc/artifactEnergy";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import {
  BURST_ACTIONS,
  CLEAR_PARTICLE,
  DIFF_ELEMENT_PARTICLE,
  DIRECT_PARTICLE_ACTIONS,
  NA_FLAT_ENERGY_PER_PROC,
  NA_PROC_INTERVAL,
  NA_PROC_INTERVAL_DEFAULT,
  OFF_FIELD_MULTIPLIER,
  PARAM_DEFAULTS,
  PATTERN_ACTIONS,
  SAME_ELEMENT_PARTICLE,
  allSelfEnergy,
  particles as particlesData,
} from "./constants";
import type { SelfEnergyEntry } from "./types";
import type {
  ActionType,
  EROptions,
  ERResult,
  ERTimeline,
  EnergyEvent,
  ParticleMode,
  PeriodicProc,
  TeamMember,
  TeamSlot,
  TimelineAction,
} from "./types";
import { resolveParticles } from "./utils";

const particles = particlesData;

// ─── Particle lookup ───

/** Direct per-cast particles for a main action. Does not handle periodic, pattern, or Favonius. */
export function getActionParticles(
  charId: string,
  action: ActionType,
  mode: ParticleMode
): number {
  if (!DIRECT_PARTICLE_ACTIONS.has(action)) return 0;
  const data = particles[charId];
  if (!data) return 0;
  if (action === "E") return resolveParticles(data.E?.particles, mode);
  if (action === "holdE") {
    if (data.holdE) return resolveParticles(data.holdE.particles, mode);
    return resolveParticles(data.E?.particles, mode); // fallback
  }
  if (action === "specialE")
    return resolveParticles(data.specialE?.particles, mode);
  return 0;
}

/** Per-hit pattern particles for NA/CA/PA (infusion chars).
 *  hitIndex is the char's consecutive count of this action type. */
export function getHitParticles(
  charId: string,
  action: ActionType,
  hitIndex: number,
  mode: ParticleMode
): number {
  if (!PATTERN_ACTIONS.has(action)) return 0;
  const data = particles[charId];
  if (!data) return 0;
  const cfg =
    action === "NA"
      ? data.NA
      : action === "CA"
        ? data.CA
        : action === "PA"
          ? data.PA
          : undefined;
  if (!cfg || cfg.pattern.length === 0) return 0;
  return resolveParticles(cfg.pattern[hitIndex % cfg.pattern.length], mode);
}

/** Per-proc particles for a periodic emission from the given trigger. */
export function getPeriodicParticles(
  charId: string,
  trigger: "E" | "Q",
  mode: ParticleMode
): number {
  const cfg = particles[charId]?.periodic?.[trigger];
  if (!cfg) return 0;
  return resolveParticles(cfg.particles, mode);
}

/** Element of a character's particles. */
export function getParticleElement(charId: string): string {
  return particles[charId]?.element ?? "Clear";
}

/** Default periodic proc count the UI should auto-place when the trigger action is added. */
export function getDefaultProcCount(
  charId: string,
  trigger: "E" | "Q"
): number {
  return particles[charId]?.periodic?.[trigger]?.procs ?? 0;
}

/** Whether a character has a periodic generator triggered by a given action. */
export function hasPeriodicGeneration(
  charId: string,
  trigger: "E" | "Q"
): boolean {
  return particles[charId]?.periodic?.[trigger] != null;
}

// ─── Auto-placement ───

/**
 * Auto-place N periodic procs when a trigger action is added to the timeline.
 * Distributes procs to the main-action slots following the trigger.
 */
export function autoPlacePeriodic(
  actions: TimelineAction[],
  triggerIndex: number,
  charId: string,
  trigger: "E" | "Q"
): PeriodicProc[] {
  const count = getDefaultProcCount(charId, trigger);
  if (count <= 0) return [];
  const procs: PeriodicProc[] = [];
  let placed = 0;
  for (let i = triggerIndex + 1; i < actions.length && placed < count; i++) {
    procs.push({ sourceChar: charId, trigger, targetIndex: i });
    placed++;
  }
  // If we couldn't place any forward (trigger is last action), attach one to itself.
  if (placed === 0) {
    procs.push({ sourceChar: charId, trigger, targetIndex: triggerIndex });
  }
  return procs;
}

/**
 * Auto-toggle Favonius procs for a wielder on the first N E/Q actions.
 * Mutates the provided actions array in place.
 */
export function autoPlaceFavonius(
  actions: TimelineAction[],
  wielderId: string,
  procCount: number
): void {
  let placed = 0;
  for (const a of actions) {
    if (placed >= procCount) break;
    if (a.char !== wielderId) continue;
    if (
      a.action === "E" ||
      a.action === "holdE" ||
      a.action === "specialE" ||
      a.action === "Q" ||
      a.action === "specialQ"
    ) {
      a.favoniusProc = true;
      placed++;
    }
  }
}

// ─── Helpers ───

function resolveParamAmount(
  charId: string,
  param: { source: string; index: number; multiplier: number }
): number | null {
  const key = `${charId}:${param.source}:${param.index}`;
  const base = PARAM_DEFAULTS[key];
  if (base == null) return null;
  return base * param.multiplier;
}

function elementMatchEnergy(
  receiverElement: string,
  particleElement: string
): number {
  if (particleElement === "Clear") return CLEAR_PARTICLE;
  return receiverElement === particleElement
    ? SAME_ELEMENT_PARTICLE
    : DIFF_ELEMENT_PARTICLE;
}

// ─── Self-energy / weapon / artifact ───

function isActionTriggered(
  entryAction: string,
  activeActions: Set<string>
): boolean {
  if (entryAction === "A") return true;
  if (entryAction === "Q")
    return activeActions.has("Q") || activeActions.has("specialQ");
  if (entryAction === "E")
    return (
      activeActions.has("E") ||
      activeActions.has("holdE") ||
      activeActions.has("specialE")
    );
  return activeActions.has(entryAction);
}

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

function computeRotationEnergy(
  member: TeamMember,
  team: TeamMember[],
  allCharActions?: Map<string, Set<string>>,
  activeActions?: Set<string>
): { flat: number; erScaling: number } {
  const { id, constellation = 0, burstCost } = member;
  let flat = 0;
  let erScaling = 0;

  const self = computeSelfEnergy(id, constellation, burstCost, activeActions);
  flat += self.flat;
  erScaling += self.erScaling;

  for (const tm of team) {
    if (tm.id === id) continue;
    const sourceActions = allCharActions?.get(tm.id);
    const party = computePartyEnergy(
      tm.id,
      tm.constellation ?? 0,
      sourceActions
    );
    flat += party.flat;
    erScaling += party.erScaling;
  }

  for (const tm of team) {
    const we = tm.weaponId ? weaponEnergyById[tm.weaponId] : undefined;
    if (!we) continue;
    if (we.energy.effect === "flatEnergy" && tm.id === id) {
      const triggerAction = we.energy.trigger;
      if (activeActions) {
        const hasTrigger =
          triggerAction === "burst"
            ? activeActions.has("Q") || activeActions.has("specialQ")
            : triggerAction === "skill"
              ? activeActions.has("E") ||
                activeActions.has("holdE") ||
                activeActions.has("specialE")
              : activeActions.size > 0;
        if (!hasTrigger) continue;
      }
      flat += we.energy.totalEnergy[tm.refinement ?? 0];
    }
  }

  for (const tm of team) {
    const ae =
      tm.artifactSet?.type === "4pc"
        ? artifactEnergyById[tm.artifactSet.setId]
        : undefined;
    if (!ae) continue;
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

// ─── Solver ───

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

// ─── Absorber ───

/**
 * Absorber for particles emitted at main-action index `i`.
 * Next-action-char rule; self-absorb at end of one-shot sequence, wrap in repeating.
 */
function getAbsorber(
  actions: TimelineAction[],
  i: number,
  isRepeating: boolean
): string {
  if (i + 1 < actions.length) return actions[i + 1].char;
  if (isRepeating) return actions[0].char;
  return actions[i].char;
}

// ─── Simulation state ───

interface CharSimState {
  particleAccum: number;
  flatAccum: number;
  consecutiveNAs: number;
  hitCounts: { NA: number; CA: number; PA: number };
  maxER: number;
  maxERParticle: number;
  maxERFlat: number;
  maxERQIndex: number;
  maxEREvents: EnergyEvent[];
  currentEvents: EnergyEvent[];
  qEvaluated: number;
  firstQSkipped: boolean;
}

function freshState(): CharSimState {
  return {
    particleAccum: 0,
    flatAccum: 0,
    consecutiveNAs: 0,
    hitCounts: { NA: 0, CA: 0, PA: 0 },
    maxER: 0,
    maxERParticle: 0,
    maxERFlat: 0,
    maxERQIndex: -1,
    maxEREvents: [],
    currentEvents: [],
    qEvaluated: 0,
    firstQSkipped: false,
  };
}

function distributeParticles(
  team: TeamMember[],
  state: Map<string, CharSimState>,
  sourceChar: string,
  sourceAction: ActionType | "periodic" | "favonius",
  sourceIndex: number,
  particleCount: number,
  particleElement: string,
  absorber: string,
  offFieldMult: number,
  rotationLength: number
): void {
  for (const m of team) {
    const s = state.get(m.id);
    if (!s) continue;
    const onField = m.id === absorber;
    const mult = onField ? 1.0 : offFieldMult;
    const energy =
      particleCount * elementMatchEnergy(m.element, particleElement) * mult;
    s.particleAccum += energy;
    s.currentEvents.push({
      sourceIndex:
        rotationLength > 0 ? sourceIndex % rotationLength : sourceIndex,
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

/**
 * Walk an expanded action sequence with per-action periodic procs.
 * The sequence is pre-expanded (repeated for full-energy-repeat mode).
 */
function simulateSequence(
  team: TeamMember[],
  actions: TimelineAction[],
  procsByIndex: Map<number, PeriodicProc[]>,
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

  // Action sets per character (for conditional energy triggers)
  const charActions = new Map<string, Set<string>>();
  for (const act of actions) {
    if (!teamById.has(act.char)) continue;
    if (!charActions.has(act.char)) charActions.set(act.char, new Set());
    charActions.get(act.char)!.add(act.action);
  }

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

  const qWindowCount = new Map<string, number>();
  const firstQSeen = new Set<string>();
  for (const act of actions) {
    if (!BURST_ACTIONS.has(act.action) || !teamById.has(act.char)) continue;
    if (skipFirstQ && !firstQSeen.has(act.char)) {
      firstQSeen.add(act.char);
      continue;
    }
    qWindowCount.set(act.char, (qWindowCount.get(act.char) ?? 0) + 1);
  }

  const state = new Map<string, CharSimState>();
  for (const m of team) state.set(m.id, freshState());

  const repeatCount = rotationLength > 0 ? actions.length / rotationLength : 1;

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (!teamById.has(act.char)) continue;

    // ── 1. Periodic procs attached to this action (absorbed by on-field char = act.char) ──
    const incoming = procsByIndex.get(i);
    if (incoming) {
      for (const proc of incoming) {
        const n = getPeriodicParticles(
          proc.sourceChar,
          proc.trigger,
          particleMode
        );
        if (n > 0) {
          distributeParticles(
            team,
            state,
            proc.sourceChar,
            "periodic",
            i,
            n,
            getParticleElement(proc.sourceChar),
            act.char, // on-field absorber
            offFieldMult,
            rotationLength
          );
        }
      }
    }

    // ── 2. The action itself ──
    const s = state.get(act.char)!;

    // Direct per-cast particles (E / holdE / specialE)
    if (DIRECT_PARTICLE_ACTIONS.has(act.action)) {
      const n = getActionParticles(act.char, act.action, particleMode);
      if (n > 0) {
        const absorber = getAbsorber(actions, i, isRepeating);
        distributeParticles(
          team,
          state,
          act.char,
          act.action,
          i,
          n,
          getParticleElement(act.char),
          absorber,
          offFieldMult,
          rotationLength
        );
      }
    }

    // Per-hit pattern particles (NA / CA / PA — infusion chars)
    if (PATTERN_ACTIONS.has(act.action)) {
      const hitKey = act.action as "NA" | "CA" | "PA";
      const hitIndex = s.hitCounts[hitKey];
      s.hitCounts[hitKey] = hitIndex + 1;
      const n = getHitParticles(act.char, act.action, hitIndex, particleMode);
      if (n > 0) {
        const absorber = getAbsorber(actions, i, isRepeating);
        distributeParticles(
          team,
          state,
          act.char,
          act.action,
          i,
          n,
          getParticleElement(act.char),
          absorber,
          offFieldMult,
          rotationLength
        );
      }
    }

    // Favonius proc attached to this node
    if (act.favoniusProc) {
      const member = teamById.get(act.char)!;
      const we = member.weaponId
        ? weaponEnergyById[member.weaponId]
        : undefined;
      if (we?.energy.effect === "particles") {
        const absorber = getAbsorber(actions, i, isRepeating);
        distributeParticles(
          team,
          state,
          act.char,
          "favonius",
          i,
          we.energy.particleCount,
          "Clear",
          absorber,
          offFieldMult,
          rotationLength
        );
      }
    }

    // NA pity flat energy (per gcsim; separate from infusion particles)
    if (act.action === "NA" || act.action === "CA" || act.action === "PA") {
      s.consecutiveNAs++;
      const member = teamById.get(act.char)!;
      const weaponType = member.weaponType?.toLowerCase();
      const interval = weaponType
        ? (NA_PROC_INTERVAL[weaponType] ?? NA_PROC_INTERVAL_DEFAULT)
        : NA_PROC_INTERVAL_DEFAULT;
      if (s.consecutiveNAs >= interval) {
        s.consecutiveNAs = 0;
        const absorber = getAbsorber(actions, i, isRepeating);
        for (const m of team) {
          const ms = state.get(m.id);
          if (!ms) continue;
          const onField = m.id === absorber;
          const mult = onField ? 1.0 : offFieldMult;
          ms.flatAccum += NA_FLAT_ENERGY_PER_PROC * mult;
        }
      }
    } else {
      s.consecutiveNAs = 0;
    }

    // ── 3. Burst checkpoint ──
    if (BURST_ACTIONS.has(act.action)) {
      const member = teamById.get(act.char)!;

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
          s.maxERQIndex = rotationLength > 0 ? i % rotationLength : i;
          s.maxEREvents = [...s.currentEvents];
        }
        s.qEvaluated++;
      }

      s.particleAccum = 0;
      s.flatAccum = 0;
      s.currentEvents = [];
    }
  }

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

/**
 * Build a map from main-action index to the periodic procs that fire there.
 */
function indexProcs(procs: PeriodicProc[]): Map<number, PeriodicProc[]> {
  const map = new Map<number, PeriodicProc[]>();
  for (const p of procs) {
    const arr = map.get(p.targetIndex);
    if (arr) arr.push(p);
    else map.set(p.targetIndex, [p]);
  }
  return map;
}

/**
 * Expand an ERTimeline into a full sequence (for full-energy-repeat, [T, T]).
 * Offsets periodic proc indexes for the repeated copy.
 */
function expandRepeat(
  ert: ERTimeline,
  repeats: number
): { actions: TimelineAction[]; procs: PeriodicProc[] } {
  const actions: TimelineAction[] = [];
  const procs: PeriodicProc[] = [];
  for (let r = 0; r < repeats; r++) {
    const offset = r * ert.actions.length;
    for (const a of ert.actions) actions.push({ ...a });
    for (const p of ert.periodic) {
      procs.push({
        sourceChar: p.sourceChar,
        trigger: p.trigger,
        targetIndex: p.targetIndex + offset,
      });
    }
  }
  return { actions, procs };
}

/**
 * Concatenate two ERTimelines (T1 + T2), offsetting T2's periodic procs.
 */
function concatTimelines(t1: ERTimeline, t2: ERTimeline): ERTimeline {
  const actions = [...t1.actions, ...t2.actions];
  const offset = t1.actions.length;
  const periodic: PeriodicProc[] = [
    ...t1.periodic,
    ...t2.periodic.map((p) => ({
      sourceChar: p.sourceChar,
      trigger: p.trigger,
      targetIndex: p.targetIndex + offset,
    })),
  ];
  return { actions, periodic };
}

// ─── Public API ───

/**
 * Calculate the minimum ER% for each team member to burst every rotation.
 *
 * Supports three calculation modes:
 * - **zero-energy-start**: Can I burst starting from 0? Uses T1(+T2) as one-shot.
 * - **full-energy-repeat**: Can I sustain forever? Doubles the repeating timeline.
 * - **zero-energy-repeat**: Both checks; takes max ER per character.
 *
 * The `timeline` parameter is the primary (or only) timeline:
 * - With 1 timeline: it IS the repeating rotation.
 * - With `options.timeline2`: `timeline` is startup, `timeline2` is repeating.
 */
export function calculateTeamER(
  team: TeamMember[],
  timeline: ERTimeline,
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
    const full = timeline2 ? concatTimelines(timeline, timeline2) : timeline;
    return simulateSequence(
      team,
      full.actions,
      indexProcs(full.periodic),
      options,
      false,
      false,
      full.actions.length
    );
  }

  // full-energy-repeat
  const repeating = timeline2 ?? timeline;
  const expanded = expandRepeat(repeating, 2);
  return simulateSequence(
    team,
    expanded.actions,
    indexProcs(expanded.procs),
    options,
    true,
    true,
    repeating.actions.length
  );
}

// ─── UI utilities ───

/** Get available action types for a character. */
export function getAvailableActions(charId: string): ActionType[] {
  const data = particles[charId];
  const out: ActionType[] = ["E"];
  if (data?.holdE) out.push("holdE");
  if (data?.specialE) out.push("specialE");
  out.push("Q");
  // specialQ is available for chars who have it in character-level data; keep always for now.
  out.push("specialQ");
  if (data?.NA) out.push("NA");
  if (data?.CA) out.push("CA");
  if (data?.PA) out.push("PA");
  // NA/CA/PA always available for any char (even without particle patterns) as field-time fillers
  if (!out.includes("NA")) out.push("NA");
  if (!out.includes("CA")) out.push("CA");
  if (!out.includes("PA")) out.push("PA");
  out.push("wait");
  return out;
}

/**
 * Get the absorber character for a particle-producing action at index `i`.
 * Used by the UI for arrow rendering.
 */
export function getAbsorberForAction(
  timeline: ERTimeline,
  i: number,
  isRepeating = true
): string | null {
  const act = timeline.actions[i];
  if (!act) return null;
  const particleMode: ParticleMode = "expected";
  let produces = 0;
  if (DIRECT_PARTICLE_ACTIONS.has(act.action))
    produces = getActionParticles(act.char, act.action, particleMode);
  // For pattern chars we'd need hit index — skip for UI indicator (conservative: consider producing)
  if (
    PATTERN_ACTIONS.has(act.action) &&
    particles[act.char]?.[act.action as "NA" | "CA" | "PA"]
  )
    produces = 1;
  if (act.favoniusProc) produces = Math.max(produces, 1);
  if (produces <= 0) return null;
  return getAbsorber(timeline.actions, i, isRepeating);
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

// ─── Per-node energy event lookup (for UI popovers) ───

export interface NodeEnergyEvent {
  source: string; // short label (e.g. "Venti A4", "Prototype Amber", "Exile 4pc")
  amount: number; // flat energy amount
  toSelf: boolean; // receiver is the acting character
  toParty: boolean; // receivers are other party members
  category: "drain" | "refund" | "weapon" | "artifact" | "party";
}

/**
 * Resolve the set of flat-energy events that fire when this character performs
 * this action. Used by the timeline UI to show per-node energy restores/drains.
 *
 * Intentionally omits particles — those are shown as flow edges, not node events.
 */
export function getNodeEnergyEvents(
  charId: string,
  action: ActionType,
  weaponId: string | undefined,
  refinement: number | undefined,
  artifactSetId: string | undefined,
  burstCost: number
): NodeEnergyEvent[] {
  const events: NodeEnergyEvent[] = [];

  // Burst drain
  if (action === "Q" || action === "specialQ") {
    events.push({
      source: action === "specialQ" ? "Alt burst" : "Burst",
      amount: burstCost,
      toSelf: true,
      toParty: false,
      category: "drain",
    });
  }

  // Self-energy entries from this char that trigger on this action
  const selfEntries = allSelfEnergy[charId] ?? [];
  for (const entry of selfEntries) {
    if (!entryMatchesAction(entry.action, action)) continue;
    const amount = resolveEntryAmount(entry, charId, burstCost);
    if (amount == null || amount === 0) continue;
    const toSelf = entry.target === "self" || entry.target === "party";
    const toParty =
      entry.target === "party" ||
      entry.target === "partyOthers" ||
      entry.target === "active";
    events.push({
      source: entry.source ?? "passive",
      amount,
      toSelf,
      toParty,
      category: toParty && !toSelf ? "party" : "refund",
    });
  }

  // Weapon flat energy
  const we = weaponId ? weaponEnergyById[weaponId] : undefined;
  if (we?.energy.effect === "flatEnergy") {
    const weaponTrigger = we.energy.trigger;
    const weaponMatches =
      (weaponTrigger === "burst" &&
        (action === "Q" || action === "specialQ")) ||
      (weaponTrigger === "skill" &&
        (action === "E" || action === "holdE" || action === "specialE"));
    if (weaponMatches) {
      events.push({
        source: weaponId ?? "weapon",
        amount: we.energy.totalEnergy[refinement ?? 0],
        toSelf: true,
        toParty: false,
        category: "weapon",
      });
    }
  }

  // Artifact flat energy
  const ae = artifactSetId ? artifactEnergyById[artifactSetId] : undefined;
  if (ae) {
    const artifactMatches =
      ae.trigger === "burst" && (action === "Q" || action === "specialQ");
    if (artifactMatches) {
      const toParty = ae.target === "partyOthers";
      events.push({
        source: `${artifactSetId} 4pc`,
        amount: ae.flatEnergy,
        toSelf: !toParty,
        toParty,
        category: "artifact",
      });
    }
  }

  return events;
}

function entryMatchesAction(entryAction: string, action: ActionType): boolean {
  if (entryAction === "A") return true;
  if (entryAction === "Q") return action === "Q" || action === "specialQ";
  if (entryAction === "E")
    return action === "E" || action === "holdE" || action === "specialE";
  return entryAction === action;
}

function resolveEntryAmount(
  entry: SelfEnergyEntry,
  charId: string,
  burstCost: number
): number | null {
  const procs = entry.procs ?? 1;
  if (entry.erScale) {
    // ER-scaling energy isn't a fixed flat — omit from per-node display.
    return null;
  }
  if (entry.param) {
    const paramAmount = resolveParamAmount(charId, entry.param);
    if (paramAmount == null) return null;
    return paramAmount * procs;
  }
  if (entry.percentRefund != null) {
    return (burstCost * entry.percentRefund) / 100;
  }
  if (entry.amount != null) return entry.amount * procs;
  return null;
}
