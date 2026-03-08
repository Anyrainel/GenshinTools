import type { Element } from "@/data/types";

import { PHEC_ELEMENTS } from "../constants";
import {
  ArtifactSetBase,
  RegisterArtifactSet,
  ScalingBuff,
  StatBuff,
  resolveOption,
} from "../damageModels";
import type { TeamMeta } from "../damageModels";
import { getReactionAuraElements } from "../helpers";
import type { OptionDef, StatEntry, StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// Artifact 4-Piece Set Bonuses
// ═══════════════════════════════════════════════════════════════

const blizzardStrayerOption = {
  label: { zh: "冰风4件套", en: "Blizzard 4pc" },
  choices: [
    {
      value: "20",
      label: { zh: "+20%暴击 (挂冰)", en: "+20% CR (Cryo-aff.)" },
    },
    { value: "40", label: { zh: "+40%暴击 (冻结)", en: "+40% CR (Frozen)" } },
  ] as const,
  default: "40",
} satisfies OptionDef;

@RegisterArtifactSet("blizzard_strayer", blizzardStrayerOption)
class BlizzardStrayer4pc extends ArtifactSetBase {
  // 2pc: Cryo DMG +15% (via halfSetId)
  // 4pc: +20% CR vs Cryo-affected; +20% more vs Frozen
  private readonly o = resolveOption(blizzardStrayerOption, this.option);
  readonly halfSetId = "cryo%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["vs-cryo"] },
      { receiver: "self" },
      [{ key: "cr", value: this.o === "40" ? 0.4 : 0.2 }]
    ),
  ];
}

@RegisterArtifactSet("finale_of_the_deep_galleries")
class FinaleOfTheDeepGalleries4pc extends ArtifactSetBase {
  // 2pc: Cryo DMG +15% (via halfSetId)
  // 4pc: When 0 energy, Normal ATK DMG +60% and Burst DMG +60%.
  // Both modeled as active. Only one will be consumed per damage formula evaluation.
  readonly halfSetId = "cryo%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["0-energy"] },
      { receiver: "self", filter: { abilities: ["normal", "burst"] } },
      [{ key: "dmg%", value: 0.6 }]
    ),
  ];
}

@RegisterArtifactSet("tenacity_of_the_millelith")
class TenacityOfTheMillelith4pc extends ArtifactSetBase {
  // 2pc: HP +20% (via halfSetId)
  // 4pc: E hit → team ATK +20%, Shield Strength +30%
  // Model: ATK buff to team (shield strength is non-damage)
  readonly halfSetId = "hp%-20";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["E"],
        noStackId: this.artifactSetId,
      },
      { receiver: "team" },
      [{ key: "atk%", value: 0.2 }]
    ),
  ];
}

@RegisterArtifactSet("vourukashas_glow")
class VourukashasGlow4pc extends ArtifactSetBase {
  // 2pc: HP +20% (via halfSetId)
  // 4pc: Skill/Burst DMG +10%. After taking DMG, bonus increased by 80% (of 10% base = 8%) per stack, max 5.
  // Model: max stacks → 10% + 5×8% = 50% total Skill/Burst DMG.
  // TODO: Allow customizable stack count in future.
  readonly halfSetId = "hp%-20";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["take-dmg"] },
      { receiver: "self", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: 0.5 }]
    ),
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["take-dmg"] },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "dmg%", value: 0.5 }]
    ),
  ];
}

@RegisterArtifactSet("husk_of_opulent_dreams")
class HuskOfOpulentDreams4pc extends ArtifactSetBase {
  // 2pc: DEF +30% (via halfSetId)
  // 4pc: Max 4 stacks of Curiosity, each +6% DEF and +6% Geo DMG
  // Model: max stacks = +24% DEF, +24% Geo DMG
  readonly halfSetId = "def%-30";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["geo-hit"] },
      { receiver: "self" },
      [
        { key: "def%", value: 0.24 },
        { key: "geo%", value: 0.24 },
      ]
    ),
  ];
}

@RegisterArtifactSet("thundering_fury")
class ThunderingFury4pc extends ArtifactSetBase {
  // 2pc: Electro DMG +15% (via halfSetId)
  // 4pc: Overloaded/EC/Superconduct/Hyperbloom +40%, Aggravate/Lunar-Charged +20%
  readonly halfSetId = "electro%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["on-reaction"],
      },
      {
        receiver: "self",
        filter: {
          reactions: [
            "overloaded",
            "electroCharged",
            "superconduct",
            "hyperbloom",
          ],
        },
      },
      [{ key: "reactionDmg%", value: 0.4 }]
    ),
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["on-reaction"],
      },
      {
        receiver: "self",
        filter: { reactions: ["aggravate", "lunarCharged"] },
      },
      [{ key: "reactionDmg%", value: 0.2 }]
    ),
  ];
}

