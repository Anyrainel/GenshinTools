import { ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase, resolveOption } from "../damageModels";
import type { OptionDef } from "../damageModels";
import { ALL_ELEMENTAL_FILTER, r, wbs } from "../helpers";
import type { StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Polearms
// ═══════════════════════════════════════════════════════════════

@RegisterWeapon("sacrificers_staff")
class SacrificersStaff extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
      {
        key: "er",
        value: 3 * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
      },
    ]),
  ];
}

@RegisterWeapon("prospectors_shovel")
class ProspectorsShovel extends WeaponBase {
  get buffs() {
    const isAscendant = this.teamMeta.countByFaction("Moonsign") >= 2;
    return [
      new StatBuff(
        wbs(this, ["moonsign"]),
        { receiver: "self", filter: { reactions: ["electroCharged"] } },
        [
          {
            key: "reactionDmg%",
            value: r(this.refinement, [0.48, 0.6, 0.72, 0.84, 0.96]),
          },
        ]
      ),
      new StatBuff(
        wbs(this, ["moonsign"]),
        { receiver: "self", filter: { reactions: ["lunarCharged"] } },
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

@RegisterWeapon("tamayuratei_no_ohanashi")
class TamayurateiNoOhanashi extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
  ];
}

@RegisterWeapon("mountainbracing_bolt")
class MountainBracingBolt extends WeaponBase {
  // E Skill DMG% (base + teammate E trigger assumed active)
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value:
            r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]) +
            r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("footprint_of_the_rainbow")
class FootprintOfTheRainbow extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "def%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
  ];
}

@RegisterWeapon("dialogues_of_the_desert_sages")
class DialoguesOfTheDesertSages extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("prospectors_drill")
class ProspectorsDrill extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasHealer()) return [];
    return [
      new StatBuff(wbs(this, ["healed"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: 3 * r(this.refinement, [0.03, 0.04, 0.05, 0.06, 0.07]),
        },
      ]),
      new StatBuff(
        wbs(this, ["healed"]),
        { receiver: "self", filter: ALL_ELEMENTAL_FILTER },
        [
          {
            key: "dmg%",
            value: 3 * r(this.refinement, [0.07, 0.085, 0.1, 0.115, 0.13]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("ballad_of_the_fjords")
class BalladOfTheFjords extends WeaponBase {
  // ≥3 different element types in party → EM
  get buffs() {
    const elementCount = new Set(Object.values(this.teamMeta.elements)).size;
    if (elementCount < 3) return [];
    return [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "em", value: r(this.refinement, [120, 150, 180, 210, 240]) },
      ]),
    ];
  }
}

@RegisterWeapon("rightful_reward")
class RightfulReward extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("missive_windspear")
class MissiveWindspear extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["elemental-reaction"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
      { key: "em", value: r(this.refinement, [48, 60, 72, 84, 96]) },
    ]),
  ];
}

@RegisterWeapon("moonpiercer")
class Moonpiercer extends WeaponBase {
  // Dendro reaction → pick up leaf → ATK% for 12s
  get buffs() {
    if (!Object.values(this.teamMeta.elements).includes("Dendro")) return [];
    return [
      new StatBuff(
        wbs(this, ["dendro-reaction"], "leaf-of-revival-atk"),
        { receiver: "teamOnField" },
        [
          {
            key: "atk%",
            value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("dragonspine_spear")
class DragonspineSpear extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("blackcliff_pole")
class BlackcliffPole extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-kill"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 3 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("prototype_starglitter")
class PrototypeStarglitter extends WeaponBase {
  // 2-stack after E: Normal and Charged Attack DMG
  readonly buffs = [
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: 2 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: 2 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("favonius_lance")
class FavoniusLance extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("crescent_pike")
class CrescentPike extends WeaponBase {
  readonly buffs = [
    new ScalingBuff(
      wbs(this, ["particle"]),
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [],
      "atk",
      "baseDmg",
      r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4])
    ),
  ];
}

@RegisterWeapon("wavebreakers_fin")
class WavebreakersFin extends WeaponBase {
  get buffs() {
    let totalEnergy = 0;
    for (const id of this.teamMeta.characters) {
      totalEnergy += this.teamMeta.energies[id] ?? 0;
    }
    return [
      new StatBuff(
        wbs(this),
        { receiver: "self", filter: { abilities: ["burst"] } },
        [
          {
            key: "dmg%",
            value: Math.min(
              totalEnergy *
                r(this.refinement, [0.0012, 0.0015, 0.0018, 0.0021, 0.0024]),
              r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8])
            ),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("royal_spear")
class RoyalSpear extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "cr",
        value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
    ]),
  ];
}

@RegisterWeapon("kitain_cross_spear")
class KitainCrossSpear extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
        },
      ]
    ),
  ];
}

// Lithic series: scales with number of Liyue characters on team
@RegisterWeapon("lithic_spear")
class LithicSpear extends WeaponBase {
  get buffs() {
    const liyueCount = this.teamMeta.countByRegion("Liyue");
    return [
      new StatBuff(wbs(this), { receiver: "self" }, [
        {
          key: "atk%",
          value: liyueCount * r(this.refinement, [0.07, 0.08, 0.09, 0.1, 0.11]),
        },
        {
          key: "cr",
          value:
            liyueCount * r(this.refinement, [0.03, 0.04, 0.05, 0.06, 0.07]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("dragons_bane")
class DragonsBane extends WeaponBase {
  get buffs() {
    const teamEls = Object.values(this.teamMeta.elements);
    if (!teamEls.includes("Hydro") && !teamEls.includes("Pyro")) return [];
    return [
      new StatBuff(wbs(this, ["hydro-pyro-enemy"]), { receiver: "self" }, [
        {
          key: "dmg%",
          value: r(this.refinement, [0.2, 0.24, 0.28, 0.32, 0.36]),
        },
      ]),
    ];
  }
}

const deathmatchOption = {
  label: { zh: "敌人数量", en: "Enemy Count" },
  choices: [
    {
      value: "gte2",
      label: { zh: "至少2个敌人", en: "At least 2 enemies" },
    },
    {
      value: "lt2",
      label: { zh: "少于2个敌人", en: "Fewer than 2 enemies" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("deathmatch", deathmatchOption)
class Deathmatch extends WeaponBase {
  private readonly o = resolveOption(deathmatchOption, this.option);

  get buffs() {
    if (this.o === "lt2") {
      return [
        new StatBuff(wbs(this), { receiver: "self" }, [
          {
            key: "atk%",
            value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
          },
        ]),
      ];
    }
    return [
      new StatBuff(wbs(this), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
        {
          key: "def%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("the_catch")
class TheCatch extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["burst"] } },
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
