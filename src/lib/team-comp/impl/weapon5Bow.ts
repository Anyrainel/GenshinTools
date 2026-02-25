import { ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase } from "../damageModels";
import { allElementalDmg, r, wbs } from "../helpers";

// ══════════════════════════
// 5★ Bows
// ══════════════════════════

@RegisterWeapon("silvershower_heartstrings")
class SilvershowerHeartstrings extends WeaponBase {
  // 3-stack Remedy: HP% + Burst CRIT Rate
  readonly buffs = [
    new StatBuff(wbs(this, ["bond-of-life"]), { receiver: "self" }, [
      { key: "hp%", value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]) },
    ]),
    new StatBuff(
      wbs(this, ["bond-of-life"]),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "cr", value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]) }]
    ),
  ];
}

@RegisterWeapon("the_first_great_magic")
class TheFirstGreatMagic extends WeaponBase {
  // CA DMG% + Gimmick stacks (ATK%) from same-element teammates (including self)
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    let sameCount = 0;
    for (const [id, el] of Object.entries(this.teamMeta.elements)) {
      if (id === this.charId) continue;
      if (el === wielderElement) sameCount++;
    }
    // 1 base (self) + same-element teammates, max 3 Gimmick stacks
    const stacks = Math.min(1 + sameCount, 3);
    return [
      new StatBuff(
        wbs(this),
        { receiver: "self", filter: { abilities: ["charge"] } },
        [
          {
            key: "dmg%",
            value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
          },
        ]
      ),
      new StatBuff(wbs(this), { receiver: "self" }, [
        {
          key: "atk%",
          value: stacks * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("the_daybreak_chronicles")
class TheDaybreakChronicles extends WeaponBase {
  // Stirring Dawn Breeze: max cap NA/E/Q DMG bonus (reachable out-of-combat or via stacking)
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal", "skill", "burst"] } },
      [{ key: "dmg%", value: r(this.refinement, [0.6, 0.75, 0.9, 1.05, 1.2]) }]
    ),
  ];
}

@RegisterWeapon("astral_vultures_crimson_plumage")
class AstralVulturesCrimsonPlumage extends WeaponBase {
  // ATK% after swirl + Charged/Burst DMG from different-element teammates
  get buffs() {
    const wielderElement = this.teamMeta.elements[this.charId];
    let diffCount = 0;
    for (const [id, el] of Object.entries(this.teamMeta.elements)) {
      if (id === this.charId) continue;
      if (el !== wielderElement) diffCount++;
    }
    const buffs: StatBuff[] = [
      new StatBuff(wbs(this, ["swirl"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
        },
      ]),
    ];
    if (diffCount >= 2) {
      buffs.push(
        new StatBuff(
          wbs(this),
          { receiver: "self", filter: { abilities: ["charge"] } },
          [
            {
              key: "dmg%",
              value: r(this.refinement, [0.48, 0.6, 0.72, 0.84, 0.96]),
            },
          ]
        )
      );
      buffs.push(
        new StatBuff(
          wbs(this),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [
            {
              key: "dmg%",
              value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
            },
          ]
        )
      );
    } else if (diffCount >= 1) {
      buffs.push(
        new StatBuff(
          wbs(this),
          { receiver: "self", filter: { abilities: ["charge"] } },
          [
            {
              key: "dmg%",
              value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
            },
          ]
        )
      );
      buffs.push(
        new StatBuff(
          wbs(this),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [
            {
              key: "dmg%",
              value: r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("aqua_simulacra")
class AquaSimulacra extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "hp%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
      { key: "dmg%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
  ];
}

@RegisterWeapon("thundering_pulse")
class ThunderingPulse extends WeaponBase {
  // 3-stack emblem (best case)
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("polar_star")
class PolarStar extends WeaponBase {
  // 4-stack Ashen Nightstar: Skill+Burst DMG% + ATK%
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.48, 0.6, 0.72, 0.84, 0.96]) },
    ]),
  ];
}

@RegisterWeapon("hunters_path")
class HuntersPath extends WeaponBase {
  // Elemental DMG% + EM → additive base DMG for Charged Attack
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self" },
      allElementalDmg(r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]))
    ),
    new ScalingBuff(
      wbs(this, ["charge"]),
      { receiver: "self", filter: { abilities: ["charge"] } },
      [],
      "em",
      "baseDmg",
      r(this.refinement, [1.6, 2.0, 2.4, 2.8, 3.2])
    ),
  ];
}

@RegisterWeapon("amos_bow")
class AmosBow extends WeaponBase {
  // Base + 5-stack arrow travel
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [
        {
          key: "dmg%",
          value:
            r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]) +
            5 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("elegy_for_the_end")
class ElegyForTheEnd extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "em", value: r(this.refinement, [60, 75, 90, 105, 120]) },
    ]),
    new StatBuff(
      wbs(this, ["E", "Q"], "millennial-movement-atk"),
      { receiver: "team" },
      [
        { key: "em", value: r(this.refinement, [100, 125, 150, 175, 200]) },
        { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      ]
    ),
  ];
}

@RegisterWeapon("skyward_harp")
class SkywardHarp extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "cd", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
    ]),
  ];
}
