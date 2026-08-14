import type { ElementalOrPhysical } from "@/data/enums";
import type { StatEntry } from "@/data/types";
import { WeaponBase } from "../core/implModel";
import { RegisterWeapon, resolveOption } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { OptionDef } from "../types";
import { ALL_ELEMENTAL_FILTER, r, royalSeriesOption, wbs } from "./helpers";

@RegisterWeapon("dawning_frost")
class DawningFrost extends WeaponBase {
  // EM after CA hit; EM after E hit
  readonly buffs = [
    new StatBuff(wbs(this, ["charge"]), { receiver: "self" }, [
      { key: "em", value: r(this.refinement, [72, 90, 108, 126, 144]) },
    ]),
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "em", value: r(this.refinement, [48, 60, 72, 84, 96]) },
    ]),
  ];
}

@RegisterWeapon("etherlight_spindlelute")
class EtherlightSpindlelute extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "em", value: r(this.refinement, [100, 125, 150, 175, 200]) },
    ]),
  ];
}

@RegisterWeapon("blackmarrow_lantern")
class BlackmarrowLantern extends WeaponBase {
  get buffs() {
    const isAscendant = this.teamMeta.countByFaction("Moonsign") >= 2;
    return [
      new StatBuff(
        wbs(this, ["moonsign"]),
        { receiver: "self", filter: { reactions: ["bloom"] } },
        [
          {
            key: "reactionDmg%",
            value: r(this.refinement, [0.48, 0.6, 0.72, 0.84, 0.96]),
          },
        ]
      ),
      new StatBuff(
        wbs(this, ["moonsign"]),
        { receiver: "self", filter: { reactions: ["lunarBloom"] } },
        [
          {
            key: "reactionDmg%",
            value:
              r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]) +
              (isAscendant
                ? r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24])
                : 0),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("waveriding_whirl")
class WaveridingWhirl extends WeaponBase {
  get buffs() {
    const hydroCount = this.teamMeta.countByElement("Hydro");
    const perHydro = r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]);
    const hydroBonus = Math.min(hydroCount * perHydro, 2 * perHydro);
    return [
      new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
        {
          key: "hp%",
          value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) + hydroBonus,
        },
      ]),
    ];
  }
}

@RegisterWeapon("ring_of_yaxche")
class RingOfYaxche extends WeaponBase {
  // HP → NA DMG scaling (modeled as ScalingBuff)
  readonly buffs = [
    new ScalingBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [],
      "hp",
      "dmg%",
      r(this.refinement, [0.0006, 0.0007, 0.0008, 0.0009, 0.001]),
      r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32])
    ),
  ];
}

