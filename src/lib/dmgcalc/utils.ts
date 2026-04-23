import type { ArtifactSetConfig } from "@/data/types";
import { DEFAULT_CALC_CONTEXT } from "./constants";
import type { CalcContext, DamageTag, DamageTagFilter } from "./types";

export function filterMatchesTag(
  filter: DamageTagFilter,
  tag: DamageTag
): boolean {
  if (filter.elements && !filter.elements.includes(tag.element)) return false;
  if (filter.abilities && !filter.abilities.includes(tag.ability)) return false;
  if (filter.reactions && !filter.reactions.includes(tag.reaction))
    return false;
  return true;
} /** Resolve a Partial<CalcContext> (from the store) into a full CalcContext with defaults. */

export function resolveCalcContext(ctx?: Partial<CalcContext>): CalcContext {
  return { ...DEFAULT_CALC_CONTEXT, ...ctx };
} /** Extract the 4pc set ID, or null if not a 4pc config. */

export function getSetId(
  cfg: ArtifactSetConfig | null | undefined
): string | null {
  return cfg?.type === "4pc" ? cfg.setId : null;
}
/** Extract half-set IDs, or empty array if not a 2pc+2pc config. */
export function getHalfSetIds(
  cfg: ArtifactSetConfig | null | undefined
): string[] {
  return cfg?.type === "2pc+2pc" ? cfg.halfSetIds : [];
}