@RegisterArtifactSet("thundersoother")
class Thundersoother4pc extends ArtifactSetBase {
  // 2pc: Electro RES +40% (via halfSetId — defensive, not modeled)
  // 4pc: +35% DMG against Electro-affected opponents
  // Active if team can apply Electro to enemies (S10)
  readonly halfSetId = "electro-res-40";
  readonly stats: StatEntry[] = [];
  readonly buffs = Object.values(this.teamMeta.elements).includes("Electro")
    ? [
        new StatBuff(
          {
            type: "artifactSet",
            id: this.artifactSetId,
            triggers: ["vs-electro"],
          },
          { receiver: "self" },
          [{ key: "dmg%", value: 0.35 }]
        ),
      ]
    : [];
}

@RegisterArtifactSet("archaic_petra")
class ArchaicPetra4pc extends ArtifactSetBase {
  // 2pc: Geo DMG +15% (via halfSetId)
  // 4pc: Picking up Crystallize shard → team gets 35% DMG bonus for that element.
  // Only Pyro/Hydro/Electro/Cryo produce shards. Buff applied to all team elements
  // that are also crystallize-eligible.
  readonly halfSetId = "geo%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const elements = new Set(Object.values(teamMeta.elements));
    const entries: StatEntry[] = [];
    for (const el of PHEC_ELEMENTS) {
      if (elements.has(el)) {
        entries.push({ key: `${el.toLowerCase()}%` as StatKey, value: 0.35 });
      }
    }
    this.buffs =
      entries.length > 0
        ? [
            new StatBuff(
              {
                type: "artifactSet",
                id: this.artifactSetId,
                triggers: ["crystallize"],
                noStackId: this.artifactSetId,
              },
              { receiver: "team" },
              entries
            ),
          ]
        : [];
  }
}

@RegisterArtifactSet("crimson_witch_of_flames")
class CrimsonWitch4pc extends ArtifactSetBase {
  // 2pc: Pyro DMG +15% (via halfSetId)
  // 4pc: Overloaded/Burning +40%, Vaporize/Melt +15%.
  // Using E increases 2pc bonus by 50%, max 3 stacks → 15% × 0.5 × 3 = 22.5% Pyro DMG
  readonly halfSetId = "pyro%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["on-reaction"],
      },
      {
        receiver: "self",
        filter: { reactions: ["overloaded", "burning", "burgeon"] },
      },
      [{ key: "reactionDmg%", value: 0.4 }]
    ),
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["on-reaction"],
      },
      {
        receiver: "self",
        filter: { reactions: ["vaporize", "melt"] },
      },
      [{ key: "reactionDmg%", value: 0.15 }]
    ),
    // E stacks: max 3 × 50% of 15% = +22.5% Pyro DMG
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["E"] },
      { receiver: "self" },
      [{ key: "pyro%", value: 0.225 }]
    ),
  ];
}

@RegisterArtifactSet("lavawalker")
class Lavawalker4pc extends ArtifactSetBase {
  // 2pc: Pyro RES +40% (via halfSetId — defensive, not modeled)
  // 4pc: +35% DMG against Pyro-affected opponents
  // Active if team can apply Pyro to enemies (S10)
  readonly halfSetId = "pyro-res-40";
  readonly stats: StatEntry[] = [];
  readonly buffs = Object.values(this.teamMeta.elements).includes("Pyro")
    ? [
        new StatBuff(
          {
            type: "artifactSet",
            id: this.artifactSetId,
            triggers: ["vs-pyro"],
          },
          { receiver: "self" },
          [{ key: "dmg%", value: 0.35 }]
        ),
      ]
    : [];
}

@RegisterArtifactSet("noblesse_oblige")
class NoblesseOblige4pc extends ArtifactSetBase {
  // 2pc: Elemental Burst DMG +20% (via halfSetId — ability-scoped)
  // 4pc: Using Burst → team ATK +20% (cannot stack)
  readonly halfSetId = "burst-dmg%-20";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["Q"],
        noStackId: "noblesse-oblige-atk",
      },
      { receiver: "team" },
      [{ key: "atk%", value: 0.2 }]
    ),
  ];
}

