import type { Element } from "@/data/types";
import { StatBuff } from "./statBuff";
import type { TeamMeta } from "./teamMeta";

// TeamResonance
/**
 * Elemental resonance buffs derived from team composition.
 * Resonance triggers when ≥2 characters share an element,
 * or when all 4 characters have unique elements.
 */

export class TeamResonance {
  readonly buffs: StatBuff[];

  constructor(teamMeta: TeamMeta) {
    const buffs: StatBuff[] = [];

    const elemCounts = new Map<Element, number>();
    for (const el of Object.values(teamMeta.elements)) {
      if (el === undefined) continue;
      elemCounts.set(el, (elemCounts.get(el) ?? 0) + 1);
    }
    const uniqueElements = elemCounts.size;

    // Pyro 2+: ATK +25%
    if ((elemCounts.get("Pyro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "pyro" },
          { receiver: "team" },
          [{ key: "atk%", value: 0.25 }]
        )
      );
    }

    // Hydro 2+: HP +25%
    if ((elemCounts.get("Hydro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "hydro" },
          { receiver: "team" },
          [{ key: "hp%", value: 0.25 }]
        )
      );
    }

    // Cryo 2+: CR +15% against Cryo-affected/Frozen (assume active)
    if ((elemCounts.get("Cryo") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "cryo", triggers: ["frozen", "cryo"] },
          { receiver: "team" },
          [{ key: "cr", value: 0.15 }]
        )
      );
    }

    // Geo 2+: DMG +15% when shielded + Geo RES -20% when dealing DMG (assume active)
    if ((elemCounts.get("Geo") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          {
            type: "teamResonance",
            id: "geo",
            triggers: ["shielded", "lunarCrystallize"],
          },
          { receiver: "team" },
          [{ key: "dmg%", value: 0.15 }]
        ),
        new StatBuff(
          {
            type: "teamResonance",
            id: "geo",
            internalKey: "res-shred",
            triggers: ["damage"],
          },
          { receiver: "team", filter: { elements: ["Geo"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }

    // Dendro 2+: EM +50 (base), +30 after Burning/Quicken/Bloom/LunarBloom, +20 after Aggravate/Spread/Hyperbloom/Burgeon (assume active: total EM +100)
    if ((elemCounts.get("Dendro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "dendro", internalKey: "base-em" },
          { receiver: "team" },
          [{ key: "em", value: 50 }]
        )
      );
      if (
        teamMeta.hasReaction("burning") ||
        teamMeta.hasReaction("quicken") ||
        teamMeta.hasReaction("bloom") ||
        teamMeta.hasReaction("lunarBloom")
      ) {
        buffs.push(
          new StatBuff(
            {
              type: "teamResonance",
              id: "dendro",
              internalKey: "reaction-em-30",
              triggers: ["burning", "quicken", "bloom", "lunarBloom"],
            },
            { receiver: "team" },
            [{ key: "em", value: 30 }]
          )
        );
      }
      if (
        teamMeta.hasReaction("aggravate") ||
        teamMeta.hasReaction("spread") ||
        teamMeta.hasReaction("hyperbloom") ||
        teamMeta.hasReaction("burgeon")
      ) {
        buffs.push(
          new StatBuff(
            {
              type: "teamResonance",
              id: "dendro",
              internalKey: "reaction-em-20",
              triggers: ["aggravate", "spread", "hyperbloom", "burgeon"],
            },
            { receiver: "team" },
            [{ key: "em", value: 20 }]
          )
        );
      }
    }

    // 4 unique elements: All Elemental RES +15%, Physical RES +15% (defensive, out of scope)
    // Electro 2+ and Anemo 2+: no directly modellable damage bonuses
    // (energy particles, stamina, movement speed, cooldown reduction are out of scope)
    this.buffs = buffs;
  }
}
