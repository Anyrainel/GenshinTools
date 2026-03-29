import { ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase, resolveOption } from "../damageModels";
import type { OptionDef } from "../damageModels";
import { allElementalDmg, r, wbs } from "../helpers";
import type { StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Bows
// ═══════════════════════════════════════════════════════════════

@RegisterWeapon("rainbow_serpents_rain_bow")
class RainbowSerpentsRainBow extends WeaponBase {
  // ATK% while off-field hits
  readonly buffs = [
    new StatBuff(wbs(this, ["off-field"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      },
    ]),
  ];
}

@RegisterWeapon("snare_hook")
class SnareHook extends WeaponBase {
  // EM on reaction + Moonsign doubled
  get buffs() {
    const cid = this.charId;
    const canReact =
      this.teamMeta.hasReaction("vaporize", cid) ||
      this.teamMeta.hasReaction("melt", cid) ||
      this.teamMeta.hasReaction("overloaded", cid) ||
      this.teamMeta.hasReaction("electroCharged", cid) ||
      this.teamMeta.hasReaction("superconduct", cid) ||
      this.teamMeta.hasReaction("frozen", cid) ||
      this.teamMeta.hasReaction("bloom", cid) ||
      this.teamMeta.hasReaction("burning", cid) ||
      this.teamMeta.hasReaction("quicken", cid) ||
      this.teamMeta.hasReaction("swirl", cid) ||
      this.teamMeta.hasReaction("crystallize", cid);
    if (!canReact) return [];
    const mult = this.teamMeta.countByFaction("Moonsign") >= 2 ? 2 : 1;
    return [
      new StatBuff(
        wbs(this, ["elemental-reaction", "moonsign"]),
        { receiver: "self" },
        [
          {
            key: "em",
            value: mult * r(this.refinement, [60, 75, 90, 105, 120]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("sequence_of_solitude")
class SequenceOfSolitude extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("flowerwreathed_feathers")
class FlowerWreathedFeathers extends WeaponBase {
  // 6-stack (max) CA DMG from aimed shots
  readonly buffs = [
    new StatBuff(
      wbs(this, ["aim"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: 6 * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("chain_breaker")
class ChainBreaker extends WeaponBase {
  // ATK% per member who is from Natlan OR has a different element from wielder
  // EM bonus (flat) when qualifying count >= 3
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    let qualifyingCount = 0;
    for (const id of this.teamMeta.characters) {
      if (id === this.charId) continue;
      const isNatlan = this.teamMeta.regions[id] === "Natlan";
      const isDiffElement = this.teamMeta.elements[id] !== wielderElement;
      if (isNatlan || isDiffElement) qualifyingCount++;
    }
    const stats: Array<{ key: StatKey; value: number }> = [
      {
        key: "atk%",
        value:
          qualifyingCount *
          r(this.refinement, [0.048, 0.06, 0.072, 0.084, 0.096]),
      },
    ];
    if (qualifyingCount >= 3) {
      stats.push({
        key: "em",
        value: r(this.refinement, [24, 30, 36, 42, 48]),
      });
    }
    return [new StatBuff(wbs(this), { receiver: "self" }, stats)];
  }
}
@RegisterWeapon("cloudforged")
class Cloudforged extends WeaponBase {
  // 2-stack EM after energy decrease
  readonly buffs = [
    new StatBuff(wbs(this, ["energy-decrease"]), { receiver: "self" }, [
      { key: "em", value: 2 * r(this.refinement, [40, 50, 60, 70, 80]) },
    ]),
  ];
}

@RegisterWeapon("range_gauge")
class RangeGauge extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasHealer()) return [];
    return [
      new StatBuff(wbs(this, ["healed"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: 3 * r(this.refinement, [0.03, 0.04, 0.05, 0.06, 0.07]),
        },
        ...allElementalDmg(
          3 * r(this.refinement, [0.07, 0.085, 0.1, 0.115, 0.13])
        ),
      ]),
    ];
  }
}

@RegisterWeapon("scion_of_the_blazing_sun")
class ScionOfTheBlazingSun extends WeaponBase {
  // CA proc effect — mainly CA DMG buff after proc
  readonly buffs = [
    new StatBuff(
      wbs(this, ["charge"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
        },
      ]
    ),
  ];
}

const fadingTwilightOption = {
  label: { zh: "随时间转换状态", en: "State" },
  choices: [
    { value: "average", label: { zh: "期望平均", en: "Average" } },
    { value: "evengleam", label: { zh: "夕暮", en: "Evengleam" } },
    { value: "afterglow", label: { zh: "流霞", en: "Afterglow" } },
    { value: "dawnblaze", label: { zh: "朝辉", en: "Dawnblaze" } },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("fading_twilight", fadingTwilightOption)
class FadingTwilight extends WeaponBase {
  private readonly o = resolveOption(fadingTwilightOption, this.option);

  get buffs() {
    const valEvengleam = r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]);
    const valAfterglow = r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]);
    const valDawnblaze = r(this.refinement, [0.14, 0.175, 0.21, 0.245, 0.28]);

    let value = (valEvengleam + valAfterglow + valDawnblaze) / 3;
    if (this.o === "evengleam") value = valEvengleam;
    else if (this.o === "afterglow") value = valAfterglow;
    else if (this.o === "dawnblaze") value = valDawnblaze;

    return [
      new StatBuff(wbs(this), { receiver: "self" }, [{ key: "dmg%", value }]),
    ];
  }
}

@RegisterWeapon("song_of_stillness")
class SongOfStillness extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasHealer()) return [];
    return [
      new StatBuff(wbs(this, ["healed"]), { receiver: "self" }, [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("ibis_piercer")
class IbisPiercer extends WeaponBase {
  // 2-stack EM from CA
  readonly buffs = [
    new StatBuff(wbs(this, ["charge"]), { receiver: "self" }, [
      { key: "em", value: 2 * r(this.refinement, [40, 50, 60, 70, 80]) },
    ]),
  ];
}

@RegisterWeapon("kings_squire")
class KingsSquire extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E", "Q"]), { receiver: "selfOnField" }, [
      { key: "em", value: r(this.refinement, [60, 80, 100, 120, 140]) },
    ]),
  ];
}

@RegisterWeapon("end_of_the_line")
class EndOfTheLine extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("blackcliff_warbow")
class BlackcliffWarbow extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-kill"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 3 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("windblume_ode")
class WindblumeOde extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
  ];
}

@RegisterWeapon("compound_bow")
class CompoundBow extends WeaponBase {
  // 4-stack
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 4 * r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]),
      },
      {
        key: "atkSpd%",
        value: 4 * r(this.refinement, [0.012, 0.015, 0.018, 0.021, 0.024]),
      },
    ]),
  ];
}