@RegisterArtifactSet("instructor")
class Instructor4pc extends ArtifactSetBase {
  // 2pc: EM +80 (via halfSetId)
  // 4pc: Triggering reaction → team EM +120
  readonly halfSetId = "em-80";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["on-reaction"],
        noStackId: this.artifactSetId,
      },
      { receiver: "team" },
      [{ key: "em", value: 120 }]
    ),
  ];
}

@RegisterArtifactSet("viridescent_venerer")
class ViridescentVenerer4pc extends ArtifactSetBase {
  // 2pc: Anemo DMG +15% (via halfSetId)
  // 4pc: Swirl DMG +60%, and decreases opponent's RES to swirled element by 40%
  readonly halfSetId = "anemo%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const teamElements = new Set(Object.values(teamMeta.elements));
    const elements: Element[] = PHEC_ELEMENTS.filter((el) =>
      teamElements.has(el)
    );

    this.buffs = [
      new StatBuff(
        { type: "artifactSet", id: this.artifactSetId, triggers: ["swirl"] },
        { receiver: "self", filter: { reactions: ["swirl"] } },
        [{ key: "reactionDmg%", value: 0.6 }]
      ),
      new StatBuff(
        {
          type: "artifactSet",
          id: this.artifactSetId,
          triggers: ["swirl"],
          noStackId: this.artifactSetId,
        },
        { receiver: "team", filter: { elements: elements } },
        [{ key: "resReduction%", value: 0.4 }]
      ),
    ];
  }
}

@RegisterArtifactSet("emblem_of_severed_fate")
class EmblemOfSeveredFate4pc extends ArtifactSetBase {
  // 2pc: Energy Recharge +20% (via halfSetId)
  // 4pc: Burst DMG +25% of ER, max 75%
  readonly halfSetId = "er-20";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new ScalingBuff(
      { type: "artifactSet", id: this.artifactSetId },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [],
      "er",
      "dmg%",
      0.25,
      0.75
    ),
  ];
}

@RegisterArtifactSet("gladiators_finale")
class GladiatorsFinale4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: Normal ATK DMG +35% for Sword/Claymore/Polearm
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const weaponType = teamMeta.weaponTypes[charId];
    const eligible =
      weaponType === "Sword" ||
      weaponType === "Claymore" ||
      weaponType === "Polearm";
    this.buffs = eligible
      ? [
          new StatBuff(
            { type: "artifactSet", id: this.artifactSetId },
            { receiver: "self", filter: { abilities: ["normal"] } },
            [{ key: "dmg%", value: 0.35 }]
          ),
        ]
      : [];
  }
}

@RegisterArtifactSet("wanderers_troupe")
class WanderersTroupe4pc extends ArtifactSetBase {
  // 2pc: EM +80 (via halfSetId)
  // 4pc: Charged ATK DMG +35% for Catalyst/Bow
  readonly halfSetId = "em-80";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const weaponType = teamMeta.weaponTypes[charId];
    const eligible = weaponType === "Catalyst" || weaponType === "Bow";
    this.buffs = eligible
      ? [
          new StatBuff(
            { type: "artifactSet", id: this.artifactSetId },
            { receiver: "self", filter: { abilities: ["charge"] } },
            [{ key: "dmg%", value: 0.35 }]
          ),
        ]
      : [];
  }
}

@RegisterArtifactSet("maiden_beloved")
class MaidenBeloved4pc extends ArtifactSetBase {
  // 2pc: Character Healing Effectiveness +15% (via halfSetId)
  // 4pc: Healing received by all party members +20% (non-damage)
  readonly halfSetId = "heal%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactSet("bloodstained_chivalry")
class BloodstainedChivalry4pc extends ArtifactSetBase {
  // 2pc: Physical DMG +25% (via halfSetId)
  // 4pc: After defeating opponent, Charged ATK DMG +50%
  readonly halfSetId = "phys%-25";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["on-kill"] },
      { receiver: "self", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: 0.5 }]
    ),
  ];
}

@RegisterArtifactSet("pale_flame")
class PaleFlame4pc extends ArtifactSetBase {
  // 2pc: Physical DMG +25% (via halfSetId)
  // 4pc: E hit → ATK +9%, max 2 stacks. At 2 stacks, 2pc effect +100%
  // Model: max stacks → +18% ATK + additional 25% Physical DMG (doubling the 2pc 25%)
  readonly halfSetId = "phys%-25";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["E"] },
      { receiver: "self" },
      [
        { key: "atk%", value: 0.18 },
        { key: "phys%", value: 0.25 },
      ]
    ),
  ];
}

