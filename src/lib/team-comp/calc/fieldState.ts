/**
 * Centralized helpers for resolving the effective off-field state of a
 * formula part given a per-line config.
 *
 * `ComboLine.forceOnField` is the authoritative flag for forcing off-field
 * parts to be treated as on-field; this module is the single point where
 * the flag is applied to a part's intrinsic `offField` bit.
 *
 * Using these helpers instead of ad-hoc boolean checks avoids missed sites
 * when the semantics change.
 */

import type { BuffReceiverType, FormulaPart } from "../types";
import type { ReactionOverride, TeamSlotConfig } from "../types";

/**
 * Returns the effective off-field state of a formula part: its intrinsic
 * `offField` bit, unless the line's `forceOnField` overrides it.
 */
export function isPartOffField(
  part: FormulaPart | { offField?: boolean },
  forceOnField?: boolean
): boolean {
  return !!part.offField && !forceOnField;
}

/**
 * Returns the gate reaction from a ComboLine (may be undefined/none).
 */
function getLineReaction(
  line: { reaction?: ReactionOverride } | undefined | null
): ReactionOverride | undefined {
  return line?.reaction;
}

/**
 * The default on-field character to use when the formula owner is off-field.
 * Returns the first team member that isn't the formula owner.
 * This eliminates the concept of "nobody on-field" (null).
 */
export function getDefaultOnFieldCharId(
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
  forceOnField?: boolean
): string[] {
  const defaultOnFieldCharId = getDefaultOnFieldCharId(charId, configs);
  return parts.map((part) =>
    isPartOffField(part, forceOnField) ? defaultOnFieldCharId : charId
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
