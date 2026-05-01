import { WeaponBase } from "../core/implModel";
import { RegisterWeapon } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import { ALL_ELEMENTAL_FILTER, r, wbs } from "./helpers";

@RegisterWeapon("nocturnes_curtain_call")
class NocturnesCurtainCall extends WeaponBase {
  get buffs() {
    const buffs: StatBuff[] = [
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
      // Bountiful Sea's Sacred Wine: HP% (general) + reaction CRIT DMG (lunar only)
      buffs.push(
        new StatBuff(wbs(this, ["lunar-reaction"]), { receiver: "self" }, [
          {
            key: "hp%",
            value: r(this.refinement, [0.14, 0.16, 0.18, 0.2, 0.22]),
          },
        ])
      );
      buffs.push(
        new StatBuff(
          wbs(this, ["lunar-reaction"]),
          {
            receiver: "self",
            filter: {
              reactions: ["lunarCharged", "lunarBloom", "lunarCrystallize"],
            },
          },
          [
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
    const buffs: StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "cr", value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) },
        { key: "em", value: r(this.refinement, [80, 100, 120, 140, 160]) },
      ]),
    ];

    if (this.teamMeta.hasReaction("lunarBloom", this.charId)) {
      // Both effects active: 50% increase to EM and CD; CD is general (not reaction-scoped)
      buffs.push(
        new StatBuff(wbs(this, ["lunarBloom"]), { receiver: "self" }, [
          {
            key: "em",
            value: 0.5 * r(this.refinement, [80, 100, 120, 140, 160]),
          },
          {
            key: "cd",
            value: 1.5 * r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
          },
        ])
      );
    }
    return buffs;
  }
}

@RegisterWeapon("nightweavers_looking_glass")
class NightweaversLookingGlass extends WeaponBase {
  // Prayer of Far North (E) EM + New Moon Verse (lunarBloom) EM + combined team buff
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    const isHydroDendro =
      wielderElement === "Hydro" || wielderElement === "Dendro";
    const emVal = r(this.refinement, [60, 75, 90, 105, 120]);
    if (!isHydroDendro) return [];
    const canLunarBloom = this.teamMeta.hasReaction("lunarBloom", this.charId);
    const buffs: StatBuff[] = [
      // Prayer of the Far North: EM after E hit (requires Hydro/Dendro E)
      new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
        { key: "em", value: emVal },
      ]),
    ];
    if (canLunarBloom) {
      // New Moon Verse: EM after lunarBloom
      buffs.push(
        new StatBuff(wbs(this, ["lunarBloom"]), { receiver: "self" }, [
          { key: "em", value: emVal },
        ])
      );
      // Both effects active: team reaction DMG buffs
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
  // HP% (always active) + 4-stack Scorching Summer NA DMG (after E)
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
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
    return [
      new ScalingBuff(
        wbs(this, ["Q", "shield"]),
        { receiver: "self", filter: { elements: [wielderElement] } },
        [],
        "hp",
        "dmg%",
        r(this.refinement, [0.003, 0.005, 0.007, 0.009, 0.011]) / 1000,
        r(this.refinement, [0.12, 0.2, 0.28, 0.36, 0.44])
      ),
    ];
  }
}

