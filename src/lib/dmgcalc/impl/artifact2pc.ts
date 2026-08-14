import type { StatEntry } from "@/data/types";
import { ArtifactHalfSetBase } from "../core/implModel";
import { RegisterArtifactHalfSet } from "../core/registry";
import { StatBuff } from "../core/statBuff";

// Artifact 2-Piece Set Bonuses

@RegisterArtifactHalfSet("cryo%-15")
class CryoDmg2pc extends ArtifactHalfSetBase {
  // Cryo DMG +15%
  // Sets: Blizzard Strayer, Finale of the Deep Galleries, Glacier and Snowfield
  readonly stats: StatEntry[] = [{ key: "cryo%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("hp%-20")
class Hp2pc extends ArtifactHalfSetBase {
  // HP +20%
  // Sets: Tenacity of the Millelith, Vourukasha's Glow
  readonly stats: StatEntry[] = [{ key: "hp%", value: 0.2 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("def%-30")
class Def2pc extends ArtifactHalfSetBase {
  // DEF +30%
  // Sets: Husk of Opulent Dreams
  readonly stats: StatEntry[] = [{ key: "def%", value: 0.3 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("electro%-15")
class ElectroDmg2pc extends ArtifactHalfSetBase {
  // Electro DMG +15%
  // Sets: Thundering Fury
  readonly stats: StatEntry[] = [{ key: "electro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("electro-res-40")
class ElectroRes2pc extends ArtifactHalfSetBase {
  // Electro RES +40% (wearer's own elemental resistance, defensive stat — not modeled)
  // Sets: Thundersoother
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("geo%-15")
class GeoDmg2pc extends ArtifactHalfSetBase {
  // Geo DMG +15%
  // Sets: Archaic Petra
  readonly stats: StatEntry[] = [{ key: "geo%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("em-80")
class Em2pc extends ArtifactHalfSetBase {
  // EM +80
  // Sets: Instructor, Wanderer's Troupe, Gilded Dreams, Flower of Paradise Lost,
  //        Night of the Sky's Unveiling, Aubade of Morningstar and Moon
  readonly stats: StatEntry[] = [{ key: "em", value: 80 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("burst-dmg%-20")
class BurstDmg2pc extends ArtifactHalfSetBase {
  // Elemental Burst DMG +20%
  // Sets: Noblesse Oblige
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactHalfSet", id: this.artifactHalfSetId },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "dmg%", value: 0.2 }]
    ),
  ];
}

@RegisterArtifactHalfSet("atk%-18")
class Atk2pc extends ArtifactHalfSetBase {
  // ATK +18%
  // Sets: Gladiator's Finale, Shimenawa's Reminiscence, Vermillion Hereafter,
  //        Echoes of an Offering, Nighttime Whispers, Fragment of Harmonic Whimsy,
  //        Unfinished Reverie, A Day Carved From Rising Winds,
  //        Disenchantment in Deep Shadow, Heart of the Furnace, Scarlet Proof
  readonly stats: StatEntry[] = [{ key: "atk%", value: 0.18 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("phys%-25")
class PhysicalDmg2pc extends ArtifactHalfSetBase {
  // Physical DMG +25%
  // Sets: Bloodstained Chivalry, Pale Flame
  readonly stats: StatEntry[] = [{ key: "phys%", value: 0.25 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("hydro%-15")
class HydroDmg2pc extends ArtifactHalfSetBase {
  // Hydro DMG +15%
  // Sets: Heart of Depth, Nymph's Dream
  readonly stats: StatEntry[] = [{ key: "hydro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("heal%-15")
class HealingBonus2pc extends ArtifactHalfSetBase {
  // Healing Bonus +15%
  // Sets: Ocean-Hued Clam, Song of Days Past, Maiden Beloved
  readonly stats: StatEntry[] = [{ key: "heal%", value: 0.15 }];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("pyro-res-40")
class PyroRes2pc extends ArtifactHalfSetBase {
  // Pyro RES +40% (wearer's own elemental resistance, defensive stat — not modeled)
  // Sets: Lavawalker
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("pyro%-15")
class PyroDmg2pc extends ArtifactHalfSetBase {
  // Pyro DMG +15%
  // Sets: Crimson Witch of Flames
  readonly stats: StatEntry[] = [{ key: "pyro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("er-20")
class Er2pc extends ArtifactHalfSetBase {
  // Energy Recharge +20%
  // Sets: Emblem of Severed Fate, Silken Moon's Serenade
  readonly stats: StatEntry[] = [{ key: "er", value: 0.2 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("anemo%-15")
class AnemoDmg2pc extends ArtifactHalfSetBase {
  // Anemo DMG +15%
  // Sets: Viridescent Venerer, Desert Pavilion Chronicle
  readonly stats: StatEntry[] = [{ key: "anemo%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("shield-35")
class ShieldStrength2pc extends ArtifactHalfSetBase {
  // Shield Strength +35% (non-damage stat)
  // TODO: shield strength is not modeled
  // Sets: Retracing Bolide
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("dendro%-15")
class DendroDmg2pc extends ArtifactHalfSetBase {
  // Dendro DMG +15%
  // Sets: Deepwood Memories
  readonly stats: StatEntry[] = [{ key: "dendro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("na-ca-dmg%-15")
class NormalChargeDmg2pc extends ArtifactHalfSetBase {
  // Normal and Charged Attack DMG +15%
  // Sets: Marechaussee Hunter
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactHalfSet", id: this.artifactHalfSetId },
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [{ key: "dmg%", value: 0.15 }]
    ),
  ];
}

@RegisterArtifactHalfSet("skill-dmg%-20")
class SkillDmg2pc extends ArtifactHalfSetBase {
  // Elemental Skill DMG +20%
  // Sets: Golden Troupe
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactHalfSet", id: this.artifactHalfSetId },
      { receiver: "self", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: 0.2 }]
    ),
  ];
}

@RegisterArtifactHalfSet("nightsoul-energy-6")
class NightsoulEnergy2pc extends ArtifactHalfSetBase {
  // Nightsoul Burst → 6 Energy (utility, no damage stat)
  // Sets: Scroll of the Hero of Cinder City
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("nightsoul-dmg%-15")
class NightsoulDmg2pc extends ArtifactHalfSetBase {
  // Nightsoul's Blessing + on-field → DMG +15%
  // Sets: Obsidian Codex
  readonly stats: StatEntry[] = [];
  readonly buffs =
    this.teamMeta.factions[this.charId] === "Nightsoul"
      ? [
          new StatBuff(
            {
              type: "artifactHalfSet",
              id: this.artifactHalfSetId,
              triggers: ["Nightsoul"],
            },
            { receiver: "selfOnField" },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : [];
}

@RegisterArtifactHalfSet("plunge-dmg%-25")
class PlungeDmg2pc extends ArtifactHalfSetBase {
  // Plunging Attack DMG +25%
  // Sets: Long Night's Oath
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactHalfSet", id: this.artifactHalfSetId },
      { receiver: "self", filter: { abilities: ["plunge"] } },
      [{ key: "dmg%", value: 0.25 }]
    ),
  ];
}

@RegisterArtifactHalfSet("cr-12")
class CritRate2pc extends ArtifactHalfSetBase {
  // CRIT Rate +12%
  // Sets: Berserker
  readonly stats: StatEntry[] = [{ key: "cr", value: 0.12 }];
  readonly buffs = [];
}

/**
 * Static lookup of 2pc half-set ID → stat entries.
 * Only includes sets whose 2pc bonus adds a universal stat (not filtered buffs).
 * Used for lightweight stat display without instantiating the full CharBuild.
 */
export const HALF_SET_STATS: Record<string, StatEntry[]> = {
  "cryo%-15": [{ key: "cryo%", value: 0.15 }],
  "hp%-20": [{ key: "hp%", value: 0.2 }],
  "def%-30": [{ key: "def%", value: 0.3 }],
  "electro%-15": [{ key: "electro%", value: 0.15 }],
  "geo%-15": [{ key: "geo%", value: 0.15 }],
  "em-80": [{ key: "em", value: 80 }],
  "atk%-18": [{ key: "atk%", value: 0.18 }],
  "phys%-25": [{ key: "phys%", value: 0.25 }],
  "hydro%-15": [{ key: "hydro%", value: 0.15 }],
  "heal%-15": [{ key: "heal%", value: 0.15 }],
  "pyro%-15": [{ key: "pyro%", value: 0.15 }],
  "er-20": [{ key: "er", value: 0.2 }],
  "anemo%-15": [{ key: "anemo%", value: 0.15 }],
  "dendro%-15": [{ key: "dendro%", value: 0.15 }],
  "cr-12": [{ key: "cr", value: 0.12 }],
};
