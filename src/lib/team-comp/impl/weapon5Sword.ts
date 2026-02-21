import { ScalingBuff, ScalingMultiBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase } from "../damageModels";
import { ELEMENT_DMG_KEYS, allElementalDmg, r, wbs } from "../helpers";

// ══════════════════════════
// 5★ Swords
// ══════════════════════════

@RegisterWeapon("athame_artis")
class AthameArtis extends WeaponBase {
  // Burst CD + Blade of the Daylight Hours: self ATK% + team ATK%
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "cd", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) }]
    ),
    new StatBuff(wbs(this, ["Q"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
    new StatBuff(wbs(this, ["Q"]), { receiver: "onField" }, [
      { key: "atk%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
  ];
}

@RegisterWeapon("key_of_khajnisut")
class KeyOfKhajNisut extends WeaponBase {
  // HP% + 3-stack EM from HP + team EM buff at 3 stacks
  readonly buffs = [
    new ScalingBuff(
      wbs(this, ["E"]),
      { receiver: "self" },
      [{ key: "hp%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }],
      "hp",
      "em",
      3 * r(this.refinement, [0.0012, 0.0015, 0.0018, 0.0021, 0.0024])
    ),
    new ScalingBuff(
      wbs(this, ["E"]),
      { receiver: "team" },
      [],
      "hp",
      "em",
      r(this.refinement, [0.002, 0.0025, 0.003, 0.0035, 0.004])
    ),
  ];
}

@RegisterWeapon("primordial_jade_cutter")
class PrimordialJadeCutter extends WeaponBase {
  readonly buffs = [
    new ScalingBuff(
      wbs(this),
      { receiver: "self" },
      [{ key: "hp%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }],
      "hp",
      "atk",
      r(this.refinement, [0.012, 0.015, 0.018, 0.021, 0.024])
    ),
  ];
}

@RegisterWeapon("peak_patrol_song")
class PeakPatrolSong extends WeaponBase {
  // DEF% (2-stack) + team elemental DMG% from DEF scaling
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "def%",
        value: 2 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
    ]),
    new ScalingMultiBuff(
      wbs(this, ["on-hit"]),
      { receiver: "team" },
      [],
      "def",
      [...ELEMENT_DMG_KEYS],
      r(this.refinement, [0.00008, 0.0001, 0.00012, 0.00014, 0.00016]),
      r(this.refinement, [0.25, 0.325, 0.4, 0.475, 0.55])
    ),
  ];
}

@RegisterWeapon("mistsplitter_reforged")
class MistsplitterReforged extends WeaponBase {
  // Base elemental DMG + 3-stack emblem (best case: NA elemental + burst + energy<100%)
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self" },
      allElementalDmg(
        r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]) +
          r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56])
      )
    ),
  ];
}

@RegisterWeapon("light_of_foliar_incision")
class LightOfFoliarIncision extends WeaponBase {
  // CR + EM → additive base DMG for Normal Attack and Elemental Skill
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "cr", value: r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]) },
    ]),
    new ScalingBuff(
      wbs(this, ["on-hit"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [],
      "em",
      "baseDmg",
      r(this.refinement, [1.2, 1.5, 1.8, 2.1, 2.4])
    ),
    new ScalingBuff(
      wbs(this, ["on-hit"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      r(this.refinement, [1.2, 1.5, 1.8, 2.1, 2.4])
    ),
  ];
}

@RegisterWeapon("haran_geppaku_futsu")
class HaranGeppakuFutsu extends WeaponBase {
  // 2-stack Wavespike assumed
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      ...allElementalDmg(r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24])),
      {
        key: "dmg%",
        value: 2 * r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
      },
    ]),
  ];
}

@RegisterWeapon("absolution")
class Absolution extends WeaponBase {
  // 3-stack Bond of Life assumed
  readonly buffs = [
    new StatBuff(wbs(this, ["bond-of-life"]), { receiver: "self" }, [
      { key: "cd", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      {
        key: "dmg%",
        value: 3 * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
      },
    ]),
  ];
}

@RegisterWeapon("splendor_of_tranquil_waters")
class SplendorOfTranquilWaters extends WeaponBase {
  // 3-stack E DMG + 2-stack HP%
  readonly buffs = [
    new StatBuff(wbs(this, ["hp-change"]), { receiver: "self" }, [
      {
        key: "dmg%",
        value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
      {
        key: "hp%",
        value: 2 * r(this.refinement, [0.14, 0.175, 0.21, 0.245, 0.28]),
      },
    ]),
  ];
}

@RegisterWeapon("uraku_misugiri")
class UrakuMisugiri extends WeaponBase {
  // Geo DMG triggered → effects doubled
  readonly buffs = [
    new StatBuff(wbs(this, ["geo-ally"]), { receiver: "self" }, [
      { key: "def%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      {
        key: "dmg%",
        value: 2 * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
      },
      {
        key: "dmg%",
        value: 2 * r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
      },
    ]),
  ];
}

@RegisterWeapon("summit_shaper")
class SummitShaper extends WeaponBase {
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

@RegisterWeapon("aquila_favonia")
class AquilaFavonia extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
  ];
}

@RegisterWeapon("skyward_blade")
class SkywardBlade extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "cr", value: r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]) },
    ]),
  ];
}

@RegisterWeapon("freedomsworn")
class FreedomSworn extends WeaponBase {
  // Self DMG% + team buff on 2-sigil proc
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "dmg%",
        value: r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
      },
    ]),
    new StatBuff(
      wbs(this, ["elemental-reaction"], "millennial-movement-atk"),
      { receiver: "team" },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
        { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      ]
    ),
  ];
}

@RegisterWeapon("lightbearing_moonshard")
class LightbearingMoonshard extends WeaponBase {
  get buffs() {
    const buffs: import("../damageBuffs").StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "def%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      ]),
    ];
    if (this.teamMeta.hasReaction("crystallize", this.charId)) {
      buffs.push(
        new StatBuff(
          wbs(this, ["E", "crystallize"]),
          {
            receiver: "self",
            filter: { reactions: ["crystallize", "lunarCrystallize"] },
          },
          [
            {
              key: "reactionDmg%",
              value: r(this.refinement, [0.64, 0.8, 0.96, 1.12, 1.28]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("azurelight")
class Azurelight extends WeaponBase {
  // ATK% after E + elemental DMG at 0 energy (best case)
  readonly buffs = [
    new StatBuff(wbs(this, ["E", "no-energy"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
      },
      ...allElementalDmg(r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32])),
    ]),
  ];
}
