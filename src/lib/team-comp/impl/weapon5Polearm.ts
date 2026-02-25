import { ErScalingBuff, ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase } from "../damageModels";
import { allElementalDmg, r, wbs } from "../helpers";

// ══════════════════════════
// 5★ Polearms
// ══════════════════════════

@RegisterWeapon("crimson_moons_semblance")
class CrimsonMoonsSemblance extends WeaponBase {
  // Bond of Life present + ≥30% Max HP: both DMG bonuses active
  readonly buffs = [
    new StatBuff(wbs(this, ["bond-of-life"]), { receiver: "self" }, [
      {
        key: "dmg%",
        value:
          r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]) +
          r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
      },
    ]),
  ];
}

@RegisterWeapon("lumidouce_elegy")
class LumidouceElegy extends WeaponBase {
  // ATK% + 2-stack Burning/Dendro interaction
  readonly buffs = [
    new StatBuff(wbs(this, ["burning"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.15, 0.19, 0.23, 0.27, 0.31]),
      },
      {
        key: "dmg%",
        value: 2 * r(this.refinement, [0.18, 0.23, 0.28, 0.33, 0.38]),
      },
    ]),
  ];
}

@RegisterWeapon("bloodsoaked_ruins")
class BloodsoakedRuins extends WeaponBase {
  get buffs() {
    const buffs: import("../damageBuffs").StatBuff[] = [];
    if (this.teamMeta.hasReaction("electroCharged", this.charId)) {
      buffs.push(
        new StatBuff(
          wbs(this, ["Q", "electroCharged"]),
          {
            receiver: "self",
            filter: { reactions: ["electroCharged", "lunarCharged"] },
          },
          [
            {
              key: "reactionDmg%",
              value: r(this.refinement, [0.36, 0.48, 0.6, 0.72, 0.84]),
            },
          ]
        ),
        new StatBuff(wbs(this, ["lunarCharged"]), { receiver: "self" }, [
          {
            key: "cd",
            value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
          },
        ])
      );
    }
    return buffs;
  }
}

@RegisterWeapon("fractured_halo")
class FracturedHalo extends WeaponBase {
  get buffs() {
    const buffs: import("../damageBuffs").StatBuff[] = [
      new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
        },
      ]),
    ];
    if (this.teamMeta.hasShielder()) {
      buffs.push(
        new StatBuff(
          wbs(this, ["E", "shield"], "fractured-halo-lunar-charged-dmg"),
          {
            receiver: "team",
            filter: { reactions: ["lunarCharged"] },
          },
          [
            {
              key: "reactionDmg%",
              value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("symphonist_of_scents")
class SymphonistOfScents extends WeaponBase {
  get buffs() {
    const buffs: import("../damageBuffs").StatBuff[] = [
      new StatBuff(wbs(this, ["off-field"]), { receiver: "self" }, [
        {
          key: "atk%",
          value:
            r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]) +
            r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]),
    ];
    if (this.teamMeta.hasHealer()) {
      buffs.push(
        new StatBuff(wbs(this, ["heal"]), { receiver: "self" }, [
          {
            key: "atk%",
            value: r(this.refinement, [0.32, 0.4, 0.48, 0.56, 0.64]),
          },
        ])
      );
    }
    return buffs;
  }
}

@RegisterWeapon("staff_of_homa")
class StaffOfHoma extends WeaponBase {
  readonly buffs = [
    new ScalingBuff(
      wbs(this, ["self-low-hp"]),
      { receiver: "self" },
      [{ key: "hp%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }],
      "hp",
      "atk",
      r(this.refinement, [0.008, 0.01, 0.012, 0.014, 0.016]) +
        r(this.refinement, [0.01, 0.012, 0.014, 0.016, 0.018])
    ),
  ];
}

@RegisterWeapon("staff_of_the_scarlet_sands")
class StaffOfTheScarletSands extends WeaponBase {
  // Base EM→ATK + 3-stack dream (best case)
  readonly buffs = [
    new ScalingBuff(
      wbs(this, ["E"]),
      { receiver: "self" },
      [],
      "em",
      "atk",
      r(this.refinement, [0.52, 0.65, 0.78, 0.91, 1.04]) +
        3 * r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56])
    ),
  ];
}

@RegisterWeapon("engulfing_lightning")
class EngulfingLightning extends WeaponBase {
  // ER over 100% × scale → ATK% (capped), plus ER buff after burst
  readonly buffs = [
    new StatBuff(wbs(this, ["Q"]), { receiver: "self" }, [
      { key: "er", value: r(this.refinement, [0.3, 0.35, 0.4, 0.45, 0.5]) },
    ]),
    new ErScalingBuff(
      wbs(this),
      { receiver: "self" },
      [],
      "atk%",
      r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      r(this.refinement, [0.8, 0.9, 1.0, 1.1, 1.2])
    ),
  ];
}

@RegisterWeapon("primordial_jade_wingedspear")
class PrimordialJadeWingedSpear extends WeaponBase {
  // 7-stack ATK% + max-stack DMG%
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 7 * r(this.refinement, [0.032, 0.039, 0.046, 0.053, 0.06]),
      },
      {
        key: "dmg%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("calamity_queller")
class CalamityQueller extends WeaponBase {
  // Elemental DMG + 6-stack Consummation (off-field doubled)
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      ...allElementalDmg(r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24])),
      {
        key: "atk%",
        value: 6 * 2 * r(this.refinement, [0.032, 0.04, 0.048, 0.056, 0.064]),
      },
    ]),
  ];
}

@RegisterWeapon("vortex_vanquisher")
class VortexVanquisher extends WeaponBase {
  get buffs() {
    const mult = this.teamMeta.hasShielder() ? 2 : 1;
    return [
      new StatBuff(wbs(this, ["shield"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: 5 * mult * r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("skyward_spine")
class SkywardSpine extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "cr", value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) },
    ]),
  ];
}
