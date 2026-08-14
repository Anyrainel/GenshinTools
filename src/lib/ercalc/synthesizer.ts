import { charInfo } from "@/data/charInfo";
import {
  PERIODIC_E_TRIGGERS,
  PERIODIC_Q_TRIGGERS,
  particles,
} from "./constants";
import type { ERTimeline, PeriodicProc, TimelineAction } from "./types";

export interface FunnelIntent {
  /** Character producing the particles (e.g., "bennett"). */
  sourceCharId: string;
  /** Character designated to absorb the particles on-field (e.g., "xiangling"). */
  targetCharId: string;
  /** Optional. If specified, applies only to the N-th skill cast (0-indexed). */
  castIndex?: number;
}

export interface HighLevelRotation {
  teamCharIds: string[];
  /** Total cast counts per rotation. */
  casts: Record<
    string,
    {
      skillCount: number; // maps to E / holdE
      burstCount: number; // maps to Q / specialQ
      normalAttackCount?: number; // approx NAs executed (for driver or battery)
    }
  >;
  /** Funneling rules. Unspecified E's default to self-absorption. */
  funnels: FunnelIntent[];
  /** The character who acts as the primary on-field driver (receives remaining time/NAs). */
  driverCharId?: string;
}

/**
 * Swap-order classes, played lowest-first.
 *
 * Derived per character from `charInfo` (healer / shielder flags, burst cost),
 * the particle DB (`periodic` generation) and the declared funnel intents —
 * never from a name list, which silently misplaces every character released
 * after it was written.
 *
 * Shields and sustain go up first because they are prerequisites for everyone
 * else's field time; declared batteries follow so their particles land on
 * characters that have not burst yet; summon deployers come next so their ticks
 * have on-field actions left to be absorbed by; the on-field carry is last, and
 * the driver is pinned to the very end.
 */
const ORDER_SHIELDER = 0;
const ORDER_SUSTAIN = 1;
const ORDER_BATTERY = 2;
const ORDER_OFF_FIELD = 3;
const ORDER_ON_FIELD = 4;
const ORDER_DRIVER = 5;

function swapOrderClass(
  charId: string,
  isFunnelSource: boolean,
  isDriver: boolean
): number {
  if (isDriver) return ORDER_DRIVER;
  const info = charInfo[charId];
  if (info?.shielderC !== undefined) return ORDER_SHIELDER;
  if (info?.healerC !== undefined) return ORDER_SUSTAIN;
  if (isFunnelSource) return ORDER_BATTERY;
  if (particles[charId]?.periodic) return ORDER_OFF_FIELD;
  return ORDER_ON_FIELD;
}

/**
 * Deterministic play order. Within a class the cheaper burst goes first: a
 * character's Q window collects everything generated between the rotation
 * start and their own Q, so the expensive burst wants to sit as late as it can.
 * Ties fall back to the team slot order the user authored.
 */
function resolveSwapOrder(input: HighLevelRotation): string[] {
  const funnelSources = new Set(input.funnels.map((f) => f.sourceCharId));
  return input.teamCharIds
    .map((charId, index) => ({
      charId,
      index,
      cls: swapOrderClass(
        charId,
        funnelSources.has(charId),
        charId === input.driverCharId
      ),
      burstCost: charInfo[charId]?.energy ?? 0,
    }))
    .sort(
      (a, b) => a.cls - b.cls || a.burstCost - b.burstCost || a.index - b.index
    )
    .map((entry) => entry.charId);
}

