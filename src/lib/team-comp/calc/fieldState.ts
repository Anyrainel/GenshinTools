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

import type { BuffReceiverType, FormulaPart } from "../types";
import type { ComboLine, FormulaOverride, TeamSlotConfig } from "../types";

/**
 * Returns true when the (line-level) reaction config forces off-field parts
 * to be treated as on-field for stat computation.
 */
export function isForcedOnField(
  reactionOverride: FormulaOverride | undefined | null
): boolean {
  return !!reactionOverride?.forceOnField;
}

/**
 * Returns the effective off-field state of a formula part: its intrinsic
 * `offField` bit, unless the line's `forceOnField` overrides it.
 */
export function isPartOffField(
  part: FormulaPart | { offField?: boolean },
  reactionOverride: FormulaOverride | undefined | null
): boolean {
  return !!part.offField && !reactionOverride?.forceOnField;
}

/**
 * Returns the gate reaction from a ComboLine (may be undefined/none).
 */
export function getLineReaction(
  line: ComboLine | undefined | null
): FormulaOverride | undefined {
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
  reaction?: FormulaOverride
): string[] {
  const defaultOther = defaultOnFieldCharId(charId, configs);
  return parts.map((part) =>
    isPartOffField(part, reaction) ? defaultOther : charId
  );
}

/** Receiver targets the provider's own stat sheet (vs. reaching other characters). */
export function isSelfReceiver(r: BuffReceiverType): boolean {
  return r === "self" || r === "selfOnField" || r === "selfOffField";
}

/** Receiver depends on field state (on-field / off-field) to resolve. */
export function isFieldDependentReceiver(r: BuffReceiverType): boolean {
  return r !== "self" && r !== "other" && r !== "team";
}

/**
 * Is this character on-field in the given field configuration?
 * When nobody is specified as on-field (null), everyone is off-field.
 */
export function isOnField(charId: string, onFieldCharId: string): boolean {
  return charId === onFieldCharId;
}

/** Extract the field requirement from a receiver type. null = field-independent. */
export function fieldReq(r: BuffReceiverType): "on" | "off" | null {
  if (r.endsWith("OnField")) return "on";
  if (r.endsWith("OffField")) return "off";
  return null;
}
