import { charInfo } from "@/data/charInfo";
import { getTalentParam } from "@/data/gameStatsLoader";
import { getArtifactEnergyImpl } from "@/lib/ercalc/artifactEnergy";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import {
  ASSUMED_BATTERY_ER,
  allSelfEnergy,
  BURST_ACTIONS,
  CLEAR_PARTICLE,
  DIFF_ELEMENT_PARTICLE,
  DIRECT_PARTICLE_ACTIONS,
  ELECTRO_RESONANCE_ICD,
  ELECTRO_RESONANCE_MEMBERS,
  ELECTRO_RESONANCE_PARTICLES,
  NA_PITY,
  NA_PITY_DEFAULT,
  OFF_FIELD_MULTIPLIER,
  ORB_MULTIPLIER,
  PARAM_DEFAULTS,
  PATTERN_ACTIONS,
  particles as particlesData,
  RESONANCE_PARTY_SIZE,
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

export function getBurstCostForAction(
  member: Pick<TeamMember, "burstCost" | "specialBurstCost">,
  action: ActionType
): number {
  if (action === "specialQ" && member.specialBurstCost != null) {
    return member.specialBurstCost;
  }
  return member.burstCost;
}

/**
 * Seconds an action occupies on the timeline's ordinal clock.
 *
 * This is a *feasibility* clock, not a simulation clock: it exists so that
 * cooldown-gated effects (weapon energy, self-energy entries, Electro
 * Resonance's 5s ICD, Favonius alignment in the optimizer) can be spaced
 * plausibly. One definition, so the engine and the optimizer cannot drift.
 */
export function actionDuration(action: ActionType): number {
  if (action === "Q" || action === "specialQ") return 1.5;
  if (action === "E" || action === "holdE" || action === "specialE") return 1.0;
  if (action === "wait") return 1.0;
  return 0.5;
}

function hasAnyBurstCost(member: TeamMember): boolean {
  return member.burstCost > 0 || (member.specialBurstCost ?? 0) > 0;
}

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
  source: TeamMember,
  action: ActionType
): { amountPerProc: number; isErScaling: boolean; erScaleMax?: number } | null {
  if (entry.erScale) {
    // "Restore X Energy for every 100% Energy Recharge <the giver> has."
    // Resolved to a constant at the assumed battery ER rather than solved
    // against the recipient's ER. Capping here also makes the cap PER CAST,
    // which is what the kits say ("per Troubleshooter Cannon, a maximum of
    // 15 Energy can be restored this way") — summing procs into one bucket
    // and capping the total understated repeat rotations.
    const per100 = entry.erScale.per100 ?? 0;
    const raw = (per100 * ASSUMED_BATTERY_ER) / 100;
    return {
      amountPerProc:
        entry.erScale.max !== undefined
          ? Math.min(entry.erScale.max, raw)
          : raw,
      // Display tag only — the solver treats this as a constant.
      isErScaling: true,
    };
  }
  // "Each 1% ER above 100% grants N% greater Energy restoration" (Raiden A4).
  // Multiplies whatever the entry would otherwise pay, at the assumed ER.
  const erBoost = entry.erMultiplier
    ? 1 + entry.erMultiplier.perPercentOver100 * (ASSUMED_BATTERY_ER - 100)
    : 1;

  if (entry.param) {
    const p = resolveParamAmount(source.id, entry.param, source.talentLevels);
    if (p == null) return null;
    return {
      amountPerProc: p * erBoost,
      isErScaling: entry.erMultiplier != null,
    };
  }
  if (entry.percentRefund != null) {
    const burstCost = getBurstCostForAction(source, action);
    return {
      amountPerProc: ((burstCost * entry.percentRefund) / 100) * erBoost,
      isErScaling: entry.erMultiplier != null,
    };
  }
  if (entry.amount != null) {
    return {
      amountPerProc: entry.amount * erBoost,
      isErScaling: entry.erMultiplier != null,
    };
  }
  return null;
}

