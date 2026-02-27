import { ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase, resolveOption } from "../damageModels";
import { allElementalDmg, r, wbs } from "../helpers";
import type { OptionDef, StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Catalysts
// ═══════════════════════════════════════════════════════════════

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
    const isAscendant = this.teamMeta.countByRegion("Nod-Krai") >= 2;
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
  default: "recitative",
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
        new StatBuff(wbs(this, ["swap-in"]), { receiver: "selfOnField" }, [
          ...allElementalDmg(dmgBase),
        ]),
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
        ...allElementalDmg(dmgBase / 3),
        { key: "em", value: emBase / 3 },
      ]),
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
      { receiver: "self" },
      allElementalDmg(
        r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) +
          r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24])
      )
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
      { receiver: "team" },
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

    const statEntries = Array.from(buffedElements).map((el) => {
      return {
        key: `${el.toLowerCase()}%` as StatKey,
        value: r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
      };
    });

    return [
      new StatBuff(
        wbs(this, ["electro-reaction"], "hakushin-ring"),
        { receiver: "team" },
        statEntries
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

@RegisterWeapon("royal_grimoire")
class RoyalGrimoire extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "cr",
        value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
    ]),
  ];
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
      { receiver: "self" },
      allElementalDmg(2 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]))
    ),
  ];
}
