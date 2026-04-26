import { getTalentParam } from "@/data/gameStatsLoader";
import { getArtifactEnergyImpl } from "@/lib/ercalc/artifactEnergy";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import {
  allSelfEnergy,
  BURST_ACTIONS,
  CLEAR_PARTICLE,
  DIFF_ELEMENT_PARTICLE,
  DIRECT_PARTICLE_ACTIONS,
  NA_PITY,
  NA_PITY_DEFAULT,
  OFF_FIELD_MULTIPLIER,
  ORB_MULTIPLIER,
  PARAM_DEFAULTS,
  PATTERN_ACTIONS,
  particles as particlesData,
  SAME_ELEMENT_PARTICLE,
} from "./constants";
import type {
  ActionType,
  EnergyEvent,
  ERCalculationSegment,
  EROptions,
  ERResult,
  ERSequenceOptions,
  ERTimeline,
  NAPityConfig,
  ParticleMode,
  PeriodicProc,
  QWindow,
  QWindowSource,
  SelfEnergyEntry,
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
  // Procs that cannot be placed yet (trigger is last, or not enough following
  // slots) are deferred — they will be auto-added when later actions are
  // appended. See handleAddAction backfill logic.
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

/** Whether a weapon has flat energy gated by wearer reaction participation. */
export function hasReactionEnergyTrigger(
  weaponId: string | undefined
): boolean {
  const we = weaponId ? weaponEnergyById[weaponId] : undefined;
  return we?.energy.effect === "flatEnergy" && we.energy.trigger === "reaction";
}

/**
 * Temporary heuristic for reaction-gated weapon energy: assume every skill node
 * from the wielder triggers the weapon condition.
 */
export function autoPlaceReactionProcs(
  actions: TimelineAction[],
  wielderId: string
): void {
  for (const a of actions) {
    if (a.char !== wielderId) continue;
    if (a.action === "E" || a.action === "holdE" || a.action === "specialE") {
      a.reactionProc = true;
    }
  }
}

// ─── Helpers ───

function resolveParamAmount(
  charId: string,
  param: { source: string; index: number; multiplier: number },
  talentLevels?: [number, number, number]
): number | null {
  // Map entry source to the skill ("A"/"E"/"Q") exposed by getTalentParam.
  const skill =
    param.source === "A"
      ? "A"
      : param.source === "E" || param.source === "holdE"
        ? "E"
        : param.source === "Q" || param.source === "specialQ"
          ? "Q"
          : null;
  // 1-based talent level (1..15). Index into talent data is level-1.
  // Default talent 10 → levelIndex 9 when no override provided.
  let talentLevel = 10;
  if (talentLevels) {
    if (skill === "A") talentLevel = talentLevels[0];
    else if (skill === "E") talentLevel = talentLevels[1];
    else if (skill === "Q") talentLevel = talentLevels[2];
  }
  const levelIndex = Math.max(0, talentLevel - 1);
  // param.index is 1-based (matches in-game talent description numbering);
  // getTalentParam expects a 0-based index.
  const paramIndex0 = Math.max(0, param.index - 1);
  if (skill) {
    try {
      const base = getTalentParam(charId, skill, levelIndex, paramIndex0);
      if (base != null && Number.isFinite(base)) {
        return base * param.multiplier;
      }
    } catch {
      // Fall through to PARAM_DEFAULTS fallback below.
    }
  }
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

/** Resolve a selfEnergy entry into the per-proc amount (not multiplied by procs).
 *  Engine now spreads procs as subsequent events instead of lumping, so callers
 *  apply the count separately. */
function resolveEntryPerProcFlat(
  entry: SelfEnergyEntry,
  source: TeamMember
): { amountPerProc: number; isErScaling: boolean } | null {
  if (entry.erScale) {
    return {
      amountPerProc: entry.erScale.per100 ?? 0,
      isErScaling: true,
    };
  }
  if (entry.param) {
    const p = resolveParamAmount(source.id, entry.param, source.talentLevels);
    if (p == null) return null;
    return { amountPerProc: p, isErScaling: false };
  }
  if (entry.percentRefund != null) {
    return {
      amountPerProc: (source.burstCost * entry.percentRefund) / 100,
      isErScaling: false,
    };
  }
  if (entry.amount != null) {
    return { amountPerProc: entry.amount, isErScaling: false };
  }
  return null;
}

function resolveRecipients(
  target: string,
  team: TeamMember[],
  sourceId: string,
  onFieldId: string
): TeamMember[] {
  if (target === "self") return team.filter((m) => m.id === sourceId);
  if (target === "party") return [...team];
  if (target === "partyOthers") return team.filter((m) => m.id !== sourceId);
  if (target === "active") return team.filter((m) => m.id === onFieldId);
  return [];
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
  isRepeating: boolean,
  repeatStartIndex = 0
): string {
  if (i + 1 < actions.length) return actions[i + 1].char;
  if (isRepeating) return actions[repeatStartIndex]?.char ?? actions[0].char;
  return actions[i].char;
}

// ─── Simulation state ───

/** A deferred proc waiting to fire on a subsequent matching action.
 *  Used to spread multi-proc entries (e.g. Raiden Q procs=5, Shinobu Q procs=15)
 *  over the attacks that follow the trigger, instead of lumping them all at
 *  the trigger node. */
interface PendingProc {
  remaining: number;
  amount: number;
  isErScaling: boolean;
  sourceChar: string;
  sourceAction: ActionType;
  sourceLabel: string;
}

interface CharSimState {
  particleAccum: number;
  flatAccum: number;
  erScalingAccum: number;
  /** Current NA on-hit pity probability (0–1). Increments each miss, resets on proc or swap-in. */
  naPityProb: number;
  /** Probability that no pity proc has fired yet this cycle (expected mode only). */
  naSurvivalProb: number;
  hitCounts: { NA: number; CA: number; PA: number };
  /** Deferred procs for this recipient; drained on NA/CA/PA actions. */
  pendingProcs: PendingProc[];
  maxER: number;
  maxERParticle: number;
  maxERFlat: number;
  maxERErScaling: number;
  maxERQIndex: number;
  maxEREvents: EnergyEvent[];
  currentEvents: EnergyEvent[];
  qEvaluated: number;
  firstQSkipped: boolean;
  /** Recorded Q / specialQ windows in timeline order. */
  qWindows: QWindow[];
}

function freshState(pityBase: number): CharSimState {
  return {
    particleAccum: 0,
    flatAccum: 0,
    erScalingAccum: 0,
    naPityProb: pityBase,
    naSurvivalProb: 1.0,
    hitCounts: { NA: 0, CA: 0, PA: 0 },
    pendingProcs: [],
    maxER: 0,
    maxERParticle: 0,
    maxERFlat: 0,
    maxERErScaling: 0,
    maxERQIndex: -1,
    maxEREvents: [],
    currentEvents: [],
    qEvaluated: 0,
    firstQSkipped: false,
    qWindows: [],
  };
}

/** Look up a member's NA pity config from their weaponType. */
function resolveNAPityConfig(member: TeamMember): NAPityConfig {
  return NA_PITY[(member.weaponType ?? "").toLowerCase()] ?? NA_PITY_DEFAULT;
}

/**
 * Advance the NA pity state machine for one hit and return the energy earned.
 *
 * - expected: fractional energy via survival-probability tracking.
 * - min:      0 until probability reaches 1.0 (guaranteed), then 1.
 * - max:      always 1 (every hit procs).
 */
function advanceNAPity(
  s: CharSimState,
  cfg: NAPityConfig,
  mode: ParticleMode
): number {
  if (mode === "max") {
    s.naPityProb = cfg.base;
    s.naSurvivalProb = 1.0;
    return 1.0;
  }
  if (mode === "min") {
    if (s.naPityProb >= 1.0) {
      s.naPityProb = cfg.base;
      return 1.0;
    }
    s.naPityProb = Math.min(1.0, s.naPityProb + cfg.increment);
    return 0;
  }
  // expected: contribute survivalProb × currentProb, then advance
  if (s.naPityProb >= 1.0) {
    // Guaranteed proc — consume remaining survival and restart the cycle.
    const energy = s.naSurvivalProb;
    s.naPityProb = cfg.base;
    s.naSurvivalProb = 1.0;
    return energy;
  }
  const energy = s.naSurvivalProb * s.naPityProb;
  s.naSurvivalProb *= 1 - s.naPityProb;
  s.naPityProb = Math.min(1.0, s.naPityProb + cfg.increment);
  return energy;
}

function distributeParticles(
  team: TeamMember[],
  state: Map<string, CharSimState>,
  sourceChar: string,
  sourceAction: ActionType | "periodic" | "favonius" | "electroResonance",
  sourceIndex: number,
  particleCount: number,
  particleElement: string,
  absorber: string,
  offFieldMult: number,
  rotationLength: number,
  artifactScratch: Map<string, Record<string, unknown>>
): void {
  const wrappedIndex =
    rotationLength > 0 ? sourceIndex % rotationLength : sourceIndex;
  for (const m of team) {
    const s = state.get(m.id);
    if (!s) continue;
    const onField = m.id === absorber;
    const mult = onField ? 1.0 : offFieldMult;
    const energy =
      particleCount * elementMatchEnergy(m.element, particleElement) * mult;
    s.particleAccum += energy;
    s.currentEvents.push({
      sourceIndex: wrappedIndex,
      sourceChar,
      sourceAction,
      absorberChar: absorber,
      particleCount,
      particleElement,
      energyAt100: energy,
      onField,
      type: "particle",
    });

    // Artifact 4pc onParticleGain hook — fires for the wearer only, and only
    // when this member has any positive gain. Emitted events feed into the
    // same flat-accum stream as weapon/self-energy events.
    if (particleCount <= 0) continue;
    const impl =
      m.artifactSet?.type === "4pc"
        ? getArtifactEnergyImpl(m.artifactSet.setId)
        : undefined;
    if (!impl?.onParticleGain) continue;
    let scratch = artifactScratch.get(m.id);
    if (!scratch) {
      scratch = {};
      artifactScratch.set(m.id, scratch);
    }
    const gainEvents = impl.onParticleGain({
      wearer: m,
      team,
      particleCount,
      isOrb: false,
      actionIndex: sourceIndex,
      scratch,
    });
    for (const ev of gainEvents) {
      const rs = state.get(ev.recipientId);
      if (!rs) continue;
      rs.flatAccum += ev.amount;
      rs.currentEvents.push({
        sourceIndex: wrappedIndex,
        sourceChar: ev.sourceChar,
        sourceAction: ev.sourceAction,
        absorberChar: ev.recipientId,
        particleCount: 0,
        particleElement: "",
        energyAt100: ev.amount,
        onField: ev.recipientId === absorber,
        type: "flat",
      });
    }
  }
}

/**
 * Flat / erScaling event emitted at a single timeline action, keyed by
 * recipient. Shared by both the simulation (`emitFlatEventsAt`) and the
 * per-node UI popover (`getNodeEnergyEvents`) so there is one source of
 * truth for "what fires at this action".
 *
 * Covered:
 *   - Self-energy entries (param / percentRefund / amount / erScale / procs)
 *   - Party-energy entries (target = party / partyOthers / active)
 *   - Weapon flat-energy (burst / skill trigger)
 *   - Artifact 4pc flat-energy (burst trigger; partyOthers or party)
 *   - grantEnergy timeline nodes (user-defined per-char grants)
 *
 * Not yet modeled (triggers without an action anchor): heal / reaction /
 * onField weapon triggers, Scholar 4pc particleGain. See unimplemented list.
 */
interface FlatEventDescriptor {
  recipientId: string;
  sourceChar: string;
  sourceAction: ActionType | "grantEnergy";
  sourceLabel: string;
  amount: number;
  isErScaling: boolean;
  /** Mirrors `SelfEnergyEntry.procs`: total number of ticks this effect
   *  fires per trigger. When > 1, proc #1 fires at the trigger and the
   *  remaining (procs - 1) are enqueued onto subsequent NA/CA/PA actions. */
  procs?: number;
  /** Free-text condition from the data (conditionEn / conditionZh). */
  conditionEn?: string;
  conditionZh?: string;
}

function collectFlatEventsAt(
  act: TimelineAction,
  team: TeamMember[]
): FlatEventDescriptor[] {
  const out: FlatEventDescriptor[] = [];
  const onFieldId = act.char;

  // 1) grantEnergy node — user-defined grants. Two independent components
  //    per recipient: flat (not ER-scaled) and percent of burst cost
  //    (resolves to flat, not ER-scaled). ER-scalable orb drops are a
  //    separate `enemyOrb` action — handled in the simulation loop, not here.
  if (act.action === "grantEnergy" && act.energyGrants) {
    for (const [recipientId, g] of Object.entries(act.energyGrants)) {
      if (!g) continue;
      const recipient = team.find((m) => m.id === recipientId);
      if (g.flat && g.flat > 0) {
        out.push({
          recipientId,
          sourceChar: act.char,
          sourceAction: "grantEnergy",
          sourceLabel: "Grant",
          amount: g.flat,
          isErScaling: false,
        });
      }
      if (g.percent && g.percent > 0 && recipient) {
        out.push({
          recipientId,
          sourceChar: act.char,
          sourceAction: "grantEnergy",
          sourceLabel: "Grant%",
          amount: (g.percent / 100) * recipient.burstCost,
          isErScaling: false,
        });
      }
    }
    return out;
  }

  const source = team.find((m) => m.id === onFieldId);
  if (!source) return out;

  // 2) Self-energy / party-energy entries that fire when the source performs this action.
  //    Only the first proc is emitted at this node; the remaining (procs-1)
  //    are enqueued as pending procs and drain on subsequent NA/CA/PA actions.
  //    This matches how "over-burst" effects actually work in-game (Raiden Q
  //    ticks per attack, Charlotte Q ticks per drone hit, Shinobu Q ticks per
  //    ring-tick, etc.) rather than lumping all ticks at the trigger moment.
  const entries = allSelfEnergy[source.id] ?? [];
  for (const entry of entries) {
    if ((source.constellation ?? 0) < entry.minC) continue;
    if (!entryMatchesAction(entry.action, act.action)) continue;
    const resolved = resolveEntryPerProcFlat(entry, source);
    if (!resolved || resolved.amountPerProc === 0) continue;
    const entryProcs = entry.procs ?? 1;
    const recipients = resolveRecipients(
      entry.target,
      team,
      source.id,
      onFieldId
    );
    for (const r of recipients) {
      out.push({
        recipientId: r.id,
        sourceChar: source.id,
        sourceAction: act.action,
        sourceLabel: entry.source ?? "passive",
        amount: resolved.amountPerProc,
        isErScaling: resolved.isErScaling,
        procs: entryProcs > 1 ? entryProcs : undefined,
        conditionEn: entry.conditionEn as string | undefined,
        conditionZh: entry.conditionZh as string | undefined,
      });
    }
  }

  // 3) Weapon flat-energy triggers for the source's own weapon.
  //    - burst / skill  → fire at wearer's matching action.
  //    - heal           → fire at the wearer's primary heal action
  //                        (`charInfo.healAction`, default "Q"). Only when the
  //                        wearer is actually a healer (TeamMember.healAction set).
  //    - reaction       → fire when the user toggles `reactionProc` on the
  //                        node (E or Q only).
  //    - partyPlunge    → handled in a second pass below; fires for every plunge
  //                        action in the timeline regardless of who performs it.
  const we = source.weaponId ? weaponEnergyById[source.weaponId] : undefined;
  if (we && we.energy.effect === "flatEnergy") {
    const trig = we.energy.trigger;
    const isBurst = act.action === "Q" || act.action === "specialQ";
    const isSkill =
      act.action === "E" || act.action === "holdE" || act.action === "specialE";
    const healFires =
      trig === "heal" &&
      source.healAction != null &&
      ((source.healAction === "Q" && isBurst) ||
        (source.healAction === "E" && isSkill));
    const reactionFires =
      trig === "reaction" && act.reactionProc === true && (isBurst || isSkill);
    const fires =
      (trig === "burst" && isBurst) ||
      (trig === "skill" && isSkill) ||
      healFires ||
      reactionFires;
    if (fires) {
      out.push({
        recipientId: source.id,
        sourceChar: source.id,
        sourceAction: act.action,
        sourceLabel: source.weaponId ?? "weapon",
        amount: we.energy.totalEnergy[source.refinement ?? 0],
        isErScaling: false,
      });
    }
  }

  // 3b) partyPlunge-triggered weapons (e.g. Crane's Echoing Call) fire for every
  //     plunge action (PA) anywhere in the team.
  if (act.action === "PA") {
    for (const tm of team) {
      const twe = tm.weaponId ? weaponEnergyById[tm.weaponId] : undefined;
      if (!twe || twe.energy.effect !== "flatEnergy") continue;
      if (twe.energy.trigger !== "partyPlunge") continue;
      out.push({
        recipientId: tm.id,
        sourceChar: act.char,
        sourceAction: act.action,
        sourceLabel: tm.weaponId ?? "weapon",
        amount: twe.energy.totalEnergy[tm.refinement ?? 0],
        isErScaling: false,
      });
    }
  }

  // 4) Artifact 4pc — delegate to the set's impl. Each set expresses its own
  //    trigger/target/procs logic (no shared config shape).
  const impl =
    source.artifactSet?.type === "4pc"
      ? getArtifactEnergyImpl(source.artifactSet.setId)
      : undefined;
  if (impl?.onAction) {
    for (const ev of impl.onAction({ act, wearer: source, team })) {
      out.push({
        recipientId: ev.recipientId,
        sourceChar: ev.sourceChar,
        sourceAction: ev.sourceAction,
        sourceLabel: ev.sourceLabel,
        amount: ev.amount,
        isErScaling: false,
        procs: ev.procs,
      });
    }
  }
  return out;
}

function emitFlatEventsAt(
  act: TimelineAction,
  i: number,
  team: TeamMember[],
  state: Map<string, CharSimState>,
  rotationLength: number
): void {
  const wrappedIndex = rotationLength > 0 ? i % rotationLength : i;
  const onFieldId = act.char;

  // Drain one pending proc per recipient if the current action is an attack.
  // This spreads multi-proc effects (procs > 1) across subsequent NA/CA/PA.
  const isAttack =
    act.action === "NA" || act.action === "CA" || act.action === "PA";
  if (isAttack) {
    for (const m of team) {
      const rs = state.get(m.id);
      if (!rs) continue;
      for (const p of rs.pendingProcs) {
        if (p.remaining <= 0) continue;
        p.remaining -= 1;
        if (p.isErScaling) rs.erScalingAccum += p.amount;
        else rs.flatAccum += p.amount;
        rs.currentEvents.push({
          sourceIndex: wrappedIndex,
          sourceChar: p.sourceChar,
          sourceAction: p.sourceAction,
          absorberChar: m.id,
          particleCount: 0,
          particleElement: "",
          energyAt100: p.amount,
          onField: m.id === onFieldId,
          type: p.isErScaling ? "scalable" : "flat",
        });
      }
      rs.pendingProcs = rs.pendingProcs.filter((p) => p.remaining > 0);
    }
  }

  const events = collectFlatEventsAt(act, team);
  for (const ev of events) {
    const rs = state.get(ev.recipientId);
    if (!rs) continue;
    // Fire proc #1 now.
    if (ev.isErScaling) rs.erScalingAccum += ev.amount;
    else rs.flatAccum += ev.amount;
    rs.currentEvents.push({
      sourceIndex: wrappedIndex,
      sourceChar: ev.sourceChar,
      sourceAction: ev.sourceAction as ActionType,
      absorberChar: ev.recipientId,
      particleCount: 0,
      particleElement: "",
      energyAt100: ev.amount,
      onField: ev.recipientId === onFieldId,
      type: ev.isErScaling ? "scalable" : "flat",
    });
    // Enqueue remaining (procs - 1) for subsequent attacks.
    if (ev.procs && ev.procs > 1) {
      rs.pendingProcs.push({
        remaining: ev.procs - 1,
        amount: ev.amount,
        isErScaling: ev.isErScaling,
        sourceChar: ev.sourceChar,
        sourceAction: ev.sourceAction as ActionType,
        sourceLabel: ev.sourceLabel,
      });
    }
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
  rotationLength: number,
  qWindowSources?: Map<number, QWindowSource>,
  sequenceOptions?: ERSequenceOptions & { repeatStartIndex?: number }
): ERResult[] {
  const partySize = team.length;
  const offFieldMult =
    OFF_FIELD_MULTIPLIER[partySize] ?? OFF_FIELD_MULTIPLIER[4];
  const particleMode = options?.particleMode ?? "expected";
  const teamById = new Map(team.map((m) => [m.id, m]));

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

  const hasElectroResonance =
    team.filter((m) => m.element === "Electro").length >= 2;

  const state = new Map<string, CharSimState>();
  for (const m of team) {
    const pityConfig = resolveNAPityConfig(m);
    state.set(m.id, freshState(pityConfig.base));
  }
  if (sequenceOptions?.startFull) {
    for (const m of team) {
      const s = state.get(m.id);
      if (!s || m.burstCost <= 0) continue;
      s.flatAccum += m.burstCost;
      s.currentEvents.push({
        sourceIndex: -1,
        sourceChar: m.id,
        sourceAction: "initialEnergy",
        absorberChar: m.id,
        particleCount: 0,
        particleElement: "",
        energyAt100: m.burstCost,
        onField: true,
        type: "flat",
      });
    }
  }
  const artifactScratch = new Map<string, Record<string, unknown>>();
  const repeatStartIndex = sequenceOptions?.repeatStartIndex ?? 0;
  let prevActChar: string | undefined;

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (!teamById.has(act.char)) continue;

    // ── 0. Swap-in detection — reset incoming character's pity state ──
    if (act.char !== prevActChar) {
      const incoming = state.get(act.char)!;
      const incomingMember = teamById.get(act.char)!;
      const cfg = resolveNAPityConfig(incomingMember);
      incoming.naPityProb = cfg.base;
      incoming.naSurvivalProb = 1.0;
    }
    prevActChar = act.char;

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
            rotationLength,
            artifactScratch
          );
        }
      }
    }

    // ── 2a. Enemy orb drop — 3x particle value, absorbed by the next on-field
    //         char. The action has no source-char
    //         semantics (act.char is just a positioning anchor); skip the
    //         normal per-action / burst / flat-event pipeline entirely. ──
    if (act.action === "enemyOrb") {
      const n = (act.orbCount ?? 0) * ORB_MULTIPLIER;
      if (n > 0) {
        const absorber = getAbsorber(actions, i, isRepeating, repeatStartIndex);
        distributeParticles(
          team,
          state,
          act.char, // positioning anchor; only used for source-attribution display
          "enemyOrb",
          i,
          n,
          act.orbElement ?? "Clear",
          absorber,
          offFieldMult,
          rotationLength,
          artifactScratch
        );
      }
      continue;
    }

    // ── 2. The action itself ──
    const s = state.get(act.char)!;

    // Direct per-cast particles (E / holdE / specialE)
    if (DIRECT_PARTICLE_ACTIONS.has(act.action)) {
      const n = getActionParticles(act.char, act.action, particleMode);
      if (n > 0) {
        const absorber = getAbsorber(actions, i, isRepeating, repeatStartIndex);
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
          rotationLength,
          artifactScratch
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
        const absorber = getAbsorber(actions, i, isRepeating, repeatStartIndex);
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
          rotationLength,
          artifactScratch
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
        const absorber = getAbsorber(actions, i, isRepeating, repeatStartIndex);
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
          rotationLength,
          artifactScratch
        );
      }
    }

    // NA pity energy (matches gcsim SetupOnNormalHitEnergy pity model).
    // Probabilistic: starts at `base`, increments each hit, resets on proc or swap-in.
    // Only the on-field attacker gains this; it is not distributed to off-field members.
    if (act.action === "NA" || act.action === "CA" || act.action === "PA") {
      const member = teamById.get(act.char)!;
      const pityCfg = resolveNAPityConfig(member);
      const pityEnergy = advanceNAPity(s, pityCfg, particleMode);
      if (pityEnergy > 0) {
        s.flatAccum += pityEnergy;
        s.currentEvents.push({
          sourceIndex: rotationLength > 0 ? i % rotationLength : i,
          sourceChar: act.char,
          sourceAction: act.action,
          absorberChar: act.char,
          particleCount: 0,
          particleElement: "",
          energyAt100: pityEnergy,
          onField: true,
          type: "flat",
        });
      }
    }

    // Electro resonance: ≥2 Electro team members → 1 Electro particle on reaction procs.
    // ICD (5 s) is user-controlled via placement of reactionProc nodes.
    if (hasElectroResonance && act.reactionProc) {
      const absorber = getAbsorber(actions, i, isRepeating, repeatStartIndex);
      distributeParticles(
        team,
        state,
        act.char,
        "electroResonance",
        i,
        1,
        "Electro",
        absorber,
        offFieldMult,
        rotationLength,
        artifactScratch
      );
    }

    // ── 3. Per-action flat / erScaling events (self + party + weapon + artifact + grantEnergy) ──
    emitFlatEventsAt(act, i, team, state, rotationLength);

    // ── 4. Burst checkpoint ──
    if (BURST_ACTIONS.has(act.action)) {
      const member = teamById.get(act.char)!;

      if (skipFirstQ && !s.firstQSkipped) {
        s.firstQSkipped = true;
        s.particleAccum = 0;
        s.flatAccum = 0;
        s.erScalingAccum = 0;
        s.currentEvents = [];
        continue;
      }

      if (member.burstCost > 0) {
        const erForQ = solveER(
          member.burstCost,
          s.particleAccum,
          s.flatAccum,
          s.erScalingAccum
        );

        const wrappedQIdx = rotationLength > 0 ? i % rotationLength : i;
        s.qWindows.push({
          qIndex: wrappedQIdx,
          qAction: act.action as "Q" | "specialQ",
          burstCost: member.burstCost,
          erNeeded: erForQ,
          particleEnergy: s.particleAccum,
          scalableEnergy: s.erScalingAccum,
          flatEnergy: s.flatAccum,
          events: [...s.currentEvents],
          source: qWindowSources?.get(i),
          isBinding: false, // set after the loop
        });

        if (erForQ > s.maxER) {
          s.maxER = erForQ;
          s.maxERParticle = s.particleAccum;
          s.maxERFlat = s.flatAccum;
          s.maxERErScaling = s.erScalingAccum;
          s.maxERQIndex = wrappedQIdx;
          s.maxEREvents = [...s.currentEvents];
        }
        s.qEvaluated++;
      }

      s.particleAccum = 0;
      s.flatAccum = 0;
      s.erScalingAccum = 0;
      s.currentEvents = [];
    }
  }

  return team.map((member) => {
    const { id, burstCost } = member;
    const s = state.get(id)!;

    if (burstCost <= 0) {
      return {
        characterId: id,
        erNeeded: 100,
        energyBreakdown: {
          particleEnergy: 0,
          scalableEnergy: 0,
          flatEnergy: 0,
        },
        hasQ: false,
      };
    }

    if (s.qEvaluated === 0) {
      // No burst in the timeline for this char — ER is hypothetical; default
      // to 100% so the results panel shows "no requirement".
      return {
        characterId: id,
        erNeeded: 100,
        energyBreakdown: {
          particleEnergy: 0,
          scalableEnergy: 0,
          flatEnergy: 0,
        },
        hasQ: false,
      };
    }

    const windows = [...s.qWindows];
    // Mark the binding window (the worst — matches s.maxER).
    let bindingMarked = false;
    for (const w of windows) {
      if (!bindingMarked && w.erNeeded === s.maxER) {
        w.isBinding = true;
        bindingMarked = true;
      }
    }

    return {
      characterId: id,
      erNeeded: s.maxER,
      energyBreakdown: {
        particleEnergy: s.maxERParticle,
        scalableEnergy: s.maxERErScaling,
        flatEnergy: s.maxERFlat,
      },
      bindingEvents: s.maxEREvents,
      bindingQIndex: s.maxERQIndex,
      qWindows: windows,
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

/**
 * Calculate ER over an explicit authored sequence. Each Q / specialQ in each
 * segment is retained as its own window; loop repeat checks are represented by
 * adding the loop segment twice.
 */
export function calculateTeamERSequence(
  team: TeamMember[],
  segments: ERCalculationSegment[],
  options?: ERSequenceOptions
): ERResult[] {
  const actions: TimelineAction[] = [];
  const procs: PeriodicProc[] = [];
  const qWindowSources = new Map<number, QWindowSource>();
  let loopStartIndex = 0;
  let hasLoop = false;

  for (const segment of segments) {
    const offset = actions.length;
    if (segment.source.kind === "loop" && !hasLoop) {
      loopStartIndex = offset;
      hasLoop = true;
    }

    segment.timeline.actions.forEach((action, localIndex) => {
      const globalIndex = offset + localIndex;
      actions.push({ ...action });
      if (BURST_ACTIONS.has(action.action)) {
        qWindowSources.set(globalIndex, {
          ...segment.source,
          actionIndex: localIndex,
        } as QWindowSource);
      }
    });

    for (const p of segment.timeline.periodic) {
      procs.push({
        sourceChar: p.sourceChar,
        trigger: p.trigger,
        targetIndex: p.targetIndex + offset,
      });
    }
  }

  return simulateSequence(
    team,
    actions,
    indexProcs(procs),
    { particleMode: options?.particleMode },
    options?.isRepeating ?? false,
    false,
    0,
    qWindowSources,
    { ...options, repeatStartIndex: hasLoop ? loopStartIndex : 0 }
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
  // specialQ is only available for chars with an alternate-burst self-energy entry.
  if ((allSelfEnergy[charId] ?? []).some((e) => e.action === "specialQ")) {
    out.push("specialQ");
  }
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
    talentLevels: slot.talentLevels,
    healAction: slot.healAction,
  };
}

// ─── Per-node energy event lookup (for UI popovers) ───

export interface NodeEnergyEvent {
  /** Short label for display (e.g. "Burst", "P2", "favonius_sword", "gladiators 4pc", "Grant"). */
  sourceLabel: string;
  amount: number;
  /** Recipient charIds. Empty for "drain" (self-only, implicit). */
  recipients: string[];
  category: "drain" | "refund";
  isErScaling?: boolean;
  /** Optional sourceChar — who emits (≠ acting char for partyPlunge / periodic / grant). */
  sourceChar?: string;
  /** Total proc count when > 1; engine spreads them across NA/CA/PA, UI displays "×N". */
  procs?: number;
  /** Free-text conditions from data — displayed verbatim in the popover. */
  conditionEn?: string;
  conditionZh?: string;
}

/**
 * Resolve the set of flat-energy events that fire AT this action node.
 * Shares core logic with `collectFlatEventsAt` so popover and calc agree.
 *
 * Intentionally omits particles — those are shown as flow edges, not node events.
 */
export function getNodeEnergyEvents(
  act: TimelineAction,
  team: TeamMember[]
): NodeEnergyEvent[] {
  const events: NodeEnergyEvent[] = [];
  const actor = team.find((m) => m.id === act.char);

  // Burst drain — shown first in the popover.
  if (
    (act.action === "Q" || act.action === "specialQ") &&
    actor &&
    actor.burstCost > 0
  ) {
    events.push({
      sourceLabel: act.action === "specialQ" ? "Alt burst" : "Burst",
      amount: actor.burstCost,
      recipients: [actor.id],
      category: "drain",
    });
  }

  // Aggregate all flat emissions at this action, grouping by (sourceChar, sourceAction, sourceLabel, isErScaling).
  // A single logical effect (e.g. Venti P2 +15 target=party) emits N descriptors (one per recipient);
  // merge them back here so the popover shows one row with the recipient list.
  const descriptors = collectFlatEventsAt(act, team);
  const grouped = new Map<
    string,
    {
      sourceLabel: string;
      amount: number;
      sourceChar?: string;
      isErScaling: boolean;
      recipients: string[];
      procs?: number;
      conditionEn?: string;
      conditionZh?: string;
    }
  >();
  for (const d of descriptors) {
    const key = `${d.sourceChar}|${d.sourceAction}|${d.sourceLabel}|${d.isErScaling}|${d.amount}|${d.procs ?? 1}`;
    const g = grouped.get(key);
    if (g) {
      g.recipients.push(d.recipientId);
    } else {
      grouped.set(key, {
        sourceLabel: d.sourceLabel,
        amount: d.amount,
        sourceChar: d.sourceChar,
        isErScaling: d.isErScaling,
        recipients: [d.recipientId],
        procs: d.procs,
        conditionEn: d.conditionEn,
        conditionZh: d.conditionZh,
      });
    }
  }
  for (const g of grouped.values()) {
    events.push({
      sourceLabel: g.sourceLabel,
      amount: g.amount,
      recipients: g.recipients,
      category: "refund",
      isErScaling: g.isErScaling,
      sourceChar: g.sourceChar,
      procs: g.procs,
      conditionEn: g.conditionEn,
      conditionZh: g.conditionZh,
    });
  }
  return events;
}

function entryMatchesAction(entryAction: string, action: ActionType): boolean {
  // "A" (wildcard attack) matches any normal-attack family action — NOT every action.
  if (entryAction === "A")
    return action === "NA" || action === "CA" || action === "PA";
  if (entryAction === "Q") return action === "Q" || action === "specialQ";
  if (entryAction === "E")
    return action === "E" || action === "holdE" || action === "specialE";
  return entryAction === action;
}
