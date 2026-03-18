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

    // P2: Per 1000 Max HP → Pyro/Electro party members ATK +1% (cap 40%)
    // Only benefits Pyro and Electro characters per game text
    buffs.push(
      new ScalingBuff(
        cbs(this, "P2", ["E"]),
        { receiver: "team", filter: { elements: ["Pyro", "Electro"] } },
        [],
        "hp",
        "atk%",
        0.00001,
        0.4
      )
    );

    // C6: After E heal, team Pyro DMG +60% and Electro DMG +60% (20% × 3 stacks)
    // Game text: "20%火元素伤害加成与雷元素伤害加成" → element-specific keys
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["E"]), { receiver: "team" }, [
          { key: "pyro%", value: 0.6 },
          { key: "electro%", value: 0.6 },
        ])
      );
    }

    return buffs;
  })();

  // C2: Hold-E hit triggers 2 chain explosions, each 120% ATK Pyro Skill DMG (once/10s)
  // Per-instance damage is fully known → add formula; "once/10s" frequency is irrelevant
  // to per-hit optimization (Q1 of decision tree).
  protected readonly formulaMap = (() => ({
    ...(this.constellation >= 2
      ? {
          "chevreuse-c2-chain": {
            label: {
              zh: "2命 E伤害",
              en: "C2 E",
            },
            parts: [
              {
                formula: new DirectFormula(1.2, {
                  element: "Pyro",
                  ability: "skill",
                  reaction: "none",
                }),
                hits: 2,
              },
            ],
          },
        }
      : {}),
  }))();

  // Rotation: E once per rotation (pure support); C2 chain triggers once/10s
  protected override get defaultRotation() {
    return { "chevreuse-c2-chain": 1 };
  }
}

@RegisterCharacter("charlotte")
class Charlotte extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    // P2: Per non-Fontaine party member → Charlotte's own Cryo DMG +5% (max 15%)
    // No on-field condition in game text — "夏洛蒂自己" is a generic personal buff
    const nonFontaine = this.teamMeta.characters.filter(
      (id) => id !== this.charId && this.teamMeta.regions[id] !== "Fontaine"
    ).length;
    if (nonFontaine > 0) {
      buffs.push(
        new StatBuff(cbs(this, "P2", []), { receiver: "self" }, [
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
    // C4: Q hitting marked enemies → Q DMG +10%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.1 }]
        )
      );
    }
    return buffs;
  })();

  // C6: Active character NA/CA hitting Focused Impression enemy triggers coordinated attack
  // → 180% ATK Cryo DMG counted as Elemental Burst (once/6s).
  // Per-instance damage is fully known → add formula; "once/6s" frequency is irrelevant
  // to per-hit optimization (Q1 of decision tree).
  protected readonly formulaMap = (() => ({
    ...(this.constellation >= 6
      ? {
          "charlotte-c6-coord": {
            label: {
              zh: "6命 协同攻击",
              en: "C6 Coordinated",
            },
            parts: [
              {
                formula: new DirectFormula(1.8, {
                  element: "Cryo",
                  ability: "burst",
                  reaction: "none",
                }),
              },
            ],
          },
        }
      : {}),
  }))();

  // Rotation: E + Q (healer/support); C6 coord triggers once/6s ≈ 3 per ~20s rotation
  protected override get defaultRotation() {
    return { "charlotte-c6-coord": 3 };
  }
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
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", []),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cr", value: 0.15 }]
        )
      );
    }

    if (canC4C6) {
      // C4: After Frozen/Shatter/Superconduct, ATK +9% ×2 stacks
      if (this.constellation >= 4) {
        buffs.push(
          new StatBuff(
            cbs(this, "C4", ["frozen", "shatter", "superconduct"]),
            { receiver: "selfOnField" },
            [{ key: "atk%", value: 0.18 }]
          )
        );
      }

      // C6: After Frozen/Shatter/Superconduct, CD +12% ×3 stacks
      if (this.constellation >= 6) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["frozen", "shatter", "superconduct"]),
            { receiver: "selfOnField" },
            [{ key: "cd", value: 0.36 }]
          )
        );
      }
    }
    return buffs;
  })();

  // E Lv4 Shattering Pressure (Physical): Lv10 438.2%, Lv13 (C5+) 517.3%
  // Q initial: Lv10 573.1% (no constellation level boost for Q)
  protected readonly formulaMap = (() => {
    const eLv4Mult = this.constellation >= 5 ? 5.173 : 4.382;
    return {
      "freminet-shatter-lv4": {
        label: { zh: "E四阶", en: "E Stage 4" },
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
        label: { zh: "Q伤害", en: "Q" },
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

  // Rotation: EQ N2E 3[EN2E] — 4× Lv4 Shattering Pressure + Q (physical carry, KQM)
  protected override get defaultRotation() {
    return { "freminet-shatter-lv4": 4, "freminet-burst": 1 };
  }
}

@RegisterCharacter("lynette")
class Lynette extends CharacterBase {
  // P2 requires Bogglecat Box to absorb an element (Hydro/Pyro/Cryo/Electro)
  private readonly hasAbsorbableElement = Object.values(
    this.teamMeta.elements
  ).some(
    (el) => el === "Hydro" || el === "Pyro" || el === "Cryo" || el === "Electro"
  );

  readonly buffs = [
    // P1: After Q, team ATK% based on # element types: 1→8%, 2→12%, 3→16%, 4→20%
    new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "team" }, [
      {
        key: "atk%",
        value:
          [0, 0.08, 0.12, 0.16, 0.2][
            new Set(Object.values(this.teamMeta.elements)).size
          ] ?? 0.2,
      },
    ]),
    // P2: After Q absorption, self Q DMG +15%
    // Game text: lasts until Bogglecat Box expires — includes off-field summon hits
    // Only active when team has Hydro/Pyro/Cryo/Electro for absorption to occur
    ...(this.hasAbsorbableElement
      ? [
          new StatBuff(
            cbs(this, "P2", ["Q"]),
            { receiver: "self", filter: { abilities: ["burst"] } },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : []),
    // C6: After E, self Anemo DMG +20% for 6s
    // Game text: no on-field qualifier — generic personal buff
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["E"]), { receiver: "self" }, [
            { key: "anemo%", value: 0.2 },
          ]),
        ]
      : []),
  ];

  // Anemo support — no damage formulas modeled
  protected readonly formulaMap = {};
}