@RegisterWeapon("ashgraven_drinking_horn")
class AshGravenDrinkingHorn extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("ballad_of_the_boundless_blue")
class BalladOfTheBoundlessBlue extends WeaponBase {
  // 3-stack NA/CA DMG
  readonly buffs = [
    new StatBuff(
      wbs(this, ["on-hit"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["on-hit"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: 3 * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
        },
      ]
    ),
  ];
}

const widsithOption = {
  label: { zh: "出场主题", en: "Theme Song" },
  choices: [
    {
      value: "recitative",
      label: { zh: "宣叙调 (攻击力)", en: "Recitative (ATK)" },
    },
    {
      value: "aria",
      label: { zh: "咏叹调 (全元素伤害)", en: "Aria (All Elemental DMG)" },
    },
    {
      value: "interlude",
      label: { zh: "间奏曲 (元素精通)", en: "Interlude (EM)" },
    },
    { value: "average", label: { zh: "期望平均", en: "Average" } },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("the_widsith", widsithOption)
class TheWidsith extends WeaponBase {
  private readonly o = resolveOption(widsithOption, this.option);

  get buffs() {
    const rLvl = this.refinement;
    const atkBase = r(rLvl, [0.6, 0.75, 0.9, 1.05, 1.2]);
    const dmgBase = r(rLvl, [0.48, 0.6, 0.72, 0.84, 0.96]);
    const emBase = r(rLvl, [240, 300, 360, 420, 480]);

    if (this.o === "recitative") {
      return [
        new StatBuff(wbs(this, ["swap-in"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: atkBase },
        ]),
      ];
    }
    if (this.o === "aria") {
      return [
        new StatBuff(
          wbs(this, ["swap-in"]),
          { receiver: "selfOnField", filter: ALL_ELEMENTAL_FILTER },
          [{ key: "dmg%", value: dmgBase }]
        ),
      ];
    }
    if (this.o === "interlude") {
      return [
        new StatBuff(wbs(this, ["swap-in"]), { receiver: "selfOnField" }, [
          { key: "em", value: emBase },
        ]),
      ];
    }

    // Average
    return [
      new StatBuff(wbs(this, ["swap-in"]), { receiver: "selfOnField" }, [
        { key: "atk%", value: atkBase / 3 },
        { key: "em", value: emBase / 3 },
      ]),
      new StatBuff(
        wbs(this, ["swap-in"]),
        { receiver: "selfOnField", filter: ALL_ELEMENTAL_FILTER },
        [{ key: "dmg%", value: dmgBase / 3 }]
      ),
    ];
  }
}

@RegisterWeapon("sacrificial_jade")
class SacrificialJade extends WeaponBase {
  // Off-field buff (10s on-field timer)
  readonly buffs = [
    new StatBuff(wbs(this, ["off-field"]), { receiver: "self" }, [
      { key: "hp%", value: r(this.refinement, [0.32, 0.4, 0.48, 0.56, 0.64]) },
      { key: "em", value: r(this.refinement, [40, 50, 60, 70, 80]) },
    ]),
  ];
}

@RegisterWeapon("flowing_purity")
class FlowingPurity extends WeaponBase {
  // E trigger + bond cleared (max)
  readonly buffs = [
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: ALL_ELEMENTAL_FILTER },
      [
        {
          key: "dmg%",
          value:
            r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) +
            r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("wandering_evenstar")
class WanderingEvenstar extends WeaponBase {
  // EM → ATK for self + 30% for team
  readonly buffs = [
    new ScalingBuff(
      wbs(this),
      { receiver: "self" },
      [],
      "em",
      "atk",
      r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48])
    ),
    // Game text: stacks from multiple copies
    new ScalingBuff(
      wbs(this),
      { receiver: "other" },
      [],
      "em",
      "atk",
      0.3 * r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48])
    ),
  ];
}

@RegisterWeapon("fruit_of_fulfillment")
class FruitOfFulfillment extends WeaponBase {
  // 5-stack EM-gain / ATK-loss
  readonly buffs = [
    new StatBuff(wbs(this, ["elemental-reaction"]), { receiver: "self" }, [
      { key: "em", value: 5 * r(this.refinement, [24, 27, 30, 33, 36]) },
      { key: "atk%", value: -5 * 0.05 },
    ]),
  ];
}

@RegisterWeapon("blackcliff_agate")
class BlackcliffAgate extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-kill"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 3 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("prototype_amber")
class PrototypeAmber extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("oathsworn_eye")
class OathswornEye extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "er", value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]) },
    ]),
  ];
}

@RegisterWeapon("favonius_codex")
class FavoniusCodex extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("sacrificial_fragments")
class SacrificialFragments extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("hakushin_ring")
class HakushinRing extends WeaponBase {
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    if (!wielderElement) return [];

    const buffedElements = new Set<string>();

    if (wielderElement === "Electro") {
      // (1) If wearer is Electro, buff all teammates' elements (ideal scenario)
      for (const el of Object.values(this.teamMeta.elements)) {
        if (el) buffedElements.add(el);
      }
    } else {
      // (2) If wearer is not Electro but team contains Electro
      const teamHasElectro = Object.values(this.teamMeta.elements).includes(
        "Electro"
      );
      if (teamHasElectro) {
        buffedElements.add(wielderElement);
        buffedElements.add("Electro");
      }
    }

    if (buffedElements.size === 0) {
      // (3) otherwise, do nothing
      return [];
    }

