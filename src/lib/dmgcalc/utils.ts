import type { ArtifactSetConfig } from "@/data/types";
import {
  DEFAULT_CALC_CONTEXT,
  STELLAR_ATTACH_HITS_DEFAULT,
  STELLAR_ATTACH_HITS_MAX,
  STELLAR_ATTACH_HITS_MIN,
  STELLAR_ATTACH_HITS_TABLE_MAX,
  STELLAR_DIRECT_COEFF_BY_HITS,
  STELLAR_DIRECT_COEFF_DEFAULT,
  STELLAR_DIRECT_COEFF_MAX,
  STELLAR_DIRECT_COEFF_MIN,
  STELLAR_ENABLERS,
} from "./constants";
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
}

/** Datamine coeff for a Polestar Field attach hit count (clamped to table). */
export function getStellarDirectCoeffForHits(hits: number): number {
  const clamped = Math.min(
    STELLAR_ATTACH_HITS_TABLE_MAX,
    Math.max(0, Math.round(hits))
  );
  return STELLAR_DIRECT_COEFF_BY_HITS[clamped] ?? STELLAR_DIRECT_COEFF_DEFAULT;
}

function clampStellarAttachHits(hits: number): number {
  return Math.min(
    STELLAR_ATTACH_HITS_MAX,
    Math.max(STELLAR_ATTACH_HITS_MIN, Math.round(hits))
  );
}

/** Map legacy raw coeff setting to nearest datamine hit count. */
export function nearestStellarAttachHitsForCoeff(coeff: number): number {
  const clamped = Math.min(
    STELLAR_DIRECT_COEFF_MAX,
    Math.max(STELLAR_DIRECT_COEFF_MIN, coeff)
  );
  let bestHits = STELLAR_ATTACH_HITS_DEFAULT;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (
    let hits = STELLAR_ATTACH_HITS_MIN;
    hits <= STELLAR_ATTACH_HITS_MAX;
    hits++
  ) {
    const delta = Math.abs(getStellarDirectCoeffForHits(hits) - clamped);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestHits = hits;
    }
  }
  return bestHits;
}

/** Resolve UI attach hit count (1–12 slider; legacy coeff maps to nearest step). */
export function resolveStellarAttachHits(ctx: CalcContext): number {
  if (ctx.stellarAttachHits != null) {
    return clampStellarAttachHits(ctx.stellarAttachHits);
  }
  if (ctx.stellarDirectCoeff != null) {
    return nearestStellarAttachHitsForCoeff(ctx.stellarDirectCoeff);
  }
  return STELLAR_ATTACH_HITS_DEFAULT;
}

/** Attach-count directCoeff for StellarDirectFormula (datamine table lookup). */
export function resolveStellarDirectCoeff(ctx: CalcContext): number {
  return getStellarDirectCoeffForHits(resolveStellarAttachHits(ctx));
}

/**
 * True when the party contains a Stellar enabler for any stellar reaction, i.e.
 * `StellarDirectFormula` damage can appear and `stellarAttachHits` is meaningful.
 * Element pairing is not re-checked here — every Radiance option is already gated
 * on `teamMeta.hasReaction(...)`, so this only drives control visibility and must
 * cover Stellar Swirl teams (Odette, Vesna) as well as Stellar-Conduct ones.
 */
export function teamHasStellarEnabler(
  charIds: readonly (string | null | undefined)[]
): boolean {
  return Object.values(STELLAR_ENABLERS).some((enablers) =>
    enablers.some((id) => charIds.includes(id))
  );
}

/** Extract the 4pc set ID, or null if not a 4pc config. */

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