@RegisterArtifactSet("heart_of_depth")
class HeartOfDepth4pc extends ArtifactSetBase {
  // 2pc: Hydro DMG +15% (via halfSetId)
  // 4pc: After E, Normal/Charged ATK DMG +30%
  readonly halfSetId = "hydro%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["E"] },
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [{ key: "dmg%", value: 0.3 }]
    ),
  ];
}

@RegisterArtifactSet("retracing_bolide")
class RetracingBolide4pc extends ArtifactSetBase {
  // 2pc: Shield Strength +35% (via halfSetId — non-damage)
  // 4pc: While shielded, Normal/Charged ATK DMG +40%
  readonly halfSetId = "shield-35";
  readonly stats: StatEntry[] = [];
  readonly buffs = this.teamMeta.hasShielder()
    ? [
        new StatBuff(
          {
            type: "artifactSet",
            id: this.artifactSetId,
            triggers: ["shielded"],
          },
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge"] },
          },
          [{ key: "dmg%", value: 0.4 }]
        ),
      ]
    : [];
}

@RegisterArtifactSet("oceanhued_clam")
class OceanHuedClam4pc extends ArtifactSetBase {
  // 2pc: Character Healing Effectiveness +15% (via halfSetId)
  // 4pc: Healing creates bubble that deals fixed damage (separate damage source, not stat-modifiable)
  readonly halfSetId = "heal%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactSet("shimenawas_reminiscence")
class ShimenawasReminiscence4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: When E cast with ≥15 energy, lose 15 energy → Normal/Charged/Plunge +50%
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["E"] },
      {
        receiver: "self",
        filter: { abilities: ["normal", "charge", "plunge"] },
      },
      [{ key: "dmg%", value: 0.5 }]
    ),
  ];
}

@RegisterArtifactSet("vermillion_hereafter")
class VermillionHereafter4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: After Burst, ATK +8%. When HP decreases, +10% ATK per stack, max 4 stacks.
  // Model: max stacks → +8% + 4×10% = +48% ATK
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["Q", "low-hp"],
      },
      { receiver: "selfOnField" },
      [{ key: "atk%", value: 0.48 }]
    ),
  ];
}

@RegisterArtifactSet("echoes_of_an_offering")
class EchoesOfAnOffering4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: Normal ATK has ~52% chance (ramping) → Normal ATK DMG +70% of ATK as flat base damage.
  // normalBase scales from atk (via self stats) at 0.7 × ~0.5 avg = 0.35
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new ScalingBuff(
      { type: "artifactSet", id: this.artifactSetId },
      { receiver: "self", filter: { abilities: ["normal"] } },
      [],
      "atk",
      "baseDmg",
      0.35
    ),
  ];
}

@RegisterArtifactSet("deepwood_memories")
class DeepwoodMemories4pc extends ArtifactSetBase {
  // 2pc: Dendro DMG +15% (via halfSetId)
  // 4pc: E or Burst hit → target's Dendro RES -30%
  readonly halfSetId = "dendro%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["E", "Q"],
        noStackId: this.artifactSetId,
      },
      { receiver: "team", filter: { elements: ["Dendro"] } },
      [{ key: "resReduction%", value: 0.3 }]
    ),
  ];
}

@RegisterArtifactSet("gilded_dreams")
class GildedDreams4pc extends ArtifactSetBase {
  // 2pc: EM +80 (via halfSetId)
  // 4pc: After reaction, per same-element teammate +14% ATK, per different-element +50 EM.
  // Max 3 stacks total. Uses team composition to determine.
  readonly halfSetId = "em-80";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const selfElement = teamMeta.elements[charId];
    const teammates = teamMeta.characters.filter((c) => c !== charId);
    let sameCount = 0;
    let diffCount = 0;
    for (const t of teammates) {
      if (teamMeta.elements[t] === selfElement) sameCount++;
      else diffCount++;
    }
    // Max 3 stacks total
    const totalStacks = Math.min(sameCount + diffCount, 3);
    const effectiveSame = Math.min(sameCount, totalStacks);
    const effectiveDiff = Math.min(diffCount, totalStacks - effectiveSame);

    const entries: StatEntry[] = [];
    if (effectiveSame > 0)
      entries.push({ key: "atk%", value: 0.14 * effectiveSame });
    if (effectiveDiff > 0)
      entries.push({ key: "em", value: 50 * effectiveDiff });

    this.buffs =
      entries.length > 0
        ? [
            new StatBuff(
              {
                type: "artifactSet",
                id: this.artifactSetId,
                triggers: ["on-reaction"],
              },
              { receiver: "self" },
              entries
            ),
          ]
        : [];
  }
}