@RegisterWeapon("starcallers_watch")
class StarcallersWatch extends WeaponBase {
  get buffs() {
    const buffs: StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "em", value: r(this.refinement, [100, 125, 150, 175, 200]) },
      ]),
    ];
    if (this.teamMeta.isShielder[this.charId]) {
      buffs.push(
        new StatBuff(
          wbs(this, ["shield"], "starcallers-watch"),
          { receiver: "teamOnField" },
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
  // NA ATK SPD (always) + NA DMG at cap (peak damage model)
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "atkSpd%",
        value: r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
      },
    ]),
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.48, 0.6, 0.72, 0.84, 0.96]),
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
    new StatBuff(
      wbs(this, ["E"]),
      { receiver: "self", filter: ALL_ELEMENTAL_FILTER },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("a_thousand_floating_dreams")
class AThousandFloatingDreams extends WeaponBase {
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    let sameCount = 0;
    let diffCount = 0;
    for (const [id, el] of Object.entries(this.teamMeta.elements)) {
      if (id === this.charId || !el) continue;
      if (el === wielderElement) sameCount++;
      else diffCount++;
    }
    // Each effect can have up to 3 stacks
    sameCount = Math.min(sameCount, 3);
    diffCount = Math.min(diffCount, 3);

    const buffs: StatBuff[] = [];
    if (diffCount > 0 && wielderElement) {
      buffs.push(
        new StatBuff(
          wbs(this),
          { receiver: "self", filter: { elements: [wielderElement] } },
          [
            {
              key: "dmg%",
              value:
                diffCount * r(this.refinement, [0.1, 0.14, 0.18, 0.22, 0.26]),
            },
          ]
        )
      );
    }
    if (sameCount > 0) {
      buffs.push(
        new StatBuff(wbs(this), { receiver: "self" }, [
          {
            key: "em",
            value: sameCount * r(this.refinement, [32, 40, 48, 56, 64]),
          },
        ])
      );
    }
    buffs.push(
      new StatBuff(wbs(this), { receiver: "other" }, [
        { key: "em", value: r(this.refinement, [40, 42, 44, 46, 48]) },
      ])
    );
    return buffs;
  }
}

@RegisterWeapon("lost_prayer_to_the_sacred_winds")
class LostPrayerToTheSacredWinds extends WeaponBase {
  // 4-stack elemental DMG
  readonly buffs = [
    new StatBuff(
      wbs(this, ["on-field"]),
      { receiver: "selfOnField", filter: ALL_ELEMENTAL_FILTER },
      [
        {
          key: "dmg%",
          value: 4 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("skyward_atlas")
class SkywardAtlas extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: ALL_ELEMENTAL_FILTER },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
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
  // HP% (always active) + 3-stack CA DMG (hp-change trigger)
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
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
  // ATK% (always active) + 3-stack NA/CA DMG + ATK SPD at 3 stacks
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
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
    new StatBuff(wbs(this, ["hp-change"]), { receiver: "self" }, [
      {
        key: "atkSpd%",
        value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
    ]),
  ];
}

@RegisterWeapon("angelos_heptades")
class AngelosHeptades extends WeaponBase {
  // Base ATK% (always).
  // After creating a shield, "Pathfinder's Light" (20s): per 1000 ATK → active party
  // member DMG +X%, capped. The wielder is off-field-eligible (shielder role).
  // Hexerei: Secret Rite — off-field Hexerei teammates also gain 50% of the DMG increase.
  get buffs() {
    const atkPct = r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]);
    const scale = r(this.refinement, [0.1, 0.13, 0.16, 0.19, 0.22]) / 1000;
    const cap = r(this.refinement, [0.26, 0.34, 0.42, 0.5, 0.58]);
    const buffs: StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "atk%", value: atkPct },
      ]),
      // Pathfinder's Light: on-field teammate (including wielder) DMG, scaling with
      // wielder's ATK. Wielder provides the ATK so the buff is based on self stats.
      new ScalingBuff(
        wbs(this, ["shield"], "seven-edicts-pathfinders-light"),
        { receiver: "teamOnField" },
        [],
        "atk",
        "dmg%",
        scale,
        cap
      ),
    ];
    // Hexerei: Secret Rite — off-field Hexerei party members (including the
    // wielder themselves if Hexerei) gain half of the DMG buff.
    if (this.teamMeta.countByFaction("Hexerei") >= 2) {
      buffs.push(
        new ScalingBuff(
          wbs(this, ["shield"], "seven-edicts-pathfinders-light-hexerei"),
          { receiver: "teamOffField", factions: ["Hexerei"] },
          [],
          "atk",
          "dmg%",
          scale * 0.5,
          cap * 0.5
        )
      );
    }
    return buffs;
  }
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
