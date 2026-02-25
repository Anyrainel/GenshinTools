import { ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase } from "../damageModels";
import { allElementalDmg, r, wbs } from "../helpers";
import type { StatKey } from "../types";

// ══════════════════════════
// 5★ Catalysts
// ══════════════════════════

@RegisterWeapon("nocturnes_curtain_call")
class NocturnesCurtainCall extends WeaponBase {
  get buffs() {
    const buffs: import("../damageBuffs").StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        {
          key: "hp%",
          value: r(this.refinement, [0.1, 0.12, 0.14, 0.16, 0.18]),
        },
      ]),
    ];
    if (
      this.teamMeta.hasReaction("lunarCharged", this.charId) ||
      this.teamMeta.hasReaction("lunarBloom", this.charId) ||
      this.teamMeta.hasReaction("lunarCrystallize", this.charId)
    ) {
      buffs.push(
        new StatBuff(
          wbs(this, ["lunarCharged", "lunarBloom", "lunarCrystallize"]),
          {
            receiver: "self",
            filter: {
              reactions: ["lunarCharged", "lunarBloom", "lunarCrystallize"],
            },
          },
          [
            {
              key: "hp%",
              value: r(this.refinement, [0.14, 0.16, 0.18, 0.2, 0.22]),
            },
            {
              key: "reactionCd",
              value: r(this.refinement, [0.6, 0.8, 1.0, 1.2, 1.4]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("reliquary_of_truth")
class ReliquaryOfTruth extends WeaponBase {
  get buffs() {
    const buffs: import("../damageBuffs").StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "cr", value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) },
        { key: "em", value: r(this.refinement, [80, 100, 120, 140, 160]) },
      ]),
    ];

    if (this.teamMeta.hasReaction("lunarBloom", this.charId)) {
      buffs.push(
        new StatBuff(
          wbs(this, ["lunarBloom"]),
          { receiver: "self", filter: { reactions: ["lunarBloom"] } },
          [
            {
              key: "em",
              value: 0.5 * r(this.refinement, [80, 100, 120, 140, 160]),
            },
            {
              key: "reactionCd",
              value: 1.5 * r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("nightweavers_looking_glass")
class NightweaversLookingGlass extends WeaponBase {
  // EM after E hit + team Bloom/Lunar-Bloom buff if wielder is Hydro/Dendro
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    const isHydroDendro =
      wielderElement === "Hydro" || wielderElement === "Dendro";
    const buffs: StatBuff[] = [
      new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
        { key: "em", value: r(this.refinement, [80, 100, 120, 140, 160]) },
      ]),
    ];
    if (isHydroDendro) {
      // Bloom DMG +120%/150%/180%/210%/240%
      buffs.push(
        new StatBuff(
          wbs(this, ["E"], "nightweavers-looking-glass-bloom"),
          { receiver: "team", filter: { reactions: ["bloom"] } },
          [
            {
              key: "reactionDmg%",
              value: r(this.refinement, [1.2, 1.5, 1.8, 2.1, 2.4]),
            },
          ]
        )
      );
      // Hyperbloom + Burgeon DMG +80%/100%/120%/140%/160%
      buffs.push(
        new StatBuff(
          wbs(this, ["E"], "nightweavers-looking-glass-hyper"),
          {
            receiver: "team",
            filter: { reactions: ["hyperbloom", "burgeon"] },
          },
          [
            {
              key: "reactionDmg%",
              value: r(this.refinement, [0.8, 1.0, 1.2, 1.4, 1.6]),
            },
          ]
        )
      );
      // Lunar-Bloom DMG +40%/50%/60%/70%/80%
      buffs.push(
        new StatBuff(
          wbs(this, ["E"], "nightweavers-looking-glass-lunar"),
          { receiver: "team", filter: { reactions: ["lunarBloom"] } },
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

@RegisterWeapon("cranes_echoing_call")
class CranesEchoingCall extends WeaponBase {
  // Team plunge DMG buff
  readonly buffs = [
    new StatBuff(
      wbs(this, ["plunge"], "cranes-echoing-call"),
      { receiver: "team", filter: { abilities: ["plunge"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.28, 0.41, 0.54, 0.67, 0.8]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("surfs_up")
class SurfsUp extends WeaponBase {
  // HP% + 4-stack Scorching Summer (max NA DMG)
  readonly buffs = [
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "hp%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: 4 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("vivid_notions")
class VividNotions extends WeaponBase {
  // ATK% (always) + Dawn's First Hue plunge CD + Twinlight's Splendor plunge CD
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      },
    ]),
    new StatBuff(
      wbs(this, ["plunge"]),
      { receiver: "self", filter: { abilities: ["plunge"] } },
      [{ key: "cd", value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]) }]
    ),
    new StatBuff(
      wbs(this, ["E", "Q"]),
      { receiver: "self", filter: { abilities: ["plunge"] } },
      [{ key: "cd", value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]) }]
    ),
  ];
}

@RegisterWeapon("jadefalls_splendor")
class JadefallsSplendor extends WeaponBase {
  // Per 1000 Max HP → wielder's elemental DMG%, capped. Trigger: Q or shield.
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    if (wielderElement === undefined) return [];
    const outKey = `${wielderElement.toLowerCase()}%` as StatKey;
    return [
      new ScalingBuff(
        wbs(this, ["Q", "shield"]),
        { receiver: "self" },
        [],
        "hp",
        outKey,
        r(this.refinement, [0.003, 0.005, 0.007, 0.009, 0.011]) / 1000,
        r(this.refinement, [0.12, 0.2, 0.28, 0.36, 0.44])
      ),
    ];
  }
}

@RegisterWeapon("starcallers_watch")
class StarcallersWatch extends WeaponBase {
  get buffs() {
    const buffs: import("../damageBuffs").StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "em", value: r(this.refinement, [100, 125, 150, 175, 200]) },
      ]),
    ];
    if (this.teamMeta.hasShielder()) {
      buffs.push(
        new StatBuff(
          wbs(this, ["shield"], "starcallers-watch"),
          { receiver: "onField" },
          [
            {
              key: "dmg%",
              value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("sunny_morning_sleepin")
class SunnyMorningSleepIn extends WeaponBase {
  // 3 separate EM sources: after Swirl, after E hit, after Q hit
  readonly buffs = [
    new StatBuff(wbs(this, ["swirl"]), { receiver: "self" }, [
      { key: "em", value: r(this.refinement, [120, 150, 180, 210, 240]) },
    ]),
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      { key: "em", value: r(this.refinement, [96, 120, 144, 168, 192]) },
    ]),
    new StatBuff(wbs(this, ["Q"]), { receiver: "self" }, [
      { key: "em", value: r(this.refinement, [32, 40, 48, 56, 64]) },
    ]),
  ];
}

@RegisterWeapon("tulaytullahs_remembrance")
class TulaytullahsRemembrance extends WeaponBase {
  // NA DMG stacking (4.8%×4 + 9.6% at 6s)
  readonly buffs = [
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value:
            4 * r(this.refinement, [0.048, 0.06, 0.072, 0.084, 0.096]) +
            r(this.refinement, [0.096, 0.12, 0.144, 0.168, 0.192]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("kaguras_verity")
class KagurasVerity extends WeaponBase {
  // 3-stack E DMG + elemental bonus at 3 stacks
  readonly buffs = [
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value: 3 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
      ...allElementalDmg(r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24])),
    ]),
  ];
}

@RegisterWeapon("a_thousand_floating_dreams")
class AThousandFloatingDreams extends WeaponBase {
  // Assume 3 different-element teammates → 3× elemental DMG for self
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self" },
      allElementalDmg(3 * r(this.refinement, [0.1, 0.14, 0.18, 0.22, 0.26]))
    ),
    new StatBuff(wbs(this), { receiver: "team" }, [
      { key: "em", value: r(this.refinement, [40, 42, 44, 46, 48]) },
    ]),
  ];
}

@RegisterWeapon("lost_prayer_to_the_sacred_winds")
class LostPrayerToTheSacredWinds extends WeaponBase {
  // 4-stack elemental DMG
  readonly buffs = [
    new StatBuff(
      wbs(this, ["on-field"]),
      { receiver: "selfOnField" },
      allElementalDmg(4 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]))
    ),
  ];
}

@RegisterWeapon("skyward_atlas")
class SkywardAtlas extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self" },
      allElementalDmg(r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]))
    ),
  ];
}