    return [
      new StatBuff(
        wbs(this, ["electro-reaction"], "hakushin-ring"),
        {
          receiver: "team",
          filter: {
            elements: [...buffedElements].sort() as ElementalOrPhysical[],
          },
        },
        [
          {
            key: "dmg%",
            value: r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("wine_and_song")
class WineAndSong extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["sprint"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
  ];
}

@RegisterWeapon("eye_of_perception")
class EyeOfPerception extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("frostbearer")
class Frostbearer extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("royal_grimoire", royalSeriesOption)
class RoyalGrimoire extends WeaponBase {
  private readonly o = resolveOption(royalSeriesOption, this.option);

  // Stacks reset on CRIT — effective count depends on CRIT Rate. Default 3.
  get buffs() {
    const stacks = Number(this.o);
    return [
      new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
        {
          key: "cr",
          value: stacks * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("dodoco_tales")
class DodocoTales extends WeaponBase {
  // Both cross-buffs assumed active
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) },
    ]),
  ];
}

@RegisterWeapon("solar_pearl")
class SolarPearl extends WeaponBase {
  // Both cross-buffs assumed active:
  // NA hit → Skill+Burst DMG buff; Skill/Burst hit → NA DMG buff
  readonly buffs = [
    new StatBuff(
      wbs(this, ["normal"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
    ),
    new StatBuff(
      wbs(this, ["normal"]),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "dmg%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
    ),
    new StatBuff(
      wbs(this, ["E", "Q"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [{ key: "dmg%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
    ),
  ];
}

@RegisterWeapon("mappa_mare")
class MappaMare extends WeaponBase {
  // 2-stack elemental DMG on reaction
  readonly buffs = [
    new StatBuff(
      wbs(this, ["elemental-reaction"]),
      { receiver: "self", filter: ALL_ELEMENTAL_FILTER },
      [
        {
          key: "dmg%",
          value: 2 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("echoes_of_the_heart")
class EchoesOfTheHeart extends WeaponBase {
  get buffs() {
    const buffs = [
      new StatBuff(wbs(this, ["elemental-reaction"]), { receiver: "self" }, [
        { key: "em", value: r(this.refinement, [60, 75, 90, 105, 120]) },
      ]),
    ];
    if (
      this.teamMeta.hasReaction("stellarConduct", this.charId) ||
      this.teamMeta.hasReaction("stellarSwirl", this.charId)
    ) {
      buffs.push(
        new StatBuff(
          wbs(this, ["stellar-reaction"]),
          {
            receiver: "self",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [
            {
              key: "reactionDmg%",
              value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("clash_of_kings")
class ClashOfKings extends WeaponBase {
  // "Laws of the Board" after E: ATK% + EM for 6s, once every 12s. Charged
  // Attack hits only extend the duration (no stat change), so they're ignored.
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      { key: "em", value: r(this.refinement, [100, 125, 150, 175, 200]) },
    ]),
  ];
}

// Radiance (辉映·星超导 / 辉映·星扩散) is a character-side state that weapons
// cannot read, and it REPLACES the base bonus instead of adding to it, so it
// must be an explicit user toggle: the base branch is what every wielder gets,
// and the Radiance branch is opt-in. The "on" choice is only offered when the
// team can produce a Stellar reaction at all. Mirrors weapon_sword.
const weaponCatalystOption = {
  label: { zh: "辉映状态", en: "Radiance State" },
  choices: [
    { value: "off", label: { zh: "关闭", en: "Off" } },
    {
      value: "on",
      label: { zh: "开启", en: "On" },
      when: (tm) =>
        tm.hasReaction("stellarConduct") || tm.hasReaction("stellarSwirl"),
    },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("weapon_catalyst", weaponCatalystOption)
class WeaponCatalyst extends WeaponBase {
  private readonly radianceOn =
    resolveOption(weaponCatalystOption, this.option, this.teamMeta) === "on";

  // BETA. Party-composition scaling: each Cryo party member grants EM, each
  // Electro party member grants ATK%. The wielder counts toward their own
  // element. Both clauses are unconditional, so no trigger label.
  //
  // Under Radiance this is replaced: every Cryo or Electro member instead
  // grants EM plus Stellar reaction DMG%, for at most 4 counted characters.
  //
  // ZH/EN differ on the Radiance EM at R4 (35 vs 30) — ZH wins per beta rules.
  get buffs() {
    let cryo = 0;
    let electro = 0;
    for (const id of this.teamMeta.characters) {
      const el = this.teamMeta.elements[id];
      if (el === "Cryo") cryo++;
      else if (el === "Electro") electro++;
    }

    if (this.radianceOn) {
      const counted = Math.min(cryo + electro, 4);
      if (counted === 0) return [];
      return [
        new StatBuff(wbs(this), { receiver: "self" }, [
          {
            key: "em",
            value: counted * r(this.refinement, [20, 25, 30, 35, 40]),
          },
        ]),
        new StatBuff(
          wbs(this),
          {
            receiver: "self",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [
            {
              key: "reactionDmg%",
              value:
                counted * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
            },
          ]
        ),
      ];
    }

    const stats: StatEntry[] = [];
    if (cryo > 0) {
      stats.push({
        key: "em",
        value: cryo * r(this.refinement, [24, 30, 36, 42, 48]),
      });
    }
    if (electro > 0) {
      stats.push({
        key: "atk%",
        value: electro * r(this.refinement, [0.048, 0.06, 0.072, 0.084, 0.096]),
      });
    }
    if (stats.length === 0) return [];
    return [new StatBuff(wbs(this), { receiver: "self" }, stats)];
  }
}
