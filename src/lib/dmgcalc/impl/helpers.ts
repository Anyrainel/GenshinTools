import type { Element } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import type { StatEntry } from "@/data/types";
import type { CharacterBase } from "../core/implModel";
import { StatBuff } from "../core/statBuff";
import type { BuffSource, DamageTagFilter } from "../types";

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

// ─── Traveler Cross-Resonance (glossary passive "buffs") ───
/**
 * Every Traveler variant gains these stat bonuses on self for each element
 * they have resonated with. The six released elements are always active;
 * Cryo is gated on `traveler_cryo` existing in the character data — remove
 * the guard once the unit ships.
 */

export const TRAVELER_RESONANCE_ENTRIES: StatEntry[] = [
  { key: "cr", value: 0.1 }, // Anemo
  { key: "def%", value: 0.2 }, // Geo
  { key: "er", value: 0.2 }, // Electro
  { key: "em", value: 60 }, // Dendro
  { key: "hp%", value: 0.2 }, // Hydro
  { key: "atk%", value: 0.2 }, // Pyro
  ...(charactersById.traveler_cryo != null
    ? [{ key: "cd" as const, value: 0.2 }] // Cryo
    : []),
];

export function travelerP3Buff(self: CharacterBase): StatBuff {
  return new StatBuff(
    cbs(self, "P3", ["passive"]),
    { receiver: "self" },
    TRAVELER_RESONANCE_ENTRIES
  );
} /** Filter matching all 7 elements (not Physical). Use with `dmg%` entries. */

export const ALL_ELEMENTAL_FILTER: DamageTagFilter = {
  elements: ["Anemo", "Cryo", "Dendro", "Electro", "Geo", "Hydro", "Pyro"],
};
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
