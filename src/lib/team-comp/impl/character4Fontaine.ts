import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Fontaine Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("chevreuse")
class Chevreuse extends CharacterBase {
  // P1 requires all team members to be Pyro or Electro
  private readonly isPyroElectroTeam = Object.values(
    this.teamMeta.elements
  ).every((el) => el === "Pyro" || el === "Electro");

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    if (this.isPyroElectroTeam) {
      // P1: After Overloaded, enemies' Pyro+Electro RES -40% for 6s
      buffs.push(
        new StatBuff(
          cbs(this, "P1", []),
          {
            receiver: "team",
            filter: { elements: ["Pyro", "Electro"] },
          },
          [{ key: "resReduction%", value: 0.4 }]
        )
      );
    }

    // P2: Per 1000 Max HP → Pyro/Electro team ATK +1% (cap 40%)
    buffs.push(
      new ScalingBuff(
        cbs(this, "P2", ["E"]),
        { receiver: "team" },
        [],
        "hp",
        "atk%",
        0.00001,
        0.4
      )
    );

    // C6: After E heal, Pyro/Electro DMG +20% per stack (max 3 = 60%)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          {
            receiver: "team",
            filter: { elements: ["Pyro", "Electro"] },
          },
          [{ key: "dmg%", value: 0.6 }]
        )
      );
    }

    return buffs;
  })();

  protected readonly formulaMap = {};
}

@RegisterCharacter("charlotte")
class Charlotte extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    // P2: Non-Fontaine teammates → Cryo DMG bonus (5%/10%/15%)
    const nonFontaine = this.teamMeta.characters.filter(
      (id) => id !== this.charId && this.teamMeta.regions[id] !== "Fontaine"
    ).length;
    if (nonFontaine > 0) {
      buffs.push(
        new StatBuff(cbs(this, "P2", []), { receiver: "selfOnField" }, [
          { key: "cryo%", value: Math.min(nonFontaine, 3) * 0.05 },
        ])
      );
    }
    // C2: After E hit, self ATK +10%/20%/30% based on enemies hit (assume 1)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
          { key: "atk%", value: 0.1 },
        ])
      );
    }
    return buffs;
  })();

  // Healer — no significant damage formulas
  protected readonly formulaMap = {};
}

@RegisterCharacter("freminet")
class Freminet extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    const canShatter = this.teamMeta.hasReaction("shatter");
    const canC4C6 =
      canShatter ||
      this.teamMeta.hasReaction("frozen") ||
      this.teamMeta.hasReaction("superconduct");

    if (canShatter) {
      // P2: After Shatter, E Shattering Pressure DMG +40%
      buffs.push(
        new StatBuff(
          cbs(this, "P2", ["shatter"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }

    // C1: E Shattering Pressure CR +15%
    buffs.push(
      new StatBuff(
        cbs(this, "C1", []),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        this.constellation >= 1 ? [{ key: "cr", value: 0.15 }] : []
      )
    );

    if (canC4C6) {
      // C4: After Frozen/Shatter/Superconduct, ATK +9% ×2 stacks
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["frozen", "shatter", "superconduct"]),
          { receiver: "selfOnField" },
          this.constellation >= 4 ? [{ key: "atk%", value: 0.18 }] : []
        )
      );

      // C6: After Frozen/Shatter/Superconduct, CD +12% ×3 stacks
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["frozen", "shatter", "superconduct"]),
          { receiver: "selfOnField" },
          this.constellation >= 6 ? [{ key: "cd", value: 0.36 }] : []
        )
      );
    }
    return buffs;
  })();

  // E Lv4 Shattering Pressure (Physical): Lv10 438.2%, Lv13 (C5+) 517.3%
  // Q initial: Lv10 573.1% (no constellation level boost for Q)
  protected readonly formulaMap = (() => {
    const eLv4Mult = this.constellation >= 5 ? 5.173 : 4.382;
    return {
      "freminet-shatter-lv4": {
        label: { zh: "四阶高压粉碎", en: "Lv4 Shattering Pressure" },
        parts: [
          {
            formula: new DirectFormula(eLv4Mult, {
              element: "Physical",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "freminet-burst": {
        label: { zh: "猎影潜袭", en: "Shadowhunter's Ambush" },
        parts: [
          {
            formula: new DirectFormula(5.731, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("lynette")
class Lynette extends CharacterBase {
  readonly buffs = [
    // P1: After Q, team ATK% based on # element types (assume 4 = 20%)
    new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "team" }, [
      { key: "atk%", value: 0.2 },
    ]),
    // P2: After Q absorption, self Q DMG +15%
    new StatBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [{ key: "dmg%", value: 0.15 }]
    ),
    // C6: After E, self Anemo DMG +20%
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField" },
      this.constellation >= 6 ? [{ key: "anemo%", value: 0.2 }] : []
    ),
  ];

  // Anemo support — no damage formulas modeled
  protected readonly formulaMap = {};
}
