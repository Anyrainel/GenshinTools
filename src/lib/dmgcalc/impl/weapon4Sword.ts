import { WeaponBase } from "../core/implModel";
import { RegisterWeapon, resolveOption } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { OptionDef } from "../types";
import { r, royalSeriesOption, wbs } from "./helpers";

@RegisterWeapon("moonweavers_dawn")
class MoonweaversDawn extends WeaponBase {
  get buffs() {
    const e = this.teamMeta.energies[this.charId] ?? 0;
    // Two tiers: Energy Capacity <=40 gives higher bonus, <=60 gives lower bonus
    const extraDmg =
      e > 0 && e <= 40
        ? r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56])
        : e > 0 && e <= 60
          ? r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32])
          : 0;
    return [
      new StatBuff(
        wbs(this),
        { receiver: "self", filter: { abilities: ["burst"] } },
        [
          {
            key: "dmg%",
            value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) + extraDmg,
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("serenitys_call")
class SerenitysCall extends WeaponBase {
  // HP% on reaction + Moonsign doubled
  get buffs() {
    const mult = this.teamMeta.countByFaction("Moonsign") >= 2 ? 2 : 1;
    return [
      new StatBuff(
        wbs(this, ["elemental-reaction", "moonsign"]),
        { receiver: "self" },
        [
          {
            key: "hp%",
            value: mult * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("calamity_of_eshu")
class CalamityOfEshu extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasShielder()) return [];
    return [
      new StatBuff(
        wbs(this, ["shield"]),
        { receiver: "self", filter: { abilities: ["normal", "charge"] } },
        [
          {
            key: "dmg%",
            value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
          },
          {
            key: "cr",
            value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("sturdy_bone")
class SturdyBone extends WeaponBase {
  // Normal Attack DMG increased by X% of ATK (additive baseDmg scaling)
  readonly buffs = [
    new ScalingBuff(
      wbs(this, ["sprint"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [],
      "atk",
      "baseDmg",
      r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32])
    ),
  ];
}

@RegisterWeapon("flute_of_ezpitzal")
class FluteOfEzpitzal extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "def%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
  ];
}

@RegisterWeapon("sword_of_narzissenkreuz")
class SwordOfNarzissenkreuz extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("the_dockhands_assistant")
class TheDockhands_assistant extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasHealer()) return [];
    return [
      new StatBuff(wbs(this, ["healed"]), { receiver: "self" }, [
        {
          key: "em",
          value: 3 * r(this.refinement, [40, 50, 60, 70, 80]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("wolffang")
class WolfFang extends WeaponBase {
  // E/Q DMG% (always) + 4-stack Skill CR + 4-stack Burst CR (separate)
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "cr",
          value: 4 * r(this.refinement, [0.02, 0.025, 0.03, 0.035, 0.04]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["Q"]),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [
        {
          key: "cr",
          value: 4 * r(this.refinement, [0.02, 0.025, 0.03, 0.035, 0.04]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("fleuve_cendre_ferryman")
class FleuveCendreFerryman extends WeaponBase {
  // Skill CR (skill-only) + ER after E
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [{ key: "cr", value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) }]
    ),
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "er", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
  ];
}

@RegisterWeapon("finale_of_the_deep")
class FinaleOfTheDeep extends WeaponBase {
  // ATK% after E + flat ATK from clearing Bond of Life (capped 150~300)
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
    new StatBuff(wbs(this, ["bond-of-life"]), { receiver: "self" }, [
      {
        key: "atk",
        value: r(this.refinement, [150, 187.5, 225, 262.5, 300]),
      },
    ]),
  ];
}

@RegisterWeapon("toukabou_shigure")
class ToukabouShigure extends WeaponBase {
  // DMG% against cursed enemy
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      { key: "dmg%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
  ];
}

@RegisterWeapon("xiphos_moonlight")
class XiphosMoonlight extends WeaponBase {
  // EM → ER scaling for self + 30% for team
  readonly buffs = [
    new ScalingBuff(
      wbs(this),
      { receiver: "self" },
      [],
      "em",
      "er",
      r(this.refinement, [0.00036, 0.00045, 0.00054, 0.00063, 0.00072])
    ),
    new ScalingBuff(
      wbs(this),
      { receiver: "other" },
      [],
      "em",
      "er",
      0.3 * r(this.refinement, [0.00036, 0.00045, 0.00054, 0.00063, 0.00072])
    ),
  ];
}

@RegisterWeapon("sapwood_blade")
class SapwoodBlade extends WeaponBase {
  // Dendro reaction → pick up leaf → EM for 12s
  get buffs() {
    if (!Object.values(this.teamMeta.elements).includes("Dendro")) return [];
    return [
      new StatBuff(
        wbs(this, ["dendro-reaction"], "leaf-of-consciousness-em"),
        { receiver: "teamOnField" },
        [{ key: "em", value: r(this.refinement, [60, 75, 90, 105, 120]) }]
      ),
    ];
  }
}

@RegisterWeapon("kagotsurube_isshin")
class KagotsurubeIsshin extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.15, 0.15, 0.15, 0.15, 0.15]),
      },
    ]),
  ];
}

// Blackcliff series: 3-stack on-kill ATK%
@RegisterWeapon("blackcliff_longsword")
class BlackcliffLongsword extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-kill"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 3 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("the_black_sword")
class TheBlackSword extends WeaponBase {
  // NA/CA DMG bonus (healing proc ignored)
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [{ key: "dmg%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
    ),
  ];
}

@RegisterWeapon("sword_of_descension")
class SwordOfDescension extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("iron_sting")
class IronSting extends WeaponBase {
  // 2-stack on elemental DMG
  readonly buffs = [
    new StatBuff(wbs(this, ["elemental-hit"]), { receiver: "self" }, [
      {
        key: "dmg%",
        value: 2 * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
      },
    ]),
  ];
}

@RegisterWeapon("cinnabar_spindle")
class CinnabarSpindle extends WeaponBase {
  // DEF × scale → additive base DMG for Elemental Skill
  readonly buffs = [
    new ScalingBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "def",
      "baseDmg",
      r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8])
    ),
  ];
}

@RegisterWeapon("prototype_rancour")
class PrototypeRancour extends WeaponBase {
  // 4-stack
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 4 * r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]),
      },
      {
        key: "def%",
        value: 4 * r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]),
      },
    ]),
  ];
}

