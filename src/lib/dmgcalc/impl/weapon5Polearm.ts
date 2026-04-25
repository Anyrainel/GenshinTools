import { WeaponBase } from "../core/implModel";
import { RegisterWeapon, resolveOption } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { OptionDef } from "../types";
import { ALL_ELEMENTAL_FILTER, r, wbs } from "./helpers";

const crimsonMoonsSemblanceOption = {
  label: { zh: "生命之契状态", en: "Bond of Life State" },
  choices: [
    {
      value: "above30",
      label: { zh: "生命之契≥30%生命值", en: "BoL ≥ 30% Max HP" },
    },
    {
      value: "below30",
      label: { zh: "生命之契<30%生命值", en: "BoL < 30% Max HP" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("crimson_moons_semblance", crimsonMoonsSemblanceOption)
class CrimsonMoonsSemblance extends WeaponBase {
  private readonly o = resolveOption(crimsonMoonsSemblanceOption, this.option);

  // Tier 1: BoL present (12-28% DMG). Tier 2: BoL ≥ 30% Max HP (extra 24-56% DMG).
  // Default assumes BoL ≥ 30% (typical with Arlecchino or similar BoL sources).
  get buffs() {
    const value =
      r(this.refinement, [0.12, 0.16, 0.2, 0.24, 0.28]) +
      (this.o === "above30"
        ? r(this.refinement, [0.24, 0.32, 0.4, 0.48, 0.56])
        : 0);
    return [
      new StatBuff(wbs(this, ["bond-of-life"]), { receiver: "self" }, [
        { key: "dmg%", value },
      ]),
    ];
  }
}

@RegisterWeapon("lumidouce_elegy")
class LumidouceElegy extends WeaponBase {
  // ATK% always active; 2-stack DMG% requires Burning interaction
  get buffs() {
    const buffs: StatBuff[] = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.15, 0.19, 0.23, 0.27, 0.31]),
        },
      ]),
    ];
    if (this.teamMeta.hasReaction("burning", this.charId)) {
      buffs.push(
        new StatBuff(wbs(this, ["burning"]), { receiver: "self" }, [
          {
            key: "dmg%",
            value: 2 * r(this.refinement, [0.18, 0.23, 0.28, 0.33, 0.38]),
          },
        ])
      );
    }
    return buffs;
  }
}

@RegisterWeapon("bloodsoaked_ruins")
class BloodsoakedRuins extends WeaponBase {
  get buffs() {
    const buffs: StatBuff[] = [];
    if (this.teamMeta.hasReaction("lunarCharged", this.charId)) {
      buffs.push(
        new StatBuff(
          wbs(this, ["Q", "electroCharged"]),
          {
            receiver: "self",
            filter: { reactions: ["lunarCharged"] },
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
    const buffs: StatBuff[] = [
      new StatBuff(wbs(this, ["E", "Q"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
        },
      ]),
    ];
    if (this.teamMeta.isShielder[this.charId]) {
      buffs.push(
        new StatBuff(
          wbs(this, ["E", "Q", "shield"], "fractured-halo-lunar-charged-dmg"),
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
    const buffs: StatBuff[] = [
      // Base ATK% — always active on self
      new StatBuff(wbs(this), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]),
      // Extra ATK% — only while wielder is off-field
      new StatBuff(wbs(this, ["off-field"]), { receiver: "selfOffField" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]),
    ];
    if (this.teamMeta.hasHealer()) {
      buffs.push(
        new StatBuff(
          wbs(this, ["heal"], "symphonist-sweet-echoes"),
          { receiver: "team" },
          [
            {
              key: "atk%",
              value: r(this.refinement, [0.32, 0.4, 0.48, 0.56, 0.64]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

const homaOption = {
  label: { zh: "生命值状态", en: "HP State" },
  choices: [
    { value: "below50", label: { zh: "生命值≤50%", en: "HP ≤ 50%" } },
    { value: "above50", label: { zh: "生命值>50%", en: "HP > 50%" } },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("staff_of_homa", homaOption)
class StaffOfHoma extends WeaponBase {
  private readonly o = resolveOption(homaOption, this.option);

  readonly buffs = [
    new ScalingBuff(
      wbs(this, ["self-low-hp"]),
      { receiver: "self" },
      [{ key: "hp%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }],
      "hp",
      "atk",
      r(this.refinement, [0.008, 0.01, 0.012, 0.014, 0.016]) +
        (this.o === "below50"
          ? r(this.refinement, [0.01, 0.012, 0.014, 0.016, 0.018])
          : 0)
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
    new ScalingBuff(
      wbs(this),
      { receiver: "self" },
      [],
      "er",
      "atk%",
      r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      r(this.refinement, [0.8, 0.9, 1.0, 1.1, 1.2]),
      1.0
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
    new StatBuff(wbs(this, ["E"]), { receiver: "self" }, [
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
      { key: "atkSpd%", value: 0.12 },
    ]),
  ];
}

@RegisterWeapon("disaster_and_remorse")
class DisasterAndRemorse extends WeaponBase {
  // After E, wielder gains Unforgivable (NA/CA DMG+) and Irreparable (E/Q DMG+).
  // Hexerei: Secret Rite (≥2 Hexerei) multiplies both bonuses by 1.75.
  get buffs() {
    const hexMult = this.teamMeta.countByFaction("Hexerei") >= 2 ? 1.75 : 1;
    const dmgPct = r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]) * hexMult;
    return [
      // Unforgivable: NA + CA DMG
      new StatBuff(
        wbs(this, ["E"]),
        { receiver: "self", filter: { abilities: ["normal", "charge"] } },
        [{ key: "dmg%", value: dmgPct }]
      ),
      // Irreparable: E + Q DMG
      new StatBuff(
        wbs(this, ["E"]),
        { receiver: "self", filter: { abilities: ["skill", "burst"] } },
        [{ key: "dmg%", value: dmgPct }]
      ),
    ];
  }
}
