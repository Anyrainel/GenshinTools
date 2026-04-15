/**
 * Centralized helpers for resolving the effective off-field state of a
 * formula part given a per-line reaction config.
 *
 * `ComboLine.reaction` is the authoritative state for per-line reaction and
 * on/off-field behavior; this module is the single point where the
 * `forceOnField` flag is applied to a part's intrinsic `offField` bit.
 *
 * Using these helpers instead of ad-hoc `!reactionOverride?.forceOnField`
 * checks avoids missed sites when the semantics change.
 */

import type { FormulaPart } from "./damageModels";
import type { ComboLine, ReactionOverride, TeamSlotConfig } from "./types";

/**
 * Returns true when the (line-level) reaction config forces off-field parts
 * to be treated as on-field for stat computation.
 */
export function isForcedOnField(
  reactionOverride: ReactionOverride | undefined | null
): boolean {
  return !!reactionOverride?.forceOnField;
}

/**
 * Returns the effective off-field state of a formula part: its intrinsic
 * `offField` bit, unless the line's `forceOnField` overrides it.
 */
export function isPartOffField(
  part: FormulaPart | { offField?: boolean },
  reactionOverride: ReactionOverride | undefined | null
): boolean {
  return !!part.offField && !reactionOverride?.forceOnField;
}

/**
 * Returns the gate reaction from a ComboLine (may be undefined/none).
 */
export function getLineReaction(
  line: ComboLine | undefined | null
): ReactionOverride | undefined {
  return line?.reaction;
}

/**
 * The default on-field character to use when the formula owner is off-field.
 * Returns the first team member that isn't the formula owner.
 * This eliminates the concept of "nobody on-field" (null).
 */
export function defaultOnFieldCharId(
  charId: string,
  configs: TeamSlotConfig[]
): string {
  const other = configs.find((c) => c.charId !== charId);
  // Single-character team: the only on-field option is the character itself.
  return other ? other.charId : charId;
}

/**
 * Precompute the on-field character ID for each formula part.
 *
 * - On-field parts → the formula owner is on-field (onFieldCharId = charId)
 * - Off-field parts → use defaultOnFieldCharId (first other team member)
 *
 * This produces a deterministic array that can be used as
 * `partOnFieldCharIds[partIdx]` without any further branching.
 */
export function resolvePartOnFieldCharIds(
  parts: readonly (FormulaPart | { offField?: boolean })[],
  charId: string,
  configs: TeamSlotConfig[],
  reaction?: ReactionOverride
): string[] {
  const defaultOther = defaultOnFieldCharId(charId, configs);
  return parts.map((part) =>
    isPartOffField(part, reaction) ? defaultOther : charId
  );
}