@RegisterWeapon("prototype_crescent")
class PrototypeCrescent extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["weakpoint"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.36, 0.45, 0.54, 0.63, 0.72]),
      },
    ]),
  ];
}

@RegisterWeapon("favonius_warbow")
class FavoniusWarbow extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("the_viridescent_hunt")
class TheViridescentHunt extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("the_stringless")
class TheStringless extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill", "burst"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("sacrificial_bow")
class SacrificialBow extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("hamayumi")
class Hamayumi extends WeaponBase {
  // Full energy → doubled effect
  readonly buffs = [
    new StatBuff(
      wbs(this, ["full-energy"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: 2 * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["full-energy"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: 2 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("mouuns_moon")
class MouunsMoon extends WeaponBase {
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

@RegisterWeapon("alley_hunter")
class AlleyHunter extends WeaponBase {
  // Max off-field stacks assumed
  readonly buffs = [
    new StatBuff(wbs(this, ["off-field"]), { receiver: "self" }, [
      { key: "dmg%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
  ];
}

@RegisterWeapon("predator")
class Predator extends WeaponBase {
  get buffs() {
    // Note: PlayStation Network effect, 2-stack assumed
    const buffs: StatBuff[] = [
      new StatBuff(
        wbs(this, ["cryo-dmg"]),
        { receiver: "self", filter: { abilities: ["normal", "charge"] } },
        [
          {
            key: "dmg%",
            value: 2 * r(this.refinement, [0.1, 0.1, 0.1, 0.1, 0.1]),
          },
        ] // predator only has R1
      ),
    ];
    if (this.charId === "aloy") {
      buffs.push(
        new StatBuff(wbs(this), { receiver: "self" }, [
          { key: "atk", value: 66 }, // Flat ATK
        ])
      );
    }
    return buffs;
  }
}

@RegisterWeapon("rust")
class Rust extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [{ key: "dmg%", value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]) }]
    ),
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: -0.1 }]
    ),
  ];
}

@RegisterWeapon("mitternachts_waltz")
class MitternachtsWaltz extends WeaponBase {
  // Both cross-buffs (skill -> normal, normal -> skill) assumed active
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill", "normal"] } },
      [{ key: "dmg%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
    ),
  ];
}

// Royal series: 5-stack CR on hit (resets on crit) — model at 3 stacks (average)
@RegisterWeapon("royal_bow")
class RoyalBow extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "cr",
        value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
    ]),
  ];
}