@RegisterWeapon("favonius_sword")
class FavoniusSword extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("festering_desire")
class FesteringDesire extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
        {
          key: "cr",
          value: r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("the_flute")
class TheFlute extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("sacrificial_sword")
class SacrificialSword extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("the_alley_flash")
class TheAlleyFlash extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "dmg%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("royal_longsword", royalSeriesOption)
class RoyalLongsword extends WeaponBase {
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

@RegisterWeapon("amenoma_kageuchi")
class AmenomaKageuchi extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("prized_isshin_blade")
class PrizedIsshinBlade extends WeaponBase {
  // -50% all DMG (permanent). Proc DMG (180% ATK AoE, 8s CD) not modeled — engine gap: no weapon formula support.
  // HP restore (100% ATK) skipped per U9.
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "dmg%", value: -0.5 },
    ]),
  ];
}

@RegisterWeapon("lions_roar")
class LionsRoar extends WeaponBase {
  // Enemy affected by Pyro or Electro
  get buffs() {
    const els = Object.values(this.teamMeta.elements);
    if (!els.includes("Pyro") && !els.includes("Electro")) return [];
    return [
      new StatBuff(wbs(this, ["pyro-electro-enemy"]), { receiver: "self" }, [
        {
          key: "dmg%",
          value: r(this.refinement, [0.2, 0.24, 0.28, 0.32, 0.36]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("emberwell")
class Emberwell extends WeaponBase {
  get buffs() {
    const buffs = [
      new StatBuff(wbs(this, ["elemental-reaction"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
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

const hereticsMoltenBladeOption = {
  label: { zh: "移动距离", en: "Distance Traveled" },
  choices: [
    {
      value: "max",
      label: { zh: "持续移动（最高）", en: "Constant movement (max)" },
    },
    { value: "average", label: { zh: "期望平均", en: "Average" } },
    {
      value: "min",
      label: { zh: "原地不动（最低）", en: "Stationary (min)" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("heretics_molten_blade", hereticsMoltenBladeOption)
class HereticsMoltenBlade extends WeaponBase {
  private readonly o = resolveOption(hereticsMoltenBladeOption, this.option);

  // "Gleam of First Light" after E (14s, 14s CD): each second grants an ATK
  // bonus between the min and max values based on the distance moved in the
  // previous second. Removed on swap-out → selfOnField.
  get buffs() {
    const min = r(this.refinement, [0.18, 0.225, 0.27, 0.315, 0.36]);
    const max = r(this.refinement, [0.36, 0.45, 0.54, 0.63, 0.72]);
    const value =
      this.o === "max" ? max : this.o === "min" ? min : (min + max) / 2;
    return [
      new StatBuff(wbs(this, ["E"]), { receiver: "selfOnField" }, [
        { key: "atk%", value },
      ]),
    ];
  }
}

// Radiance (辉映·星超导 / 辉映·星扩散) is a character-side state that weapons
// cannot read, and it REPLACES the base bonus instead of adding to it, so it
// must be an explicit user toggle: the base branch is what every wielder gets,
// and the Radiance branch is opt-in. The "on" choice is only offered when the
// team can produce a Stellar reaction at all.
const weaponSwordOption = {
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

@RegisterWeapon("weapon_sword", weaponSwordOption)
class WeaponSword extends WeaponBase {
  private readonly radianceOn =
    resolveOption(weaponSwordOption, this.option, this.teamMeta) === "on";

  // BETA. In the 12s after E, every attack hit grants ATK% + EM for 6s, once
  // per second, max 3 stacks. Stacks also build off-field, so max stacks are
  // easy to maintain over the window — hardcoded at 3 per U8.
  //
  // Under Radiance the stack changes to a larger ATK% plus Stellar reaction
  // DMG% (a replacement, not an addition), selected by the option above.
  get buffs() {
    const stacks = 3;
    if (this.radianceOn) {
      return [
        new StatBuff(wbs(this, ["E", "on-hit"]), { receiver: "self" }, [
          {
            key: "atk%",
            value:
              stacks * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
          },
        ]),
        new StatBuff(
          wbs(this, ["E", "on-hit"]),
          {
            receiver: "self",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [
            {
              key: "reactionDmg%",
              value: stacks * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
            },
          ]
        ),
      ];
    }
    return [
      new StatBuff(wbs(this, ["E", "on-hit"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: stacks * r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]),
        },
        { key: "em", value: stacks * r(this.refinement, [20, 25, 30, 35, 40]) },
      ]),
    ];
  }
}
