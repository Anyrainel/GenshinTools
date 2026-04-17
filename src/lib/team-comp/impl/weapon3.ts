import { WeaponBase } from "../calc/implModel";
import { RegisterWeapon, resolveOption } from "../calc/registry";
import { StatBuff } from "../calc/statBuff";
import type { OptionDef } from "../types";
import { r, wbs } from "./helpers";

const harbingerOption = {
  label: { zh: "生命值状态", en: "HP State" },
  choices: [
    { value: "high", label: { zh: "生命值>90%", en: "HP above 90%" } },
    { value: "low", label: { zh: "生命值≤90%", en: "HP below 90%" } },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("harbinger_of_dawn", harbingerOption)
class HarbingerOfDawn extends WeaponBase {
  private readonly o = resolveOption(harbingerOption, this.option);

  get buffs() {
    if (this.o !== "high") return [];
    return [
      new StatBuff(wbs(this, ["high-hp"]), { receiver: "self" }, [
        {
          key: "cr",
          value: r(this.refinement, [0.14, 0.175, 0.21, 0.245, 0.28]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("white_tassel")
class WhiteTassel extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("slingshot")
class Slingshot extends WeaponBase {
  readonly buffs = [
    new StatBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [
        {
          key: "dmg%",
          value: r(this.refinement, [0.36, 0.42, 0.48, 0.54, 0.6]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("thrilling_tales_of_dragon_slayers")
class ThrillingTalesOfDragonSlayers extends WeaponBase {
  // Team ATK buff on swap
  readonly buffs = [
    new StatBuff(
      wbs(this, ["swap"], "thrilling-tales"),
      { receiver: "teamOnField" },
      [
        {
          key: "atk%",
          value: r(this.refinement, [0.24, 0.3, 0.36, 0.42, 0.48]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("skyrider_sword")
class SkyriderSword extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["Q"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("cool_steel")
class CoolSteel extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["hydro-cryo-enemy"]), { receiver: "self" }, [
      {
        key: "dmg%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("magic_guide")
class MagicGuide extends WeaponBase {
  get buffs() {
    const teamEls = Object.values(this.teamMeta.elements);
    if (!teamEls.includes("Hydro") && !teamEls.includes("Electro")) return [];
    return [
      new StatBuff(wbs(this, ["hydro-electro-enemy"]), { receiver: "self" }, [
        {
          key: "dmg%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("raven_bow")
class RavenBow extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["hydro-pyro-enemy"]), { receiver: "self" }, [
      {
        key: "dmg%",
        value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
      },
    ]),
  ];
}

@RegisterWeapon("bloodtainted_greatsword")
class BloodtaintedGreatsword extends WeaponBase {
  // Enemy affected by Pyro or Electro
  get buffs() {
    const els = Object.values(this.teamMeta.elements);
    if (!els.includes("Pyro") && !els.includes("Electro")) return [];
    return [
      new StatBuff(wbs(this, ["pyro-electro-enemy"]), { receiver: "self" }, [
        {
          key: "dmg%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("dark_iron_sword")
class DarkIronSword extends WeaponBase {
  get buffs() {
    const canReact =
      this.teamMeta.hasReaction("overloaded", this.charId) ||
      this.teamMeta.hasReaction("superconduct", this.charId) ||
      this.teamMeta.hasReaction("electroCharged", this.charId) ||
      this.teamMeta.hasReaction("lunarCharged", this.charId) ||
      this.teamMeta.hasReaction("quicken", this.charId) ||
      this.teamMeta.hasReaction("aggravate", this.charId) ||
      this.teamMeta.hasReaction("hyperbloom", this.charId) ||
      (this.teamMeta.elements[this.charId] === "Anemo" &&
        Object.values(this.teamMeta.elements).includes("Electro"));

    if (!canReact) return [];
    return [
      new StatBuff(wbs(this, ["electro-reaction"]), { receiver: "self" }, [
        { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      ]),
    ];
  }
}

@RegisterWeapon("emerald_orb")
class EmeraldOrb extends WeaponBase {
  get buffs() {
    const canReact =
      this.teamMeta.hasReaction("vaporize", this.charId) ||
      this.teamMeta.hasReaction("electroCharged", this.charId) ||
      this.teamMeta.hasReaction("lunarCharged", this.charId) ||
      this.teamMeta.hasReaction("frozen", this.charId) ||
      this.teamMeta.hasReaction("bloom", this.charId) ||
      this.teamMeta.hasReaction("lunarBloom", this.charId) ||
      (this.teamMeta.elements[this.charId] === "Anemo" &&
        Object.values(this.teamMeta.elements).includes("Hydro"));

    if (!canReact) return [];
    return [
      new StatBuff(wbs(this, ["hydro-reaction"]), { receiver: "self" }, [
        { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      ]),
    ];
  }
}

@RegisterWeapon("skyrider_greatsword")
class SkyriderGreatsword extends WeaponBase {
  // 4-stack
  readonly buffs = [
    new StatBuff(wbs(this, ["on-hit"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: 4 * r(this.refinement, [0.06, 0.07, 0.08, 0.09, 0.1]),
      },
    ]),
  ];
}

@RegisterWeapon("fillet_blade")
class FilletBlade extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("halberd")
class Halberd extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("debate_club")
class DebateClub extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("messenger")
class Messenger extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("recurve_bow")
class RecurveBow extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("white_iron_greatsword")
class WhiteIronGreatsword extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("travelers_handy_sword")
class TravelersHandySword extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("otherworldly_story")
class OtherworldlyStory extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("black_tassel")
class BlackTassel extends WeaponBase {
  readonly buffs = [];
}

@RegisterWeapon("sharpshooters_oath")
class SharpshootersOath extends WeaponBase {
  readonly buffs = [];
}

const ferrousShadowOption = {
  label: { zh: "生命值状态", en: "HP State" },
  choices: [
    { value: "low", label: { zh: "生命值低于阈值", en: "HP below threshold" } },
    {
      value: "high",
      label: { zh: "生命值高于阈值", en: "HP above threshold" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("ferrous_shadow", ferrousShadowOption)
class FerrousShadow extends WeaponBase {
  private readonly o = resolveOption(ferrousShadowOption, this.option);

  get buffs() {
    if (this.o !== "low") return [];
    return [
      new StatBuff(
        wbs(this, ["self-low-hp"]),
        { receiver: "self", filter: { abilities: ["charge"] } },
        [
          {
            key: "dmg%",
            value: r(this.refinement, [0.3, 0.35, 0.4, 0.45, 0.5]),
          },
        ]
      ),
    ];
  }
}

@RegisterWeapon("twin_nephrite")
class TwinNephrite extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this, ["kill"]), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.12, 0.14, 0.16, 0.18, 0.2]),
      },
    ]),
  ];
}
