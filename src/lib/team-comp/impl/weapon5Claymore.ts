import { ScalingMultiBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase } from "../damageModels";
import { r, wbs } from "../helpers";

// ══════════════════════════
// 5★ Claymores
// ══════════════════════════

@RegisterWeapon("a_thousand_blazing_suns")
class AThousandBlazingSuns extends WeaponBase {
  // 2-stack Scorching Brilliance (E/Q triggers)
  readonly buffs = [
    new StatBuff(wbs(this, ["E", "Q"]), { receiver: "self" }, [
      { key: "cd", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      {
        key: "atk%",
        value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      },
    ]),
  ];
}

@RegisterWeapon("fang_of_the_mountain_king")
class FangOfTheMountainKing extends WeaponBase {
  // 6-stack Canopy's Favor: max E Skill + E Burst DMG
  readonly buffs = [
    new StatBuff(wbs(this, ["E", "burning"]), { receiver: "self" }, [
      {
        key: "dmg%",
        value: 6 * r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
      },
      {
        key: "dmg%",
        value: 6 * r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
      },
    ]),
  ];
}

@RegisterWeapon("verdict")
class Verdict extends WeaponBase {
  // ATK% + 2-stack Seal after Crystallize/Lunar-Crystallize
  readonly buffs = [
    new StatBuff(wbs(this, ["crystallize"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      {
        key: "dmg%",
        value: 2 * r(this.refinement, [0.18, 0.225, 0.27, 0.315, 0.36]),
      },
    ]),
  ];
}

@RegisterWeapon("wolfs_gravestone")
class WolfsGravestone extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
    new StatBuff(wbs(this, ["low-hp-enemy"]), { receiver: "team" }, [
      { key: "atk%", value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]) },
    ]),
  ];
}

@RegisterWeapon("redhorn_stonethresher")
class RedhornStonethresher extends WeaponBase {
  // DEF% + DEF × scale → additive base DMG for NA/CA
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "def%",
        value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      },
    ]),
    new ScalingMultiBuff(
      wbs(this),
      { receiver: "self" },
      [],
      "def",
      ["baseDmg", "baseDmg"],
      r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8])
    ),
  ];
}

@RegisterWeapon("song_of_broken_pines")
class SongOfBrokenPines extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
    new StatBuff(
      wbs(this, ["on-hit"], "millennial-movement-atk"),
      { receiver: "team" },
      [{ key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
    ),
  ];
}

@RegisterWeapon("the_unforged")
class TheUnforged extends WeaponBase {
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

@RegisterWeapon("skyward_pride")
class SkywardPride extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "dmg%", value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) },
    ]),
  ];
}

@RegisterWeapon("beacon_of_the_reed_sea")
class BeaconOfTheReedSea extends WeaponBase {
  // Both ATK buffs active + no shield → HP% active
  readonly buffs = [
    new StatBuff(wbs(this, ["E", "take-dmg"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 2 * r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
      },
      { key: "hp%", value: r(this.refinement, [0.32, 0.4, 0.48, 0.56, 0.64]) },
    ]),
  ];
}
