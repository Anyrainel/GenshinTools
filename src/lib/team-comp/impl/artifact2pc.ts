import {
  ArtifactHalfSetBase,
  RegisterArtifactHalfSet,
  StatBuff,
} from "../damageModels";
import type { StatEntry } from "../types";

// ═══════════════════════════════════════════════════════════════
// Artifact 2-Piece Set Bonuses
// ═══════════════════════════════════════════════════════════════

@RegisterArtifactHalfSet("1")
class CryoDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 1: Cryo DMG +15%
  // Sets: Blizzard Strayer, Finale of the Deep Galleries
  readonly stats: StatEntry[] = [{ key: "cryo%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("2")
class Hp2pc extends ArtifactHalfSetBase {
  // halfSetId 2: HP +20%
  // Sets: Tenacity of the Millelith, Vourukasha's Glow
  readonly stats: StatEntry[] = [{ key: "hp%", value: 0.2 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("3")
class Def2pc extends ArtifactHalfSetBase {
  // halfSetId 3: DEF +30%
  // Sets: Husk of Opulent Dreams
  readonly stats: StatEntry[] = [{ key: "def%", value: 0.3 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("4")
class ElectroDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 4: Electro DMG +15%
  // Sets: Thundering Fury
  readonly stats: StatEntry[] = [{ key: "electro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("5")
class ElectroRes2pc extends ArtifactHalfSetBase {
  // halfSetId 5: Electro RES +40% (non-damage stat)
  // Sets: Thundersoother
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("6")
class GeoDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 6: Geo DMG +15%
  // Sets: Archaic Petra
  readonly stats: StatEntry[] = [{ key: "geo%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("7")
class Em2pc extends ArtifactHalfSetBase {
  // halfSetId 7: EM +80
  // Sets: Instructor, Wanderer's Troupe, Gilded Dreams, Flower of Paradise Lost,
  //        Night of the Sky's Unveiling, Aubade of Morningstar and Moon
  readonly stats: StatEntry[] = [{ key: "em", value: 80 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("8")
class BurstDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 8: Elemental Burst DMG +20%
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

@RegisterArtifactHalfSet("9")
class Atk2pc extends ArtifactHalfSetBase {
  // halfSetId 9: ATK +18%
  // Sets: Gladiator's Finale, Shimenawa's Reminiscence, Vermillion Hereafter,
  //        Echoes of an Offering, Nighttime Whispers, Fragment of Harmonic Whimsy,
  //        Unfinished Reverie, A Day Carved From Rising Winds
  readonly stats: StatEntry[] = [{ key: "atk%", value: 0.18 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("10")
class PhysicalDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 10: Physical DMG +25%
  // Sets: Bloodstained Chivalry, Pale Flame
  readonly stats: StatEntry[] = [{ key: "phys%", value: 0.25 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("11")
class HydroDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 11: Hydro DMG +15%
  // Sets: Heart of Depth, Nymph's Dream
  readonly stats: StatEntry[] = [{ key: "hydro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("12")
class HealingBonus2pc extends ArtifactHalfSetBase {
  // halfSetId 12: Healing Bonus +15%
  // Sets: Ocean-Hued Clam, Song of Days Past
  readonly stats: StatEntry[] = [{ key: "heal%", value: 0.15 }];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("13")
class PyroRes2pc extends ArtifactHalfSetBase {
  // halfSetId 13: Pyro RES +40% (non-damage stat)
  // Sets: Lavawalker
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("14")
class PyroDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 14: Pyro DMG +15%
  // Sets: Crimson Witch of Flames
  readonly stats: StatEntry[] = [{ key: "pyro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("15")
class Er2pc extends ArtifactHalfSetBase {
  // halfSetId 15: Energy Recharge +20%
  // Sets: Emblem of Severed Fate, Silken Moon's Serenade
  readonly stats: StatEntry[] = [{ key: "er", value: 0.2 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("16")
class AnemoDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 16: Anemo DMG +15%
  // Sets: Viridescent Venerer, Desert Pavilion Chronicle
  readonly stats: StatEntry[] = [{ key: "anemo%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("17")
class HealingEffectiveness2pc extends ArtifactHalfSetBase {
  // halfSetId 17: Character Healing Effectiveness +15% (non-damage stat)
  // Sets: Maiden Beloved
  readonly stats: StatEntry[] = [{ key: "heal%", value: 0.15 }];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("18")
class ShieldStrength2pc extends ArtifactHalfSetBase {
  // halfSetId 18: Shield Strength +35% (non-damage stat)
  // TODO: shield strength is not modeled
  // Sets: Retracing Bolide
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("19")
class DendroDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 19: Dendro DMG +15%
  // Sets: Deepwood Memories
  readonly stats: StatEntry[] = [{ key: "dendro%", value: 0.15 }];
  readonly buffs = [];
}

@RegisterArtifactHalfSet("20")
class NormalChargeDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 20: Normal and Charged Attack DMG +15%
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

@RegisterArtifactHalfSet("21")
class SkillDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 21: Elemental Skill DMG +20%
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

@RegisterArtifactHalfSet("22")
class NightsoulEnergy2pc extends ArtifactHalfSetBase {
  // halfSetId 22: Nightsoul Burst → 6 Energy (utility, no damage stat)
  // Sets: Scroll of the Hero of Cinder City
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactHalfSet("23")
class NightsoulDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 23: Nightsoul's Blessing + on-field → DMG +15%
  // Sets: Obsidian Codex
  readonly stats: StatEntry[] = [];
  readonly buffs =
    this.teamMeta.regions[this.charId] === "Natlan"
      ? [
          new StatBuff(
            {
              type: "artifactHalfSet",
              id: this.artifactHalfSetId,
              triggers: ["nightsoul"],
            },
            { receiver: "selfOnField" },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : [];
}

@RegisterArtifactHalfSet("24")
class PlungeDmg2pc extends ArtifactHalfSetBase {
  // halfSetId 24: Plunging Attack DMG +25%
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