function resolveRecipients(
  target: string,
  team: TeamMember[],
  sourceId: string,
  onFieldId: string,
  targetElement?: string
): TeamMember[] {
  const byElement = targetElement
    ? team.filter((m) => m.element === targetElement)
    : team;
  if (target === "self") return byElement.filter((m) => m.id === sourceId);
  if (target === "party") return [...byElement];
  if (target === "partyOthers")
    return byElement.filter((m) => m.id !== sourceId);
  if (target === "active") return byElement.filter((m) => m.id === onFieldId);
  return [];
}

// ─── Solver ───

function erScalingContribution(
  ER: number,
  erScalingSources: Record<string, { per100: number; max?: number }>
): number {
  // These terms were already resolved to concrete energy at ASSUMED_BATTERY_ER
  // (and capped per cast) when they were emitted, because they scale with the
  // GIVER's ER, not the recipient's. They are constants in this solve — the
  // `ER` argument is deliberately unused.
  void ER;
  let contrib = 0;
  for (const s of Object.values(erScalingSources)) {
    contrib += Math.max(0, s.per100);
  }
  return contrib;
}

function solveER(
  burstCost: number,
  particleEnergy: number,
  flatEnergy: number,
  erScalingSources: Record<string, { per100: number; max?: number }>
): number {
  const needed = burstCost - flatEnergy;
  if (needed <= 0) return 100;

  // Check if base ER 100% is enough
  if (needed <= erScalingContribution(100, erScalingSources) + particleEnergy) {
    return 100;
  }

  // Binary search for ER% in [100, 1000]
  let low = 100;
  let high = 1000;

  const check = (erVal: number) => {
    const scale = erScalingContribution(erVal, erScalingSources);
    const part = particleEnergy * (erVal / 100);
    return scale + part;
  };

  if (check(high) < needed) {
    high = 5000; // expand search space if needed
    if (check(high) < needed) {
      return Number.POSITIVE_INFINITY; // unsolvable
    }
  }

  for (let iter = 0; iter < 50; iter++) {
    const mid = (low + high) / 2;
    if (check(mid) >= needed) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
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
  // `enemyOrb` and `grantEnergy` are pseudo-nodes: nobody swaps in to perform
  // them, and their `char` is only a positioning anchor (the UI pins it to
  // team slot 1). They must not capture the previous action's particles, so
  // scan past them to the next real on-field action.
  for (let j = i + 1; j < actions.length; j++) {
    if (!isPseudoNode(actions[j])) return actions[j].char;
  }
  if (isRepeating) {
    for (let j = repeatStartIndex; j <= i; j++) {
      if (!isPseudoNode(actions[j])) return actions[j].char;
    }
  }
  // One-shot tail, or an all-pseudo wrap: the emitter catches its own particles.
  return actions[i].char;
}

function wrappedIndexOf(i: number, rotationLength: number): number {
  return rotationLength > 0 ? i % rotationLength : i;
}

/**
 * Pay out every tick still queued for `s` and clear the queue.
 *
 * Called when a burst window closes so that a multi-proc effect always
 * delivers `amount x procs` in total, regardless of how many attack nodes the
 * user happened to author after its trigger.
 */
function flushPendingProcs(
  s: CharSimState,
  payeeId: string,
  sourceIndex: number
): void {
  for (const p of s.pendingProcs) {
    if (p.remaining <= 0) continue;
    const total = p.amount * p.remaining;
    if (p.isErScaling) {
      s.erScalingAccum += total;
      const key = `${p.sourceChar}:${p.sourceLabel}`;
      if (!s.erScalingSources[key]) {
        s.erScalingSources[key] = { per100: 0, max: p.erScaleMax };
      }
      s.erScalingSources[key].per100 += total;
    } else {
      s.flatAccum += total;
    }
    s.currentEvents.push({
      sourceIndex,
      sourceChar: p.sourceChar,
      sourceAction: p.sourceAction,
      absorberChar: payeeId,
      particleCount: 0,
      particleElement: "",
      energyAt100: total,
      onField: true,
      type: p.isErScaling ? "scalable" : "flat",
      erScaleMax: p.isErScaling ? p.erScaleMax : undefined,
    });
  }
  s.pendingProcs = [];
}

/** Timeline entries that deliver energy but do not put anyone on field. */
function isPseudoNode(act: TimelineAction | undefined): boolean {
  return act?.action === "enemyOrb" || act?.action === "grantEnergy";
}

// ─── Simulation state ───

/** A deferred proc waiting to fire on a subsequent matching action.
 *  Used to spread multi-proc entries (e.g. Raiden Q procs=5, Shinobu Q procs=15)
 *  over the attacks that follow the trigger, instead of lumping them all at
 *  the trigger node. */
interface PendingProc {
  remaining: number;
  /** Entry targeted the ACTIVE character. The recipient must be resolved when
   *  the tick lands, not when the trigger fired — a battery casts and swaps
   *  out, so later ticks belong to whoever is on field then. */
  targetActive?: boolean;
  amount: number;
  isErScaling: boolean;
  erScaleMax?: number;
  sourceChar: string;
  sourceAction: ActionType;
  sourceLabel: string;
}

interface CharSimState {
  particleAccum: number;
  flatAccum: number;
  erScalingAccum: number;
  erScalingSources: Record<string, { per100: number; max?: number }>;
  weaponLastFireTime: number;
  /** Current NA on-hit pity probability (0–1). Increments each miss, resets on proc or swap-in. */
  /** Distribution over the NA on-hit pity counter: `naPityDist[k]` is the
   *  probability that exactly k consecutive non-proc hits have accumulated.
   *  A single scalar cannot express this — tracking only the first proc's
   *  survival probability computes P(at least one proc), not E[procs], which
   *  saturates at ~1 energy per pity cycle. Resets to [1] on swap-in. */
  naPityDist: number[];
  hitCounts: { NA: number; CA: number; PA: number };
  /** Deferred procs for this recipient; drained on NA/CA/PA actions. */
  pendingProcs: PendingProc[];
  /** How many times each per-hit ("A"-anchored) energy source has already
   *  fired for this recipient in the current burst window, keyed by
   *  `sourceChar:sourceLabel`. Caps effects like Wanderer P1 at their stated
   *  proc count instead of firing on every attack node forever. */
  perHitProcCounts: Record<string, number>;
  /** Clock time at which each self-energy source last paid THIS recipient,
   *  keyed by `sourceChar:sourceLabel`. Gates the start of a new proc-train
   *  against the entry's `cooldown`. Deliberately NOT cleared at a burst
   *  window — a cooldown spans windows. */
  selfEnergyLastFire: Record<string, number>;
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

function freshState(): CharSimState {
  return {
    particleAccum: 0,
    flatAccum: 0,
    erScalingAccum: 0,
    erScalingSources: {},
    weaponLastFireTime: -999,
    naPityDist: [1],
    hitCounts: { NA: 0, CA: 0, PA: 0 },
    pendingProcs: [],
    perHitProcCounts: {},
    selfEnergyLastFire: {},
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
    s.naPityDist = [1];
    return 1.0;
  }
  // Expected: one step of the renewal process. Mass at pity index k procs with
  // probability p_k and returns to index 0; the rest advances to k+1. Summing
  // the procced mass over hits gives E[procs], and because mass returns to 0
  // rather than being consumed, a long attack chain keeps earning energy.
  const dist = s.naPityDist;
  const next: number[] = [];
  let energy = 0;
  let reset = 0;
  for (let k = 0; k < dist.length; k++) {
    const mass = dist[k];
    if (mass <= 0) continue;
    const p = Math.min(1, cfg.base + k * cfg.increment);
    const procced = mass * p;
    energy += procced;
    reset += procced;
    const survived = mass - procced;
    if (survived > 0) next[k + 1] = (next[k + 1] ?? 0) + survived;
  }
  next[0] = (next[0] ?? 0) + reset;
  for (let k = 0; k < next.length; k++) next[k] ??= 0;
  s.naPityDist = next;
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
  /** The weapon's wearer, for cooldown bookkeeping. Distinct from both
   *  `recipientId` (Frostbreath pays teammates) and `sourceChar`
   *  (partyPlunge is triggered by whoever plunged), so neither of those can
   *  stand in for it. */
  wearerId?: string;
  /** True when the source entry used `target: "active"`. */
  targetActive?: boolean;
  sourceChar: string;
  sourceAction: ActionType | "grantEnergy";
  sourceLabel: string;
  amount: number;
  isErScaling: boolean;
  erScaleMax?: number;
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
  team: TeamMember[],
  /** Simulation state, when running a rotation. Omitted by the UI's
   *  single-node preview, which has no rotation context and therefore does not
   *  enforce per-rotation hit caps. */
  state?: Map<string, CharSimState>,
  /** Per-wearer artifact scratch, for sets that track their own cooldown. */
  artifactScratch?: Map<string, Record<string, unknown>>,
  /** Ordinal clock at this node. Omitted by the UI preview, which has no
   *  rotation context and therefore enforces no cooldowns. */
  currentTime?: number
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

  // 2) Self-energy / party-energy entries that fire when the source performs
  //    this action. `procs` means two different things depending on the anchor:
  //
  //    - Anchor "A" (wildcard attack): a PER-HIT effect, and `procs` is the cap
  //      on how many hits may trigger it (Wanderer P1's 0.8/attack, Ororon P2).
  //      It fires once at this node and enqueues nothing — enqueuing here would
  //      stack a fresh queue entry at every attack node while the drain pays one
  //      tick out of every live entry, compounding as amount x N(N+1)/2.
  //
  //    - Anchor E/Q: ONE trigger that ticks `procs` times over the attacks that
  //      follow (Raiden Q ticks per attack, Shinobu Q per ring-tick). Only the
  //      first proc is emitted here; the rest drain on subsequent NA/CA/PA.
  //
  //    `cooldown` gates the TRIGGER against the ordinal clock, per
  //    (source, entry, recipient) — see the per-recipient loop below.
  const entries = allSelfEnergy[source.id] ?? [];
  for (const entry of entries) {
    if ((source.constellation ?? 0) < entry.minC) continue;
    if (!entryMatchesAction(entry, act.action, entries)) continue;
    const resolved = resolveEntryPerProcFlat(entry, source, act.action);
    if (!resolved || resolved.amountPerProc === 0) continue;
    const entryProcs = entry.procs ?? 1;
    const isPerHit = entry.action === "A";
    const key = `${source.id}:${entry.source ?? "passive"}`;
    const recipients = resolveRecipients(
      entry.target,
      team,
      source.id,
      onFieldId,
      entry.targetElement as string | undefined
    );
    for (const r of recipients) {
      const rs = state?.get(r.id);
      if (state && !rs) continue;
      // `cooldown` gates whether a NEW proc-train may start. For an E/Q anchor
      // the trigger is the cast itself. For an "A" anchor the train is the run
      // of hits up to `procs`, whose cap already encodes the effect's
      // duration/ICD arithmetic — re-gating every hit would double-suppress
      // and pay less than the verified total, so only the first hit of a train
      // is checked.
      const midTrain =
        isPerHit && rs != null && (rs.perHitProcCounts[key] ?? 0) > 0;
      if (
        rs &&
        currentTime != null &&
        entry.cooldown != null &&
        !midTrain &&
        currentTime - (rs.selfEnergyLastFire[key] ?? Number.NEGATIVE_INFINITY) <
          entry.cooldown
      ) {
        continue;
      }
      if (isPerHit && rs) {
        // Enforce the per-rotation hit cap on the recipient's own counter.
        const fired = rs.perHitProcCounts[key] ?? 0;
        if (fired >= entryProcs) continue;
        rs.perHitProcCounts[key] = fired + 1;
      }
      if (rs && currentTime != null) rs.selfEnergyLastFire[key] = currentTime;
      out.push({
        recipientId: r.id,
        targetActive: entry.target === "active",
        sourceChar: source.id,
        sourceAction: act.action,
        sourceLabel: entry.source ?? "passive",
        amount: resolved.amountPerProc,
        isErScaling: resolved.isErScaling,
        erScaleMax: resolved.erScaleMax,
        procs: !isPerHit && entryProcs > 1 ? entryProcs : undefined,
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
      // Most energy weapons pay their wearer; Frostbreath pays the wearer's
      // teammates instead.
      const recipients =
        we.energy.target === "partyOthers"
          ? team.filter((m) => m.id !== source.id)
          : [source];
      for (const r of recipients) {
        out.push({
          recipientId: r.id,
          wearerId: source.id,
          sourceChar: source.id,
          sourceAction: act.action,
          sourceLabel: source.weaponId ?? "weapon",
          amount: we.energy.totalEnergy[source.refinement ?? 0],
          isErScaling: false,
        });
      }
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
        wearerId: tm.id,
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
    const scratch = artifactScratch
      ? (artifactScratch.get(source.id) ??
        (() => {
          const fresh: Record<string, unknown> = {};
          artifactScratch.set(source.id, fresh);
          return fresh;
        })())
      : {};
    for (const ev of impl.onAction({ act, wearer: source, team, scratch })) {
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
  rotationLength: number,
  currentTime: number,
  artifactScratch?: Map<string, Record<string, unknown>>
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
        // An "active"-targeted tick belongs to whoever is on field when it
        // lands, not to the character who triggered it. Dori casts her lamp
        // and swaps out; the ticks fund the carry, not Dori.
        const payeeId = p.targetActive ? onFieldId : m.id;
        const ps = p.targetActive ? state.get(payeeId) : rs;
        if (!ps) continue;
        if (p.isErScaling) {
          ps.erScalingAccum += p.amount;
          const key = `${p.sourceChar}:${p.sourceLabel}`;
          if (!ps.erScalingSources[key]) {
            ps.erScalingSources[key] = { per100: 0, max: p.erScaleMax };
          }
          ps.erScalingSources[key].per100 += p.amount;
        } else {
          ps.flatAccum += p.amount;
        }
        ps.currentEvents.push({
          sourceIndex: wrappedIndex,
          sourceChar: p.sourceChar,
          sourceAction: p.sourceAction,
          absorberChar: payeeId,
          particleCount: 0,
          particleElement: "",
          energyAt100: p.amount,
          onField: payeeId === onFieldId,
          type: p.isErScaling ? "scalable" : "flat",
          erScaleMax: p.isErScaling ? p.erScaleMax : undefined,
        });
      }
      rs.pendingProcs = rs.pendingProcs.filter((p) => p.remaining > 0);
    }
  }

  const events = collectFlatEventsAt(
    act,
    team,
    state,
    artifactScratch,
    currentTime
  );
  for (const ev of events) {
    const rs = state.get(ev.recipientId);
    if (!rs) continue;

    // Check weapon cooldown if applicable
    const we = weaponEnergyById[ev.sourceLabel];
    if (
      we &&
      we.energy.effect === "flatEnergy" &&
      we.energy.cooldown !== undefined
    ) {
      // The cooldown belongs to the weapon's WEARER — not to whoever
      // performed the triggering action (partyPlunge fires on any teammate's
      // plunge) and not to the recipient (Frostbreath pays teammates).
      const wearerState = state.get(ev.wearerId ?? ev.recipientId);
      if (wearerState) {
        // A single trigger can emit one event per recipient (Frostbreath pays
        // every teammate). Those siblings share this instant, so only a
        // *later* node is subject to the cooldown.
        const alreadyFiredThisInstant =
          wearerState.weaponLastFireTime === currentTime;
        if (
          !alreadyFiredThisInstant &&
          currentTime - wearerState.weaponLastFireTime < we.energy.cooldown
        ) {
          // Trigger is on cooldown! Skip this event.
          continue;
        }
        wearerState.weaponLastFireTime = currentTime;
      }
    }

    // Fire proc #1 now.
    if (ev.isErScaling) {
      rs.erScalingAccum += ev.amount;
      const key = `${ev.sourceChar}:${ev.sourceLabel}`;
      if (!rs.erScalingSources[key]) {
        rs.erScalingSources[key] = { per100: 0, max: ev.erScaleMax };
      }
      rs.erScalingSources[key].per100 += ev.amount;
    } else {
      rs.flatAccum += ev.amount;
    }
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
      erScaleMax: ev.isErScaling ? ev.erScaleMax : undefined,
    });
    // Enqueue remaining (procs - 1) for subsequent attacks.
    if (ev.procs && ev.procs > 1) {
      rs.pendingProcs.push({
        remaining: ev.procs - 1,
        targetActive: ev.targetActive,
        amount: ev.amount,
        isErScaling: ev.isErScaling,
        erScaleMax: ev.erScaleMax,
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

  // Elemental Resonance requires a FULL party — a 3-man team with two Electro
  // members gets nothing in game, and the engine used to pay it anyway.
  const hasElectroResonance =
    partySize === RESONANCE_PARTY_SIZE &&
    team.filter((m) => m.element === "Electro").length >=
      ELECTRO_RESONANCE_MEMBERS;

  const state = new Map<string, CharSimState>();
  for (const m of team) {
    state.set(m.id, freshState());
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
  let currentTime = 0;
  /** Team-wide: High Voltage's ICD is shared, not per character. */
  let lastResonanceTime = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (!teamById.has(act.char)) continue;

    // ── 0. Swap-in detection — reset incoming character's pity state ──
    // Pseudo-nodes do not put anyone on field, so they neither trigger a swap
    // nor change who is considered on field for the nodes that follow.
    if (!isPseudoNode(act)) {
      if (act.char !== prevActChar) {
        const incoming = state.get(act.char)!;
        incoming.naPityDist = [1];
      }
      prevActChar = act.char;
    }

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

    // Electro Resonance (High Voltage): a full party with 2+ Electro members
    // generates 1 Electro particle when a party member's attack triggers an
    // Electro-related reaction, with a 5s ICD.
    //
    // Gated on its own `resonanceProc` flag, NOT on `reactionProc`:
    // `reactionProc` is a weapon flag the UI only offers to wearers of a
    // reaction-trigger weapon, so resonance used to be unreachable for a
    // Raiden/Fischl pair holding anything else, while a Lumidouce Elegy
    // wielder collected a free ICD-less particle at every skill node.
    if (
      hasElectroResonance &&
      act.resonanceProc &&
      currentTime - lastResonanceTime >= ELECTRO_RESONANCE_ICD
    ) {
      lastResonanceTime = currentTime;
      const absorber = getAbsorber(actions, i, isRepeating, repeatStartIndex);
      distributeParticles(
        team,
        state,
        act.char,
        "electroResonance",
        i,
        ELECTRO_RESONANCE_PARTICLES,
        "Electro",
        absorber,
        offFieldMult,
        rotationLength,
        artifactScratch
      );
    }

    // ── 3. Burst checkpoint ──
    // Closes BEFORE this node's flat energy is emitted. Burst-triggered
    // refunds (Tartaglia Q, Jean A4, Venti A4, Amenoma, Prototype Amber, …)
    // are post-cast effects in game, so they must fund the NEXT burst rather
    // than the one that produced them. Particles are distributed in steps 1-2
    // above and still count toward the window this Q closes — you catch the
    // particle, then you burst.
    if (BURST_ACTIONS.has(act.action)) {
      const member = teamById.get(act.char)!;

      // Deliver any ticks still queued for this character before the window
      // closes. Without this, a multi-proc effect pays out only as many ticks
      // as there happen to be attack nodes after its trigger — a swap-only
      // support rotation delivered 2 of The Exile 4pc's 6 energy — and the
      // leftovers survive into the next loop iteration and double-deliver
      // there. Flushing makes the total invariant to rotation shape.
      flushPendingProcs(s, act.char, wrappedIndexOf(i, rotationLength));

      // In full-energy-repeat the first Q is free (the party starts charged),
      // so it opens a window instead of closing one.
      const isSkippedFirstQ = skipFirstQ && !s.firstQSkipped;
      if (isSkippedFirstQ) s.firstQSkipped = true;

      if (!isSkippedFirstQ) {
        const burstCost = getBurstCostForAction(member, act.action);
        if (burstCost > 0) {
          const erForQ = solveER(
            burstCost,
            s.particleAccum,
            s.flatAccum,
            s.erScalingSources
          );

          const wrappedQIdx = rotationLength > 0 ? i % rotationLength : i;
          s.qWindows.push({
            qIndex: wrappedQIdx,
            qAction: act.action as "Q" | "specialQ",
            burstCost,
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
      }

      s.particleAccum = 0;
      s.flatAccum = 0;
      s.erScalingAccum = 0;
      s.erScalingSources = {};
      s.currentEvents = [];
      s.perHitProcCounts = {};
    }

    // ── 4. Per-action flat / erScaling events (self + party + weapon + artifact + grantEnergy) ──
    emitFlatEventsAt(
      act,
      i,
      team,
      state,
      rotationLength,
      currentTime,
      artifactScratch
    );

    currentTime += actionDuration(act.action);
  }

  return team.map((member) => {
    const { id } = member;
    const s = state.get(id)!;

    if (!hasAnyBurstCost(member)) {
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
  const selfEnergyActions = new Set(
    (allSelfEnergy[charId] ?? []).map((e) => e.action)
  );
  const out: ActionType[] = ["E"];
  if (data?.holdE || selfEnergyActions.has("holdE")) out.push("holdE");
  if (data?.specialE || selfEnergyActions.has("specialE")) out.push("specialE");
  out.push("Q");
  // specialQ is available when the char has alternate-burst cost data or
  // alternate-burst self-energy data.
  if (
    charInfo[charId]?.specialBurstCost != null ||
    (allSelfEnergy[charId] ?? []).some((e) => e.action === "specialQ")
  ) {
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
    specialBurstCost: slot.specialBurstCost,
    constellation: slot.constellation,
    weaponId: slot.weaponId,
    refinement: slot.refinement,
    artifactSet: slot.artifactSet,
    weaponType: slot.weaponType,
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
  const actorBurstCost = actor ? getBurstCostForAction(actor, act.action) : 0;
  if (
    (act.action === "Q" || act.action === "specialQ") &&
    actor &&
    actorBurstCost > 0
  ) {
    events.push({
      sourceLabel: act.action === "specialQ" ? "Alt burst" : "Burst",
      amount: actorBurstCost,
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

function entryMatchesAction(
  entry: SelfEnergyEntry,
  action: ActionType,
  allEntries: SelfEnergyEntry[]
): boolean {
  const entryAction = entry.action;
  if (
    ((entryAction === "E" && (action === "holdE" || action === "specialE")) ||
      (entryAction === "Q" && action === "specialQ")) &&
    allEntries.some(
      (other) => other.source === entry.source && other.action === action
    )
  ) {
    return false;
  }

  // "A" (wildcard attack) matches any normal-attack family action — NOT every action.
  if (entryAction === "A")
    return action === "NA" || action === "CA" || action === "PA";
  if (entryAction === "Q") return action === "Q" || action === "specialQ";
  if (entryAction === "E")
    return action === "E" || action === "holdE" || action === "specialE";
  return entryAction === action;
}