@RegisterArtifactSet("flower_of_paradise_lost")
class FlowerOfParadiseLost4pc extends ArtifactSetBase {
  // 2pc: EM +80 (via halfSetId)
  // 4pc: Bloom/Hyperbloom/Burgeon +40%, Lunar-Bloom +10%.
  // After triggering any of the four, +25% per stack, max 4.
  // Model: bloom/hyperbloom/burgeon = 40% + 4×25% = 140%; lunarBloom = 10% + 4×25% = 110%
  readonly halfSetId = "em-80";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["on-reaction"],
      },
      {
        receiver: "self",
        filter: { reactions: ["bloom", "hyperbloom", "burgeon"] },
      },
      [{ key: "reactionDmg%", value: 1.4 }]
    ),
    // lunarBloom is explicitly called out in the artifact text with its own base bonus
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["on-reaction"],
      },
      { receiver: "self", filter: { reactions: ["lunarBloom"] } },
      [{ key: "reactionDmg%", value: 1.1 }]
    ),
  ];
}

@RegisterArtifactSet("desert_pavilion_chronicle")
class DesertPavilionChronicle4pc extends ArtifactSetBase {
  // 2pc: Anemo DMG +15% (via halfSetId)
  // 4pc: Charged ATK hit → Normal/Charged/Plunge +40%, Normal ATK SPD +10%
  readonly halfSetId = "anemo%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["charge-hit"] },
      { receiver: "self", filter: { abilities: ["normal"] } },
      [{ key: "dmg%", value: 0.4 }]
    ),
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["charge-hit"] },
      { receiver: "self", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: 0.4 }]
    ),
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["charge-hit"] },
      { receiver: "self", filter: { abilities: ["plunge"] } },
      [{ key: "dmg%", value: 0.4 }]
    ),
    // Normal ATK SPD +10%
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["charge-hit"] },
      { receiver: "self" },
      [{ key: "atkSpd%", value: 0.1 }]
    ),
  ];
}

@RegisterArtifactSet("nymphs_dream")
class NymphsDream4pc extends ArtifactSetBase {
  // 2pc: Hydro DMG +15% (via halfSetId)
  // 4pc: Max 3 stacks → ATK +25%, Hydro DMG +15%
  readonly halfSetId = "hydro%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId },
      { receiver: "self" },
      [
        { key: "atk%", value: 0.25 },
        { key: "hydro%", value: 0.15 },
      ]
    ),
  ];
}

@RegisterArtifactSet("marechaussee_hunter")
class MarechausseeHunter4pc extends ArtifactSetBase {
  // 2pc: Normal and Charged Attack DMG +15% (via halfSetId — ability-scoped)
  // 4pc: When HP changes, CR +12%, max 3 stacks → +36% CR
  readonly halfSetId = "na-ca-dmg%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["hp-change"] },
      { receiver: "self" },
      [{ key: "cr", value: 0.36 }]
    ),
  ];
}

@RegisterArtifactSet("golden_troupe")
class GoldenTroupe4pc extends ArtifactSetBase {
  // 2pc: Elemental Skill DMG +20% (via halfSetId — ability-scoped)
  // 4pc: Skill DMG +25%. Off-field: additional +25%.
  // Modeled as a static +50% since Golden Troupe is primarily an off-field support set.
  readonly halfSetId = "skill-dmg%-20";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId },
      { receiver: "self", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: 0.5 }]
    ),
  ];
}

@RegisterArtifactSet("song_of_days_past")
class SongOfDaysPast4pc extends ArtifactSetBase {
  // 2pc: Character Healing Effectiveness +15% (via halfSetId)
  // 4pc: Records healing up to 15000, then adds 8% as flat DMG bonus to on-field hits (5 times).
  // Max flat = 0.08 × 15000 = 1200 per hit across all ability types.
  readonly halfSetId = "heal%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = this.teamMeta.isHealer[this.charId]
    ? [
        new StatBuff(
          {
            type: "artifactSet",
            id: this.artifactSetId,
            triggers: ["healing"],
            noStackId: this.artifactSetId,
          },
          {
            receiver: "onField",
            filter: {
              abilities: ["normal", "charge", "plunge", "skill", "burst"],
            },
          },
          [{ key: "baseDmg", value: 1200 }]
        ),
      ]
    : [];
}

