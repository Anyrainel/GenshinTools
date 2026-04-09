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
import type { ComboLine, ReactionOverride } from "./types";

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
