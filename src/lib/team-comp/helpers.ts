import type { Element } from "@/data/types";

import type { BuffSource, DamageTagFilter, StatEntry, StatKey } from "./types";

/** Pick a refinement-scaled value (R1–R5, 1-indexed refinement). */
export function r(
  refinement: number,
  values: [number, number, number, number, number]
): number {
  return values[refinement - 1]!;
}

/** Weapon buff source. */
export function wbs(
  self: { weaponId: string; refinement: number },
  triggers?: string[],
  noStackId?: string
): BuffSource {
  return {
    type: "weapon",
    id: self.weaponId,
    triggers,
    noStackId,
    origin: `R${self.refinement}`,
  };
}

/** Character buff source. */
export function cbs(
  self: { charId: string },
  origin: string,
  triggers?: string[]
): BuffSource {
  return { type: "character", id: self.charId, triggers, origin };
}

/** Filter matching all 7 elements (not Physical). Use with `dmg%` entries. */
export const ALL_ELEMENTAL_FILTER: DamageTagFilter = {
  elements: ["Anemo", "Cryo", "Dendro", "Electro", "Geo", "Hydro", "Pyro"],
};

// ─── Reaction Proc Table (for Scroll of the Hero of Cinder City) ───
// Maps a proc element to the attach elements it reacts with.
const REACTION_TO_AURA_ELEMENTS: Record<Element, readonly Element[]> = {
  Pyro: ["Hydro", "Electro", "Cryo", "Dendro"],
  Hydro: ["Pyro", "Electro", "Cryo", "Dendro"],
  Electro: ["Pyro", "Hydro", "Cryo", "Dendro"],
  Cryo: ["Pyro", "Hydro", "Electro"],
  Dendro: ["Pyro", "Hydro", "Electro", "Cryo"],
  Anemo: ["Pyro", "Hydro", "Electro", "Cryo"],
  Geo: ["Pyro", "Hydro", "Electro", "Cryo"],
};

export function getReactionAuraElements(
  triggerElement: Element
): readonly Element[] {
  return REACTION_TO_AURA_ELEMENTS[triggerElement];
}
