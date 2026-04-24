import type { ActionType, TeamMember, TimelineAction } from "./types";

/**
 * Per-action flat-energy event emitted by an artifact 4pc.
 * Mirrors the engine's internal FlatEventDescriptor shape but trimmed to
 * what a 4pc implementation needs to express. The engine translates these
 * into its own event stream.
 */
export interface ArtifactFlatEvent {
  recipientId: string;
  /** Character whose action/event triggered this emission (usually the wearer). */
  sourceChar: string;
  /** Short label shown in UI popover (e.g. `"the_exile 4pc"`). */
  sourceLabel: string;
  /** Which action emitted this event (for popover grouping). */
  sourceAction: ActionType;
  /** Flat energy per proc. Not ER-scaling. */
  amount: number;
  /** Total number of procs per trigger. Engine spreads `procs-1` over subsequent
   *  NA/CA/PA, firing the first at the trigger itself. */
  procs?: number;
}

/**
 * Context passed to an artifact 4pc's `onAction` hook.
 */
export interface ArtifactOnActionCtx {
  act: TimelineAction;
  wearer: TeamMember;
  team: TeamMember[];
}

/**
 * Context passed to an artifact 4pc's `onParticleGain` hook.
 * Fires once per particle-producing event that the wearer absorbs
 * (non-zero particle count). `isOrb` is reserved for future orb-grant events.
 */
export interface ArtifactOnParticleGainCtx {
  wearer: TeamMember;
  team: TeamMember[];
  particleCount: number;
  isOrb: boolean;
  /** Index of the action at which the particles are absorbed. Engine uses this
   *  as a coarse cooldown proxy (actions-since-last-fire) until we timestamp
   *  the timeline. */
  actionIndex: number;
  /** Mutable per-wearer scratch state keyed by set id. Use to track CDs. */
  scratch: Record<string, unknown>;
}

/**
 * An artifact 4pc energy implementation.
 *
 * Each set has its own logic — no shared config shape. Hook into the
 * simulation at the phase that matches the set's in-game trigger:
 *
 * - `onAction`        → fires when the wearer performs a matching action
 *                        (e.g. Exile's 4pc: wearer bursts).
 * - `onParticleGain`  → fires when the wearer absorbs particles/orbs
 *                        (e.g. Scholar's 4pc).
 */
export interface ArtifactEnergyImpl {
  setId: string;
  onAction?(ctx: ArtifactOnActionCtx): ArtifactFlatEvent[];
  onParticleGain?(ctx: ArtifactOnParticleGainCtx): ArtifactFlatEvent[];
}

// ─── Implementations ───

/**
 * The Exile 4pc — "After using an Elemental Burst, the wearer regenerates
 * 2 Energy for all party members (excluding the wearer) every 2s for 6s."
 *
 * Modeled as a 3-proc effect at the burst node: proc 1 fires at Q, procs
 * 2 and 3 spread to subsequent NA/CA/PA (same mechanic as other
 * multi-tick refunds).
 */
const theExile: ArtifactEnergyImpl = {
  setId: "the_exile",
  onAction({ act, wearer, team }) {
    if (act.action !== "Q" && act.action !== "specialQ") return [];
    const others = team.filter((m) => m.id !== wearer.id);
    return others.map((r) => ({
      recipientId: r.id,
      sourceChar: wearer.id,
      sourceLabel: "the_exile 4pc",
      sourceAction: act.action,
      amount: 2,
      procs: 3,
    }));
  },
};

/**
 * Scholar 4pc — "Gaining an Elemental Particle or Orb gives 3 Energy to all
 * party members who use a bow or catalyst. Can only occur once every 3s."
 *
 * CD approximation: coarse "actions-since-last-fire" gate. Scholar's 3s CD
 * is shorter than most timeline actions (swaps + casts average ~1s), so in
 * practice it fires on most particle gains. We approximate by allowing one
 * fire per wearer per action node.
 */
const scholar: ArtifactEnergyImpl = {
  setId: "scholar",
  onParticleGain({ wearer, team, particleCount, actionIndex, scratch }) {
    if (particleCount <= 0) return [];
    const lastIdx = (scratch.scholar_lastIdx as number | undefined) ?? -1;
    if (actionIndex === lastIdx) return [];
    scratch.scholar_lastIdx = actionIndex;
    const recipients = team.filter(
      (m) => m.weaponType === "Bow" || m.weaponType === "Catalyst"
    );
    return recipients.map((r) => ({
      recipientId: r.id,
      sourceChar: wearer.id,
      sourceLabel: "scholar 4pc",
      // A particle-gain event is not itself an action — we anchor the
      // emitted flat event to the wearer's current node. The engine passes
      // us the node's action type via the caller's own event stream.
      sourceAction: "E" as ActionType,
      amount: 3,
    }));
  },
};

const allImpls: ArtifactEnergyImpl[] = [theExile, scholar];

export const artifactEnergyImpls: Record<string, ArtifactEnergyImpl> =
  Object.fromEntries(allImpls.map((a) => [a.setId, a]));

/** Lookup helper for the engine. */
export function getArtifactEnergyImpl(
  setId: string | undefined
): ArtifactEnergyImpl | undefined {
  if (!setId) return undefined;
  return artifactEnergyImpls[setId];
}
