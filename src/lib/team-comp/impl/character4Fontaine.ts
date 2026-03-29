import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor } from "../types";

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

    if (this.isPyroElectroTeam && this.teamMeta.hasReaction("overloaded")) {
      // P1: After Overloaded, enemies' Pyro+Electro RES -40% for 6s
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["overloaded"]),
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
    // Requires Overloaded to obtain Overcharged Balls (fired via E Hold)
    if (this.teamMeta.hasReaction("overloaded")) {
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
    }

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

  protected readonly formulaMap = (() => {
    const tag = (ability: "skill" | "burst") =>
      ({ element: "Pyro", ability, reaction: "none" }) as const;
    return {
      // E Press: param1
      "chevreuse-e-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), tag("skill")) },
        ],
      },
      // E Hold: param2
      "chevreuse-e-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), tag("skill")) },
        ],
      },
      // C2: Hold-E hit triggers 2 chain explosions, each 120% ATK Pyro Skill DMG (once/10s)
      "chevreuse-c2-chain": {
        label: { zh: "C2连锁", en: "C2 Chain" },
        minC: 2,
        parts: [
          {
            formula: new DirectFormula(1.2, tag("skill")),
            hits: 2,
          },
        ],
      },
      // Q Explosive Grenade: param1
      "chevreuse-q-grenade": {
        label: { zh: "Q榴弹", en: "Q Grenade" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), tag("burst")) },
        ],
      },
      // Q Secondary Explosive Shell: param2 (typically 8 shells, ~4 hit single target)
      "chevreuse-q-shell": {
        label: { zh: "Q毁伤弹", en: "Q Shell" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 2), tag("burst")) },
        ],
      },
    };
  })();

  // Rotation: E press + Q (grenade + ~4 shells hitting single target); C2 chain once/10s
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "chevreuse-e-press", count: 1 },
      { id: "chevreuse-c2-chain", count: 1 },
      { id: "chevreuse-q-grenade", count: 1 },
      { id: "chevreuse-q-shell", count: 4 },
    ];
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

  protected readonly formulaMap = (() => {
    const tag = (ability: "skill" | "burst") =>
      ({ element: "Cryo", ability, reaction: "none" }) as const;
    return {
      // E Press (Framing): param1
      "charlotte-e-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), tag("skill")) },
        ],
      },
      // E Hold (Focused Impression): param2
      "charlotte-e-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), tag("skill")) },
        ],
      },
      // Q initial Skill DMG: param3
      "charlotte-q-initial": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 3), tag("burst")) },
        ],
      },
      // Q Kamera DMG tick: param6 (Newsflash Field ticks during 4s duration)
      "charlotte-q-tick": {
        label: { zh: "Q持续", en: "Q Tick" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 6), tag("burst")),
            offField: true,
          },
        ],
      },
      // C6: Coordinated attack → 180% ATK Cryo DMG as burst (once/6s)
      "charlotte-c6-coord": {
        label: { zh: "协同攻击", en: "Coordinated" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(1.8, tag("burst")),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E hold + Q (initial + ~2 ticks during 4s field); C6 coord once/6s ≈ 3 per rotation
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "charlotte-e-hold", count: 1 },
      { id: "charlotte-q-initial", count: 1 },
      { id: "charlotte-q-tick", count: 2 },
      { id: "charlotte-c6-coord", count: 3 },
    ];
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
      // Game text: "攻击力提升9%" — generic personal buff, no on-field qualifier
      if (this.constellation >= 4) {
        buffs.push(
          new StatBuff(
            cbs(this, "C4", ["frozen", "shatter", "superconduct"]),
            { receiver: "self" },
            [{ key: "atk%", value: 0.18 }]
          )
        );
      }

      // C6: After Frozen/Shatter/Superconduct, CD +12% ×3 stacks
      // Game text: "暴击伤害提升12%" — generic personal buff, no on-field qualifier
      if (this.constellation >= 6) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["frozen", "shatter", "superconduct"]),
            { receiver: "self" },
            [{ key: "cd", value: 0.36 }]
          )
        );
      }
    }
    return buffs;
  })();

  // E Lv4 Shattering Pressure (Physical): param11
  // Q initial: param1
  protected readonly formulaMap = (() => {
    return {
      "freminet-shatter-lv4": {
        label: { zh: "E四阶", en: "E Stage 4" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 11), {
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
            formula: new DirectFormula(this.param("Q", 1), {
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
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "freminet-shatter-lv4", count: 4 },
      { id: "freminet-burst", count: 1 },
    ];
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
