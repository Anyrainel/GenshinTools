import { ScalingBuff, StatBuff } from "../damageBuffs";
import { RegisterWeapon, WeaponBase, resolveOption } from "../damageModels";
import type { OptionDef } from "../damageModels";
import { allElementalDmg, r, wbs } from "../helpers";
import type { StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Claymores
// ═══════════════════════════════════════════════════════════════

@RegisterWeapon("master_key")
class MasterKey extends WeaponBase {
  // Same as Snare Hook
  get buffs() {
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

@RegisterWeapon("flameforged_insight")
class FlameforgedInsight extends WeaponBase {
  get buffs() {
    const canTrigger =
      this.teamMeta.hasReaction("electroCharged", this.charId) ||
      this.teamMeta.hasReaction("bloom", this.charId) ||
      this.teamMeta.hasReaction("crystallize", this.charId);

    if (!canTrigger) return [];
    return [
      new StatBuff(wbs(this, ["elemental-reaction"]), { receiver: "self" }, [
        { key: "em", value: r(this.refinement, [60, 75, 90, 105, 120]) },
      ]),
    ];
  }
}

@RegisterWeapon("fruitful_hook")
class FruitfulHook extends WeaponBase {
  // Plunge CR + post-plunge DMG bonus
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["plunge"] } },
      [{ key: "cr", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) }]
    ),
    new StatBuff(
      wbs(this, ["plunge"]),
      {
        receiver: "self",
        filter: { abilities: ["normal", "charge", "plunge"] },
      },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("earth_shaker")
class EarthShaker extends WeaponBase {
  // Pyro-related reaction required from any party member
  get buffs() {
    const canTrigger =
      this.teamMeta.hasReaction("vaporize") ||
      this.teamMeta.hasReaction("melt") ||
      this.teamMeta.hasReaction("overloaded") ||
      this.teamMeta.hasReaction("burning") ||
      this.teamMeta.hasReaction("burgeon") ||
      (Object.values(this.teamMeta.elements).includes("Anemo") &&
        Object.values(this.teamMeta.elements).includes("Pyro"));

    if (!canTrigger) return [];
    return [
      new StatBuff(
        wbs(this, ["pyro-reaction"]),
        { receiver: "self", filter: { abilities: ["skill"] } },
        [
          {
            key: "dmg%",
            value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("ultimate_overlords_mega_magic_sword")
class UltimateOverlordsMegaMagicSword extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("portable_power_saw")
class PortablePowerSaw extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasHealer()) return [];
    return [
      new StatBuff(wbs(this, ["healed"]), { receiver: "self" }, [
        {
          key: "em",
          value: 3 * r(this.refinement, [40, 50, 60, 70, 80]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("talking_stick")
class TalkingStick extends WeaponBase {
  // ATK% from Pyro + elemental DMG from other elements
  readonly buffs = [
    new StatBuff(wbs(this, ["pyro-affected"]), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
    new StatBuff(
      wbs(this, ["other-element"]),
      { receiver: "self" },
      allElementalDmg(r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]))
    ),
  ];
}

@RegisterWeapon("tidal_shadow")
class TidalShadow extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasHealer()) return [];
    return [
      new StatBuff(wbs(this, ["healed"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("mailed_flower")
class MailedFlower extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["E", "elemental-reaction"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
      { key: "em", value: r(this.refinement, [48, 60, 72, 84, 96]) },
    ]),
  ];
}

@RegisterWeapon("makhaira_aquamarine")
class MakhairaAquamarine extends WeaponBase {
  // Same as Wandering Evenstar
  readonly buffs = [
    new ScalingBuff(
      wbs(this),
      { receiver: "self" },
      [],
      "em",
      "atk",
      r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48])
    ),
    // Game text: "多件同名武器产生的此效果可以叠加" — stacks from multiple copies, no noStackId
    new ScalingBuff(
      wbs(this),
      { receiver: "otherOnField" },
      [],
      "em",
      "atk",
      0.3 * r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48])
    ),
  ];
}

@RegisterWeapon("forest_regalia")
class ForestRegalia extends WeaponBase {
  // Dendro reaction → pick up leaf → EM for 12s
  get buffs() {
    if (!Object.values(this.teamMeta.elements).includes("Dendro")) return [];
    return [
      new StatBuff(
        wbs(this, ["dendro-reaction"], "leaf-of-consciousness-em"),
        { receiver: "self" },
        [{ key: "em", value: r(this.refinement, [60, 75, 90, 105, 120]) }]
      ),
    ];
  }
}

@RegisterWeapon("blackcliff_slasher")
class BlackcliffSlasher extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-kill"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 3 * r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("snowtombed_starsilver")
class SnowTombedStarsilver extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("rainslasher")
class Rainslasher extends WeaponBase {
  // Enemy affected by Hydro or Electro
  get buffs() {
    const els = Object.values(this.teamMeta.elements);
    if (!els.includes("Hydro") && !els.includes("Electro")) return [];
    return [
      new StatBuff(wbs(this, ["hydro-electro-enemy"]), { receiver: "self" }, [
        {
          key: "dmg%",
          value: r(this.refinement, [0.2, 0.24, 0.28, 0.32, 0.36]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("the_bell")
class TheBell extends WeaponBase {
  get buffs() {
    if (!this.teamMeta.hasShielder()) return [];
    return [
      new StatBuff(wbs(this, ["shield"]), { receiver: "self" }, [
        {
          key: "dmg%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("prototype_archaic")
class PrototypeArchaic extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("favonius_greatsword")
class FavoniusGreatsword extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("luxurious_sealord")
class LuxuriousSealord extends WeaponBase {
  readonly buffs = [
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
  ];
}

@RegisterWeapon("serpent_spine")
class SerpentSpine extends WeaponBase {
  // 5-stack on-field DMG bonus
  readonly buffs = [
    new StatBuff(wbs(this, ["on-field"]), { receiver: "selfOnField" }, [
      {
        key: "dmg%",
        value: 5 * r(this.refinement, [0.06, 0.07, 0.08, 0.09, 0.1]),
      },
    ]),
  ];
}

@RegisterWeapon("sacrificial_greatsword")
class SacrificialGreatsword extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("whiteblind")
class Whiteblind extends WeaponBase {
  // 4-stack ATK% + DEF%
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 4 * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
      },
      {
        key: "def%",
        value: 4 * r(this.refinement, [0.06, 0.075, 0.09, 0.105, 0.12]),
      },
    ]),
  ];
}

@RegisterWeapon("katsuragikiri_nagamasa")
class KatsuragikiriNagamasa extends WeaponBase {
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

@RegisterWeapon("akuoumaru")
class Akuoumaru extends WeaponBase {
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

@RegisterWeapon("royal_greatsword")
class RoyalGreatsword extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "cr",
        value: 3 * r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]),
      },
    ]),
  ];
}

@RegisterWeapon("lithic_blade")
class LithicBlade extends WeaponBase {
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