@RegisterArtifactSet("fragment_of_harmonic_whimsy")
class FragmentOfHarmonicWhimsy4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: When Bond of Life changes, DMG +18%, max 3 stacks → +54%
  // TODO: check bond of life mechanism
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["bond-of-life"],
      },
      { receiver: "self" },
      [{ key: "dmg%", value: 0.54 }]
    ),
  ];
}

@RegisterArtifactSet("unfinished_reverie")
class UnfinishedReverie4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: Out of combat → DMG +50%. In combat with Burning enemy nearby → ramps to +50%.
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs = this.teamMeta.hasReaction("burning")
    ? [
        new StatBuff(
          {
            type: "artifactSet",
            id: this.artifactSetId,
            triggers: ["burning"],
          },
          { receiver: "self" },
          [{ key: "dmg%", value: 0.5 }]
        ),
      ]
    : [];
}

@RegisterArtifactSet("nighttime_whispers_in_the_echoing_woods")
class NighttimeWhispers4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: After E, +20% Geo DMG for 10s. Under Crystallize shield, +150% of above = +50% Geo DMG total
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["E", "crystallize"],
      },
      { receiver: "self" },
      [
        {
          key: "geo%",
          value: this.teamMeta.hasReaction("crystallize") ? 0.5 : 0.2,
        },
      ]
    ),
  ];
}

@RegisterArtifactSet("obsidian_codex")
class ObsidianCodex4pc extends ArtifactSetBase {
  // 2pc: Nightsoul's Blessing + on-field → DMG +15% (via halfSetId)
  // 4pc: After consuming 1 Nightsoul point on-field (Natlan), CR +40%
  readonly halfSetId = "nightsoul-dmg%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs =
    this.teamMeta.regions[this.charId] === "Natlan"
      ? [
          new StatBuff(
            {
              type: "artifactSet",
              id: this.artifactSetId,
              triggers: ["nightsoul"],
            },
            { receiver: "selfOnField" },
            [{ key: "cr", value: 0.4 }]
          ),
        ]
      : [];
}

@RegisterArtifactSet("scroll_of_the_hero_of_cinder_city")
class ScrollOfTheHero4pc extends ArtifactSetBase {
  // 2pc: Nightsoul Burst → 6 Energy (via halfSetId — utility, non-damage)
  // 4pc: Triggering reaction → team gets elemental DMG bonus for the proc element and
  // the attach elements present in the team. +12% normally, +40% if wearer is from Natlan. (no stacking)
  readonly halfSetId = "nightsoul-energy-6";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);

    // Natlan characters can trigger Nightsoul → 40% total, others → 12%
    const bonus = teamMeta.regions[charId] === "Natlan" ? 0.4 : 0.12;

    const wearerElement = teamMeta.elements[charId];
    if (wearerElement === undefined) {
      this.buffs = [];
      return;
    }
    const attachEls = getReactionAuraElements(wearerElement);

    // Find all possible reaction elements
    const buffedElements = new Set<Element>();
    for (const el of attachEls) {
      if (teamMeta.countByElement(el) > 0) buffedElements.add(el);
    }
    // If no member can trigger reaction, no buffs
    if (buffedElements.size === 0) {
      this.buffs = [];
      return;
    }
    // Else also add self element
    buffedElements.add(wearerElement);

    const entries: StatEntry[] = [...buffedElements].map((el) => ({
      key: `${el.toLowerCase()}%` as StatKey,
      value: bonus,
    }));

    this.buffs = [
      new StatBuff(
        {
          type: "artifactSet",
          id: this.artifactSetId,
          triggers: ["elemental-reaction"],
          noStackId: this.artifactSetId,
        },
        { receiver: "team" },
        entries
      ),
    ];
  }
}

@RegisterArtifactSet("long_nights_oath")
class LongNightsOath4pc extends ArtifactSetBase {
  // 2pc: Plunging Attack DMG +25% (via halfSetId — ability-scoped)
  // 4pc: Plunge/Charged/E hit → stacks of "Radiance Everlasting"
  // Plunge +15% per stack, max 5 → +75% Plunge DMG
  readonly halfSetId = "plunge-dmg%-25";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      {
        type: "artifactSet",
        id: this.artifactSetId,
        triggers: ["plunge", "charge", "E"],
      },
      { receiver: "self", filter: { abilities: ["plunge"] } },
      [{ key: "dmg%", value: 0.75 }]
    ),
  ];
}

