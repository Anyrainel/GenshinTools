import { elements } from "@/data/types";
import { ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase } from "../damageModels";
import { allElementalDmg, r, wbs } from "../helpers";

// ══════════════════════════
// 5★ Swords
// ══════════════════════════

@RegisterWeapon("athame_artis")
class AthameArtis extends WeaponBase {
  // Burst CD + Blade of the Daylight Hours: self ATK% + team ATK%
  // Hexerei: Secret Rite (Columbina) increases Blade of the Daylight Hours by 75%
  get buffs() {
    const hexMult = this.teamMeta.characters.includes("columbina") ? 1.75 : 1;
    return [
      new StatBuff(
        wbs(this),
        { receiver: "self", filter: { abilities: ["burst"] } },
        [
          {
            key: "cd",
            value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
          },
        ]
      ),
      new StatBuff(wbs(this, ["Q"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: hexMult * r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
        },
      ]),
      new StatBuff(
        wbs(this, ["Q"], "athame_artis-onfield-atk"),
        { receiver: "otherOnField" },
        [
          {
            key: "atk%",
            value: hexMult * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
          },
        ]
      ),
    ];
  }
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
      wbs(this, ["E"], "key_of_khajnisut-team-em"),
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
  // 2-stack: self DEF% + self all-elemental DMG; on 2nd stack: team all-elemental DMG from DEF scaling
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "def%",
        value: 2 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
      // 2-stack self all-elemental DMG: 2 x 10%/12.5%/15%/17.5%/20%
      ...allElementalDmg(
        2 * r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2])
      ),
    ]),
    // Team all-elemental DMG from DEF; cap: 25.6%/32%/38.4%/44.8%/51.2%
    // noStackId required for team receiver on a weapon buff (U2)
    new ScalingBuff(
      wbs(this, ["on-hit"], "peak_patrol_song-team-elemental-dmg"),
      { receiver: "team", filter: { elements } },
      [],
      "def",
      "dmg%",
      r(this.refinement, [0.00008, 0.0001, 0.00012, 0.00014, 0.00016]),
      r(this.refinement, [0.256, 0.32, 0.384, 0.448, 0.512])
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
  // All-elemental DMG + 2-stack Wavespike Normal Attack DMG% (filter: normal)
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      ...allElementalDmg(r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24])),
    ]),
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: 2 * r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
        },
      ]
    ),
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
  // 3-stack Elemental Skill DMG% + 2-stack HP%
  readonly buffs = [
    new StatBuff(wbs(this, ["hp-change"]), { receiver: "self" }, [
      {
        key: "hp%",
        value: 2 * r(this.refinement, [0.14, 0.175, 0.21, 0.245, 0.28]),
      },
    ]),
    new StatBuff(
      wbs(this, ["hp-change"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("uraku_misugiri")
class UrakuMisugiri extends WeaponBase {
  // NA/Skill DMG% base, doubled after nearby active character deals Geo DMG
  get buffs() {
    const hasGeo = Object.values(this.teamMeta.elements).includes("Geo");
    const mult = hasGeo ? 2 : 1;
    return [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "def%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      ]),
      new StatBuff(
        wbs(this, hasGeo ? ["geo-ally"] : []),
        { receiver: "self", filter: { abilities: ["normal"] } },
        [
          {
            key: "dmg%",
            value: mult * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
          },
        ]
      ),
      new StatBuff(
        wbs(this, hasGeo ? ["geo-ally"] : []),
        { receiver: "self", filter: { abilities: ["skill"] } },
        [
          {
            key: "dmg%",
            value: mult * r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("summit_shaper")
class SummitShaper extends WeaponBase {
  get buffs() {
    const shielded = this.teamMeta.hasShielder();
    const mult = shielded ? 2 : 1;
    return [
      new StatBuff(
        wbs(this, shielded ? ["on-hit", "shield"] : ["on-hit"]),
        { receiver: "self" },
        [
          {
            key: "atk%",
            value:
              5 * mult * r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]),
          },
        ]
      ),
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
    new StatBuff(wbs(this, ["Q"]), { receiver: "self" }, [
      { key: "atkSpd%", value: 0.1 },
    ]),
    // Skypiercing Might: NA/CA deal additional DMG equal to 20~40% ATK
    new ScalingBuff(
      wbs(this, ["Q"]),
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [],
      "atk",
      "baseDmg",
      r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4])
    ),
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
      { receiver: "team", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["elemental-reaction"], "millennial-movement-atk"),
      { receiver: "team", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["elemental-reaction"], "millennial-movement-atk"),
      { receiver: "team", filter: { abilities: ["plunge"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["elemental-reaction"], "millennial-movement-atk"),
      { receiver: "team" },
      [{ key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
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
    if (this.teamMeta.hasReaction("lunarCrystallize", this.charId)) {
      buffs.push(
        new StatBuff(
          wbs(this, ["E", "lunarCrystallize"]),
          {
            receiver: "self",
            // Game text: "月结晶反应伤害" = Lunar-Crystallize only (not plain Crystallize)
            filter: { reactions: ["lunarCrystallize"] },
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
  // Base ATK% after E; at 0 energy: additional ATK% + CD
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
      },
    ]),
    new StatBuff(wbs(this, ["E", "no-energy"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
      },
      {
        key: "cd",
        value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]),
      },
    ]),
  ];
}