@RegisterWeapon("memory_of_dust")
class MemoryOfDust extends WeaponBase {
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

@RegisterWeapon("tome_of_the_eternal_flow")
class TomeOfTheEternalFlow extends WeaponBase {
  // 3-stack CA DMG
  readonly buffs = [
    new StatBuff(wbs(this, ["hp-change"]), { receiver: "self" }, [
      { key: "hp%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
    new StatBuff(
      wbs(this, ["hp-change"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: 3 * r(this.refinement, [0.14, 0.18, 0.22, 0.26, 0.3]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("cashflow_supervision")
class CashflowSupervision extends WeaponBase {
  // 3-stack NA/CA DMG
  readonly buffs = [
    new StatBuff(wbs(this, ["hp-change"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
    new StatBuff(
      wbs(this, ["hp-change"]),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: 3 * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["hp-change"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [
        {
          key: "dmg%",
          value: 3 * r(this.refinement, [0.14, 0.175, 0.21, 0.245, 0.28]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("everlasting_moonglow")
class EverlastingMoonglow extends WeaponBase {
  // Heal% + HP × scale → additive base DMG for Normal Attack
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "heal%",
        value: r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
      },
    ]),
    new ScalingBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [],
      "hp",
      "baseDmg",
      r(this.refinement, [0.01, 0.015, 0.02, 0.025, 0.03])
    ),
  ];
}