@RegisterArtifactSet("a_day_carved_from_rising_winds")
class ADayCarvedFromRisingWinds4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: After hitting opponent, ATK +25%. (assume always true)
  // If equipping character is Hexerei (Witch's Homework), also CR +20%.
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [{ key: "atk%", value: 0.25 }];
  readonly buffs: StatBuff[] =
    this.teamMeta.factions[this.charId] === "Hexerei"
      ? [
          new StatBuff(
            {
              type: "artifactSet",
              id: this.artifactSetId,
              triggers: ["hexerei"],
            },
            { receiver: "self" },
            [{ key: "cr", value: 0.2 }]
          ),
        ]
      : [];
}

@RegisterArtifactSet("silken_moons_serenade")
class SilkenMoonsSerenade4pc extends ArtifactSetBase {
  // 2pc: Energy Recharge +20% (via halfSetId)
  // 4pc: Elemental DMG → team EM +120 (no stacking).
  // Additional: +10% Lunar Reaction DMG per different Gleaming Moon set worn by other teammates (no stacking).
  // The only other Gleaming Moon set is "night_of_the_skys_unveiling".
  readonly halfSetId = "er-20";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const moonLevel = Math.min(teamMeta.countByFaction("Moonsign"), 2);
    const otherGleaming = Object.values(teamMeta.artifactSets).includes(
      "night_of_the_skys_unveiling"
    );
    this.buffs = [
      new StatBuff(
        {
          type: "artifactSet",
          id: this.artifactSetId,
          triggers: ["elemental-dmg"],
          noStackId: "gleaming-moon-set-reaction-dmg",
        },
        {
          receiver: "team",
          filter: {
            reactions: ["lunarBloom", "lunarCharged", "lunarCrystallize"],
          },
        },
        [{ key: "reactionDmg%", value: otherGleaming ? 0.2 : 0.1 }]
      ),
    ];

    if (moonLevel > 0) {
      this.buffs.push(
        new StatBuff(
          {
            type: "artifactSet",
            id: this.artifactSetId,
            triggers: ["elemental-damage"],
            noStackId: this.artifactSetId,
          },
          { receiver: "team" },
          [{ key: "em", value: 60 * moonLevel }]
        )
      );
    }
  }
}

@RegisterArtifactSet("night_of_the_skys_unveiling")
class NightOfTheSkysUnveiling4pc extends ArtifactSetBase {
  // 2pc: EM +80 (via halfSetId)
  // 4pc: Nearby party triggers Lunar Reaction → self on-field CR +30%.
  // Additional: +10% Lunar Reaction DMG per different Gleaming Moon set worn by other teammates (no stacking).
  // The only other Gleaming Moon set is "silken_moons_serenade".
  readonly halfSetId = "em-80";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const moonLevel = Math.min(teamMeta.countByFaction("Moonsign"), 2);
    const otherGleaming = Object.values(teamMeta.artifactSets).includes(
      "silken_moons_serenade"
    );

    this.buffs = [
      new StatBuff(
        {
          type: "artifactSet",
          id: this.artifactSetId,
          triggers: ["lunar-reaction"],
          noStackId: "gleaming-moon-set-reaction-dmg",
        },
        {
          receiver: "team",
          filter: {
            reactions: ["lunarCharged", "lunarBloom", "lunarCrystallize"],
          },
        },
        [{ key: "reactionDmg%", value: otherGleaming ? 0.2 : 0.1 }]
      ),
    ];
    if (moonLevel > 0) {
      this.buffs.push(
        new StatBuff(
          {
            type: "artifactSet",
            id: this.artifactSetId,
            triggers: ["lunar-reaction"],
          },
          { receiver: "selfOnField" },
          [{ key: "cr", value: 0.15 * moonLevel }]
        )
      );
    }
  }
}

@RegisterArtifactSet("aubade_of_morningstar_and_moon")
class AubadeOfMorningstarAndMoon4pc extends ArtifactSetBase {
  // 2pc: EM +80 (via halfSetId)
  // 4pc: Off-field → Lunar Reaction DMG +20%. At Ascendant Gleam: +40% more.
  readonly halfSetId = "em-80";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[];

  constructor(artifactSetId: string, charId: string, teamMeta: TeamMeta) {
    super(artifactSetId, charId, teamMeta);
    const lunarBonus = teamMeta.countByFaction("Moonsign") >= 2 ? 0.6 : 0.2;
    this.buffs = [
      new StatBuff(
        {
          type: "artifactSet",
          id: this.artifactSetId,
          triggers: ["off-field"],
        },
        {
          receiver: "selfOffField",
          filter: {
            reactions: ["lunarCharged", "lunarBloom", "lunarCrystallize"],
          },
        },
        [{ key: "reactionDmg%", value: lunarBonus }]
      ),
    ];
  }
}