function countOf(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/**
 * Split `total` driver normal attacks over the gaps between character phases.
 * The remainder lands in the trailing gaps, where the driver genuinely holds
 * the field the longest. Every gap is a swap, which is what resets NA pity —
 * appending the whole block at the end instead would model one uninterrupted
 * attack chain that nobody actually plays.
 */
function distributeDriverNAs(total: number, gapCount: number): number[] {
  if (gapCount <= 0) return [];
  const base = Math.floor(total / gapCount);
  const remainder = total % gapCount;
  return Array.from(
    { length: gapCount },
    (_, gap) => base + (gap >= gapCount - remainder ? 1 : 0)
  );
}

/**
 * Spread `count` procs forward over the actions that follow `triggerIndex`.
 *
 * Never before the trigger — a summon cannot tick before it is deployed — and
 * never wrapping back to the head of the rotation. When there are more procs
 * than following slots the extras double up evenly instead of piling onto the
 * final index.
 */
function spreadProcTargets(
  triggerIndex: number,
  count: number,
  actionCount: number
): number[] {
  const span = actionCount - 1 - triggerIndex;
  const targets: number[] = [];
  for (let k = 1; k <= count; k++) {
    if (span <= 0) {
      // The trigger is the last action: there is nowhere later to place the
      // tick, so the caster absorbs it themselves.
      targets.push(triggerIndex);
      continue;
    }
    const offset = Math.min(span, Math.max(1, Math.round((k * span) / count)));
    targets.push(triggerIndex + offset);
  }
  return targets;
}

/**
 * Compiles a high-level rotation specification into a concrete ERTimeline
 * containing discrete actions and auto-placed periodic particle procs.
 *
 * Each character plays `E -> (funnel or self wait) -> Q`. There is deliberately
 * no Q-first override list: the whole point of the skill is to put particles in
 * the bank before the burst spends it, and even kits played around their burst
 * state (Cyno, Ayato) press the skill first for exactly that reason. If a
 * genuinely Q-first kit ever shows up, it belongs here as a documented
 * exception, not as a default.
 *
 * A character asked for N bursts plays N sub-phases, each with a share of their
 * skill casts, so the second burst has a window of its own to collect energy in
 * rather than being emitted back-to-back with the first.
 */
export function compileHighLevelRotation(input: HighLevelRotation): ERTimeline {
  const { teamCharIds, casts, driverCharId } = input;
  const swapOrder = resolveSwapOrder(input);

  // Map of funnel rules: "sourceCharId_castIndex" -> targetCharId
  const funnelMap = new Map<string, string>();
  for (const f of input.funnels) {
    funnelMap.set(`${f.sourceCharId}_${f.castIndex ?? 0}`, f.targetCharId);
  }

  const skillIdx: Record<string, number> = {};
  /** Bursts still owed, so a burst pulled forward onto a funnel is not re-emitted. */
  const pendingBursts: Record<string, number> = {};
  for (const charId of teamCharIds) {
    skillIdx[charId] = 0;
    pendingBursts[charId] = countOf(casts[charId]?.burstCount);
  }
  const hasDeployedSkill = new Set<string>();

  // Step 1: one block per character — skills first, then their burst(s).
  const blocks: TimelineAction[][] = [];
  for (const charId of swapOrder) {
    const charCasts = casts[charId];
    if (!charCasts) continue;

    const skills = countOf(charCasts.skillCount);
    const subPhases = Math.max(1, countOf(charCasts.burstCount));
    const block: TimelineAction[] = [];

    for (let phase = 0; phase < subPhases; phase++) {
      // Front-load the skill casts so the first burst is the best funded one.
      const share =
        Math.floor(skills / subPhases) + (phase < skills % subPhases ? 1 : 0);

      for (let s = 0; s < share; s++) {
        block.push({ char: charId, action: "E" });
        hasDeployedSkill.add(charId);
        const targetChar = funnelMap.get(`${charId}_${skillIdx[charId]++}`);

        if (
          targetChar &&
          targetChar !== charId &&
          teamCharIds.includes(targetChar)
        ) {
          // Swap to the target so they absorb the particles on-field.
          block.push({ char: targetChar, action: "wait" });
          // Prefunnel: spend the freshly caught particles immediately, but only
          // once the target has their own skill down — otherwise this would
          // recreate the burst-before-skill pattern the linter flags.
          if (
            hasDeployedSkill.has(targetChar) &&
            pendingBursts[targetChar] > 0
          ) {
            block.push({ char: targetChar, action: "Q" });
            pendingBursts[targetChar]--;
          }
        } else {
          block.push({ char: charId, action: "wait" });
        }
      }

      if (pendingBursts[charId] > 0) {
        block.push({ char: charId, action: "Q" });
        pendingBursts[charId]--;
      }
    }

    if (block.length > 0) blocks.push(block);
  }

  // Step 2: interleave the driver's normal attacks between character phases.
  const driver =
    driverCharId && teamCharIds.includes(driverCharId)
      ? driverCharId
      : undefined;
  const driverNAs = driver ? countOf(casts[driver]?.normalAttackCount) : 0;
  const naPerGap = distributeDriverNAs(driverNAs, blocks.length);

  const actions: TimelineAction[] = [];
  for (let b = 0; b < blocks.length; b++) {
    actions.push(...blocks[b]);
    if (!driver) continue;
    for (let n = 0; n < naPerGap[b]; n++) {
      actions.push({ char: driver, action: "NA" });
    }
  }
  if (driver && blocks.length === 0) {
    for (let n = 0; n < driverNAs; n++) {
      actions.push({ char: driver, action: "NA" });
    }
  }

  // Step 3: attach periodic summon procs, forward of their deploying action.
  const periodic: PeriodicProc[] = [];
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    let periodicTrigger: "E" | "Q" | null = null;
    if (
      PERIODIC_E_TRIGGERS.has(act.action) &&
      particles[act.char]?.periodic?.E
    ) {
      periodicTrigger = "E";
    } else if (
      PERIODIC_Q_TRIGGERS.has(act.action) &&
      particles[act.char]?.periodic?.Q
    ) {
      periodicTrigger = "Q";
    }
    if (!periodicTrigger) continue;

    const cfg = particles[act.char].periodic?.[periodicTrigger];
    if (!cfg) continue;
    for (const targetIndex of spreadProcTargets(i, cfg.procs, actions.length)) {
      periodic.push({
        sourceChar: act.char,
        trigger: periodicTrigger,
        targetIndex,
      });
    }
  }

  return { actions, periodic };
}
