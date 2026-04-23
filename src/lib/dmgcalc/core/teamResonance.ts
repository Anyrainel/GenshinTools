import type { Element } from "@/data/enums";
import type { StatEntry } from "@/data/types";
import type { BuffTarget } from "../types";
import type { BuffSource } from "../types";
import type { IStatProvider } from "./implModel";
import { ScalingBuff, StatBuff } from "./statBuff";
import type { TeamMeta } from "./teamMeta";

// TeamResonance
/**
 * Elemental resonance buffs derived from team composition.
 * Resonance triggers when ≥2 characters share an element,
 * or when all 4 characters have unique elements.
 */

export class TeamResonance implements IStatProvider {
  readonly stats: StatEntry[] = [];
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

    // Superconduct: if team has both Cryo and Electro, -40% Physical RES
    const teamElements = Object.values(teamMeta.elements).filter(
      (el): el is Element => el !== undefined
    );
    if (teamElements.includes("Cryo") && teamElements.includes("Electro")) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "superconduct" },
          { receiver: "team", filter: { elements: ["Physical" as const] } },
          [{ key: "resReduction%", value: 0.4 }]
        )
      );
    }

    // 4 unique elements: All Elemental RES +15%, Physical RES +15% (defensive, out of scope)
    // Electro 2+ and Anemo 2+: no directly modellable damage bonuses
    // (energy particles, stamina, movement speed, cooldown reduction are out of scope)
    this.buffs = buffs;
  }
}

/**
 * Build gleam resonance buffs for a non-Moonsign character when the team
 * has ≥2 Moonsign members. The scaling stat depends on the character's element.
 * Returns empty array when the condition is not met.
 */
export function buildGleamResonanceBuffs(
  charId: string,
  teamMeta: TeamMeta
): StatBuff[] {
  if (
    teamMeta.countByFaction("Moonsign") < 2 ||
    teamMeta.factions[charId] === "Moonsign"
  ) {
    return [];
  }

  const el = teamMeta.elements[charId];
  const src: BuffSource = {
    type: "teamResonance",
    id: "gleam",
    noStackId: "nk_resonance_reaction_dmg",
    element: el,
  };
  const tgt: BuffTarget = {
    receiver: "team",
    filter: {
      reactions: ["lunarBloom", "lunarCharged", "lunarCrystallize"],
    },
  };

  if (el === "Pyro" || el === "Electro" || el === "Cryo") {
    return [
      new ScalingBuff(src, tgt, [], "atk", "reactionDmg%", 0.00009, 0.36),
    ];
  }
  if (el === "Hydro") {
    return [
      new ScalingBuff(src, tgt, [], "hp", "reactionDmg%", 0.000006, 0.36),
    ];
  }
  if (el === "Geo") {
    return [new ScalingBuff(src, tgt, [], "def", "reactionDmg%", 0.0001, 0.36)];
  }
  if (el === "Anemo" || el === "Dendro") {
    return [
      new ScalingBuff(src, tgt, [], "em", "reactionDmg%", 0.000225, 0.36),
    ];
  }
  return [];
}