const berserkerOption = {
  label: { zh: "HP状态", en: "HP State" },
  choices: [
    { value: "low", label: { zh: "HP<70%", en: "HP <70%" } },
    { value: "high", label: { zh: "HP≥70%", en: "HP ≥70%" } },
  ] as const,
  default: "low",
} satisfies OptionDef;

@RegisterArtifactSet("berserker", berserkerOption)
class Berserker4pc extends ArtifactSetBase {
  // 2pc: CRIT Rate +12% (via halfSetId)
  // 4pc: When HP is below 70%, CRIT Rate increases by an additional 24%.
  private readonly o = resolveOption(berserkerOption, this.option);
  readonly halfSetId = "cr-12";
  readonly stats: StatEntry[] = [];
  readonly buffs =
    this.o === "low"
      ? [
          new StatBuff(
            {
              type: "artifactSet",
              id: this.artifactSetId,
              triggers: ["low-hp"],
            },
            { receiver: "self" },
            [{ key: "cr", value: 0.24 }]
          ),
        ]
      : [];
}

const braveHeartOption = {
  label: { zh: "敌人HP", en: "Enemy HP" },
  choices: [
    { value: "above50", label: { zh: ">50%", en: ">50%" } },
    { value: "below50", label: { zh: "≤50%", en: "≤50%" } },
  ] as const,
  default: "above50",
} satisfies OptionDef;

@RegisterArtifactSet("brave_heart", braveHeartOption)
class BraveHeart4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: Increases DMG by 30% against opponents with more than 50% HP.
  private readonly o = resolveOption(braveHeartOption, this.option);
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs =
    this.o === "above50"
      ? [
          new StatBuff(
            {
              type: "artifactSet",
              id: this.artifactSetId,
              triggers: ["vs-high-hp"],
            },
            { receiver: "self" },
            [{ key: "dmg%", value: 0.3 }]
          ),
        ]
      : [];
}

@RegisterArtifactSet("defenders_will")
class DefendersWill4pc extends ArtifactSetBase {
  // 2pc: DEF +30% (via halfSetId)
  // 4pc: For each different element present in your own party, the wearer's
  // Elemental RES to that corresponding element is increased by 30%.
  // Pure defense (U9 skip) — empty buffs.
  readonly halfSetId = "def%-30";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactSet("gambler")
class Gambler4pc extends ArtifactSetBase {
  // 2pc: Elemental Skill DMG +20% (via halfSetId)
  // 4pc: Defeating an opponent has a 100% chance to remove Elemental Skill CD.
  // Can only occur once every 15s. CD reset is utility (U9 skip) — empty buffs.
  readonly halfSetId = "skill-dmg%-20";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactSet("martial_artist")
class MartialArtist4pc extends ArtifactSetBase {
  // 2pc: Normal and Charged Attack DMG +15% (via halfSetId)
  // 4pc: After using Elemental Skill, increases Normal Attack and Charged Attack DMG by 25% for 8s.
  readonly halfSetId = "na-ca-dmg%-15";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId, triggers: ["E"] },
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [{ key: "dmg%", value: 0.25 }]
    ),
  ];
}

@RegisterArtifactSet("resolution_of_sojourner")
class ResolutionOfSojourner4pc extends ArtifactSetBase {
  // 2pc: ATK +18% (via halfSetId)
  // 4pc: Increases Charged Attack CRIT Rate by 30%.
  readonly halfSetId = "atk%-18";
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactSet", id: this.artifactSetId },
      { receiver: "self", filter: { abilities: ["charge"] } },
      [{ key: "cr", value: 0.3 }]
    ),
  ];
}

@RegisterArtifactSet("scholar")
class Scholar4pc extends ArtifactSetBase {
  // 2pc: Energy Recharge +20% (via halfSetId)
  // 4pc: Gaining Elemental Particles or Orbs gives 3 Energy to all party members
  // who have a bow or a catalyst equipped. Energy grant is utility (U9 skip) — empty buffs.
  readonly halfSetId = "er-20";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}

@RegisterArtifactSet("the_exile")
class TheExile4pc extends ArtifactSetBase {
  // 2pc: Energy Recharge +20% (via halfSetId)
  // 4pc: Using an Elemental Burst regenerates 2 Energy for all party members
  // (excluding the wearer) every 2s for 6s. Energy regen is utility (U9 skip) — empty buffs.
  readonly halfSetId = "er-20";
  readonly stats: StatEntry[] = [];
  readonly buffs: StatBuff[] = [];
}
