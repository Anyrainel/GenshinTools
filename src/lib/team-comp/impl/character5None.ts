import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarFormula,
  TransformFormula,
} from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { OptionDef } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ None Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("varka")
class Varka extends CharacterBase {
  readonly buffs = [
    // P1: Per 1000 ATK → +10% Anemo & Secondary Element (cap 25%)
    // Simplified as general DMG% to cover both.
    new ScalingBuff(
      cbs(this, "P1", ["Q"]),
      { receiver: "selfOnField" },
      [],
      "atk",
      "dmg%",
      0.0001,
      0.25
    ),
    // P1: Dual-element team gives 220% multiplier (baseDmg% +1.2) for NA/CA/E
    new StatBuff(
      cbs(this, "P1", ["team-comp"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      [{ key: "baseDmg%", value: 1.2 }]
    ),
    // P2: Swirl → +7.5% DMG per stack (max 4 = 30%)
    new StatBuff(
      cbs(this, "P2", ["swirl"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      [{ key: "dmg%", value: 0.3 }]
    ),
    // C4: Swirl → team gets 20% Anemo & Secondary (simplified as general DMG%)
    new StatBuff(
      cbs(this, "C4", ["swirl"]),
      { receiver: "team" },
      this.constellation >= 4 ? [{ key: "dmg%", value: 0.2 }] : []
    ),
    // C6: P2 stacks also give +20% CD each (max 4 = 80%)
    new StatBuff(
      cbs(this, "C6", ["swirl"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      this.constellation >= 6 ? [{ key: "cd", value: 0.8 }] : []
    ),
  ];

  // Sturm und Drang N5 (Lv10): 161.7+59.3+110.1+80.1+148.8+137.0+73.8+172.3+92.8 = 1035.9%
  // Northwind Avatar (Lv10): 606.5% + 326.6% = 933.1%
  // Northwind Avatar (Lv13 C5+): 716.0% + 385.6% = 1101.6%
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 5 ? 11.016 : 9.331;
    return {
      "varka-e-normal": {
        label: { zh: "A 狂飙突进全套连击", en: "A Sturm und Drang N5 Combo" },
        parts: [
          {
            formula: new DirectFormula(10.359, {
              element: "Anemo", // represents combined elements
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "varka-burst": {
        label: { zh: "Q 我即朔风(双重斩击)", en: "Q Northwind Avatar" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Anemo", // represents combined elements
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("skirk")
class Skirk extends CharacterBase {
  // Death's Crossing stacks: 1 per Hydro teammate + 1 per non-Skirk Cryo teammate (max 3)
  private readonly deathCrossingStacks = Math.min(
    this.teamMeta.countByElement("Hydro") +
      Math.max(0, this.teamMeta.countByElement("Cryo") - 1),
    3
  );

  // P3: +1 E level when all party members are Hydro or Cryo (≥1 of each)
  private readonly hasP3 = (() => {
    const elements = Object.values(this.teamMeta.elements).filter(
      (e) => e != null
    );
    return (
      elements.length > 0 &&
      elements.every((e) => e === "Hydro" || e === "Cryo") &&
      elements.some((e) => e === "Hydro")
    );
  })();

  readonly buffs = (() => {
    const stacks = this.deathCrossingStacks;
    const buffs: InstanceType<typeof StatBuff>[] = [];

    // P2: Normal ATK in E-mode: 110%/120%/170% of original → +10%/+20%/+70%
    // P2: Burst: 105%/115%/160% of original → +5%/+15%/+60%
    if (stacks > 0) {
      const normalPct = [0, 0.1, 0.2, 0.7][stacks];
      const burstPct = [0, 0.05, 0.15, 0.6][stacks];
      buffs.push(
        new StatBuff(
          cbs(this, "P2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [{ key: "baseDmg%", value: normalPct }]
        ),
        new StatBuff(
          cbs(this, "P2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "baseDmg%", value: burstPct }]
        )
      );
    }

    // C2: After Havoc: Extinction (E-mode Q), ATK +70% for 12.5s
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.7 },
        ])
      );
    }

    // C4: Death's Crossing also grants ATK +10%/20%/40% (total at 1/2/3 stacks)
    if (this.constellation >= 4 && stacks > 0) {
      const c4Pct = [0, 0.1, 0.2, 0.4][stacks];
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: c4Pct },
        ])
      );
    }

    return buffs;
  })();

  // E Normal Combo: 5-hit sum (Lv10/11/13/14)
  //   Lv10: 262.6+236.8+299.4+318.4+388.7 = 1505.9%
  //   Lv11 (P3): 281.1+253.5+320.6+340.8+416.1 = 1612.1%
  //   Lv13 (C5): 318.2+287.0+362.8+385.8+471.0 = 1824.8%
  //   Lv14 (C5+P3): 336.7+303.7+383.8+408.4+498.4 = 1931.0%
  // Q Burst w/ +12 Subtlety (Lv10): 5*221.0 + 368.3 + 12*34.78 = 1890.7%
  // C2 adds 10 more subtlety points (cap 22): 5*221.0 + 368.3 + 22*34.78 = 2238.5%
  // Q Burst w/ +12 Subtlety (Lv13 C3+): 5*260.9 + 434.8 + 12*41.06 = 2232.0%
  // C2+C3: 5*260.9 + 434.8 + 22*41.06 = 2642.6%
  protected readonly formulaMap = (() => {
    const hasC5 = this.constellation >= 5;
    const p3 = this.hasP3;
    // E level: base 10 (C5→13) + 1 if P3 active
    const eMult = hasC5 ? (p3 ? 19.31 : 18.248) : p3 ? 16.121 : 15.059;
    // CA: 88.1×3/94.3×3/106.7×3/112.9×3 at Lv10/11/13/14
    const eChargeMult = hasC5 ? (p3 ? 3.387 : 3.201) : p3 ? 2.829 : 2.643;
    // C2 "Into the Abyss": +10 extra subtlety points counted for Q DMG bonus (cap 22 total)
    // "施放元素爆发极恶技·灭时，提升本次元素爆发伤害的效果，至多额外计入10点蛇之狡谋"
    const hasC2 = this.constellation >= 2;
    const hasC3 = this.constellation >= 3; // C3 upgrades Q level
    const qMult = hasC3 ? (hasC2 ? 26.426 : 22.32) : hasC2 ? 22.385 : 18.907;
    return {
      "skirk-e-normal": {
        label: {
          zh: "E普攻5段",
          en: "E NA Combo (5-hit)",
        },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Cryo",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "skirk-e-charge": {
        label: {
          zh: "E七相一闪重击伤害",
          en: "Seven-Phase Flash CA DMG",
        },
        parts: [
          {
            formula: new DirectFormula(eChargeMult, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "skirk-burst": {
        label: {
          zh: "Q斩击全套",
          en: "Havoc: Ruin (Max Subtlety)",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      // C1: Each Void Rift absorbed summons a crystal blade (500% ATK Cryo, CA DMG)
      // Number of blades = deathCrossingStacks (Hydro/Cryo teammates, max 3)
      ...(this.constellation >= 1 && this.deathCrossingStacks > 0
        ? {
            "skirk-c1-blade": {
              label: {
                zh: `C1 水晶刀(×${this.deathCrossingStacks})`,
                en: `C1 Crystal Blade (×${this.deathCrossingStacks})`,
              },
              parts: [
                {
                  formula: new DirectFormula(5.0, {
                    element: "Cryo",
                    ability: "charge",
                    reaction: "none",
                  }),
                  hits: this.deathCrossingStacks,
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("aloy")
class Aloy extends CharacterBase {
  // No constellations available — collab-exclusive character
  readonly buffs = [
    // P1: Self ATK +16% when gaining Coil, other party members ATK +8% (10s)
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "selfOnField" }, [
      { key: "atk%", value: 0.16 },
    ]),
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "team" }, [
      { key: "atk%", value: 0.08 },
    ]),
    // P2: During Rushing Ice, Cryo DMG +3.5%/s for max 10s = +35%
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "selfOnField" }, [
      { key: "cryo%", value: 0.35 },
    ]),
  ];

  protected readonly formulaMap = {
    "aloy-burst": {
      label: { zh: "Q 元素爆发", en: "Q Prophecies of Dawn" },
      parts: [
        {
          formula: new DirectFormula(6.47, {
            element: "Cryo",
            ability: "burst",
            reaction: "none",
          }),
        },
      ],
    },
  };
}

// Traveler (Anemo)
// P3 cross-resonance: Anemo resonance -> self +10% CRIT Rate
// C6: Enemies hit by Gust Surge have Anemo/absorbed element RES -20%
@RegisterCharacter("traveler_anemo")
class TravelerAnemo extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P3 cross-resonance: Anemo resonance -> +10% CRIT Rate (self)
      new StatBuff(cbs(this, "P3", ["passive"]), { receiver: "self" }, [
        { key: "cr", value: 0.1 },
      ]),
      // C6: Enemies hit by Gust Surge have Anemo RES -20%
      new StatBuff(
        cbs(this, "C6", ["Q"]),
        { receiver: "team", filter: { elements: ["Anemo"] } },
        this.constellation >= 6 ? [{ key: "resReduction%", value: 0.2 }] : []
      ),
    ];
    // C6: Absorbed element also gets -20% RES (S10 pattern)
    if (this.constellation >= 6) {
      const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
      const teamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of absorbElements) {
        if (!teamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: [el] } },
            [{ key: "resReduction%", value: 0.2 }]
          )
        );
      }
    }
    return buffs;
  })();

  // Q Gust Surge: 8 ticks x 145% = 1160% Anemo DMG (Lv10)
  // Q Gust Surge (C3+, Lv13): 8 ticks x 172% = 1376%
  // Q Absorbed element: 8 ticks x 33.84% (Lv10) / 40.17% (Lv13 C3+)
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 3 ? 13.76 : 11.6;
    const absorbTickMult = this.constellation >= 3 ? 0.4017 : 0.3384;
    const absorbTotal = absorbTickMult * 8;
    const anemoBurst = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    const formulas: Record<string, FormulaEntry> = {
      "traveler-anemo-burst": {
        label: { zh: "Q 风息激荡（8次）", en: "Q Gust Surge (8 hits)" },
        parts: [{ formula: new DirectFormula(qMult, anemoBurst) }],
      },
    };
    // Add absorbed-element variant formulas (S10 pattern)
    const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
    const teamEls = new Set(Object.values(this.teamMeta.elements));
    for (const el of absorbElements) {
      if (!teamEls.has(el)) continue;
      formulas[`traveler-anemo-burst-${el.toLowerCase()}`] = {
        label: {
          zh: `Q风+吸收(${el})`,
          en: `Q Gust + Absorbed (${el})`,
        },
        parts: [
          { formula: new DirectFormula(qMult, anemoBurst) },
          {
            formula: new DirectFormula(absorbTotal, {
              element: el,
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      };
    }
    return formulas;
  })();
}

// Traveler (Geo)
// P3 cross-resonance: Geo resonance -> self +20% DEF
// C1: Party within Wake of Earth gets +10% CRIT Rate
@RegisterCharacter("traveler_geo")
class TravelerGeo extends CharacterBase {
  readonly buffs = [
    // P3 cross-resonance: Geo resonance -> +20% DEF (self)
    new StatBuff(cbs(this, "P3", ["passive"]), { receiver: "self" }, [
      { key: "def%", value: 0.2 },
    ]),
    // C1: Inside Wake of Earth, party CRIT Rate +10%
    new StatBuff(
      cbs(this, "C1", ["Q"]),
      { receiver: "team" },
      this.constellation >= 1 ? [{ key: "cr", value: 0.1 }] : []
    ),
  ];

  // E Starfell Sword: 446% Geo DMG (Lv10), 527% (Lv13 C5+)
  // Q Wake of Earth: 266% x 4 shockwaves = 1064% (Lv10), 314% x 4 = 1256% (Lv13 C3+)
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 5.27 : 4.46;
    const qMult = this.constellation >= 3 ? 12.56 : 10.64;
    return {
      "traveler-geo-skill": {
        label: { zh: "E 星陨剑", en: "E Starfell Sword" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Geo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-geo-burst": {
        label: {
          zh: "Q 岩潮叠嶂（4次）",
          en: "Q Wake of Earth (4 shockwaves)",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Geo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

// Traveler (Electro)
// E: Abundance Amulets grant ER +20% to absorbing party members
// P3 cross-resonance: Electro resonance -> self +20% ER
// C2: Falling Thunder hits -> enemies Electro RES -15%
@RegisterCharacter("traveler_electro")
class TravelerElectro extends CharacterBase {
  readonly buffs = [
    // E: Abundance Amulets grant ER +20% to absorbing characters (team utility)
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "team" }, [
      { key: "er", value: 0.2 },
    ]),
    // P3 cross-resonance: Electro resonance -> +20% ER (self)
    new StatBuff(cbs(this, "P3", ["passive"]), { receiver: "self" }, [
      { key: "er", value: 0.2 },
    ]),
    // C2: Falling Thunder hits -> Electro RES -15% for 8s
    new StatBuff(
      cbs(this, "C2", ["Q"]),
      { receiver: "team", filter: { elements: ["Electro"] } },
      this.constellation >= 2 ? [{ key: "resReduction%", value: 0.15 }] : []
    ),
  ];

  // E Lightning Blade: 3 x 142% = 426% Electro DMG (Lv10), 3 x 167% = 501% (Lv13 C5+)
  // Q Bellowing Thunder: 205.9% initial + 12 Falling Thunder x 59% = 914.9% (Lv10)
  // Q (C3+, Lv13): 243.1% initial + 12 x 69.7% = 1079.5%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 5.01 : 4.26;
    const qInitial = this.constellation >= 3 ? 2.431 : 2.059;
    const qTick = this.constellation >= 3 ? 0.697 : 0.59;
    const qMult = qInitial + 12 * qTick;
    return {
      "traveler-electro-skill": {
        label: { zh: "E 雷影剑（3刀）", en: "E Lightning Blade (3 hits)" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-electro-burst": {
        label: {
          zh: "Q+落雷×12",
          en: "Q + 12 Falling Thunder",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

// Traveler (Dendro)
// P1: Lea Lotus Lamp grants on-field character EM +6/s, max 10 stacks = +60 EM
// P2: Every point of Traveler's EM -> E DMG +0.15%, Q DMG +0.1%
// P3 cross-resonance: Dendro resonance -> self +60 EM
// C6: Lotuslight Transfiguration → +12% DMG for corresponding element
@RegisterCharacter("traveler_dendro")
class TravelerDendro extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Lea Lotus Lamp - Overflowing Lotuslight (max 10 stacks) -> on-field char +60 EM
      new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "onField" }, [
        { key: "em", value: 60 },
      ]),
      // P2: Verdant Luxury — Traveler's own EM boosts E DMG by 0.15% per EM point
      new ScalingBuff(
        cbs(this, "P2", ["A4"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "em",
        "dmg%",
        0.0015
      ),
      // P2: Verdant Luxury — Traveler's own EM boosts Q DMG by 0.1% per EM point
      new ScalingBuff(
        cbs(this, "P2", ["A4"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "em",
        "dmg%",
        0.001
      ),
      // P3 cross-resonance: Dendro resonance -> +60 EM (self)
      new StatBuff(cbs(this, "P3", ["passive"]), { receiver: "self" }, [
        { key: "em", value: 60 },
      ]),
      // C6: Lotuslight Transfiguration → +12% DMG for corresponding element
      // Base Dendro (when no transfiguration occurs)
      new StatBuff(
        cbs(this, "C6", ["Q"]),
        { receiver: "onField", filter: { elements: ["Dendro"] } },
        this.constellation >= 6 ? [{ key: "dmg%", value: 0.12 }] : []
      ),
    ];
    // C6: Transfigured element also gets +12% DMG (S10 pattern: Hydro/Electro/Pyro)
    if (this.constellation >= 6) {
      const transfigElements = ["Hydro", "Electro", "Pyro"] as const;
      const teamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of transfigElements) {
        if (!teamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "onField", filter: { elements: [el] } },
            [{ key: "dmg%", value: 0.12 }]
          )
        );
      }
    }
    return buffs;
  })();

  // E Razorgrass Blade: 415% Dendro (Lv10), 490% (Lv13 C3+)
  // Q Lea Lotus Lamp: 144.3% x 12 ticks = 1731.6% (Lv10), 170.3% x 12 = 2043.6% (Lv13 C5+)
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.9 : 4.15;
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: game talent multiplier, not Math.LOG2E
    const qTickMult = this.constellation >= 5 ? 1.703 : 1.443;
    const qMult = qTickMult * 12;
    return {
      "traveler-dendro-skill": {
        label: { zh: "E 草缘剑", en: "E Razorgrass Blade" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-dendro-burst": {
        label: {
          zh: "Q+草灯×12",
          en: "Q + Lamp (×12)",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

// Traveler (Hydro)
// P3 cross-resonance: Hydro resonance -> self +20% HP
// Primarily a self-sustain / utility character - no notable team buff passives
@RegisterCharacter("traveler_hydro")
class TravelerHydro extends CharacterBase {
  readonly buffs = [
    // P3 cross-resonance: Hydro resonance -> +20% HP (self)
    new StatBuff(cbs(this, "P3", ["passive"]), { receiver: "self" }, [
      { key: "hp%", value: 0.2 },
    ]),
  ];

  // E Aquacrest Saber (Torrent Surge): 340.7% Hydro (Lv10), 402.2% (Lv13 C3+)
  // Q Rising Waters: 183.4% x 4 ticks = 733.6% (Lv10), 216.5% x 4 = 866% (Lv13 C5+)
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.022 : 3.407;
    const qTickMult = this.constellation >= 5 ? 2.165 : 1.834;
    const qMult = qTickMult * 4;
    return {
      "traveler-hydro-skill": {
        label: {
          zh: "E喷发激流",
          en: "E Torrent Surge",
        },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-hydro-burst": {
        label: { zh: "Q 扬水制流（x4）", en: "Q Rising Waters (x4 ticks)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

// Traveler (Pyro)
// C1: While Blazing/Scorching Threshold active, on-field character deals +6% DMG
// P3 cross-resonance: Pyro resonance -> self +20% ATK
// C4: After Q Plains Scorcher, self +20% Pyro DMG% for 9s
@RegisterCharacter("traveler_pyro")
class TravelerPyro extends CharacterBase {
  readonly buffs = [
    // P3 cross-resonance: Pyro resonance -> +20% ATK (self)
    new StatBuff(cbs(this, "P3", ["passive"]), { receiver: "self" }, [
      { key: "atk%", value: 0.2 },
    ]),
    // C1: While Threshold active, on-field character deals +6% DMG
    new StatBuff(
      cbs(this, "C1", ["E"]),
      { receiver: "onField" },
      this.constellation >= 1 ? [{ key: "dmg%", value: 0.06 }] : []
    ),
    // C4: After Q, self +20% Pyro DMG Bonus (火元素伤害加成)
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "selfOnField" },
      this.constellation >= 4 ? [{ key: "pyro%", value: 0.2 }] : []
    ),
  ];

  // E Flowfire Blade (Blazing Threshold): 50.5% x 12 hits = 606% (Lv10), 59.7% x 12 = 716.4% (Lv13 C3+)
  // Q Plains Scorcher: 769% Nightsoul-Pyro (Lv10), 907.8% (Lv13 C5+)
  protected readonly formulaMap = (() => {
    const eTickMult = this.constellation >= 3 ? 0.597 : 0.505;
    const eMult = eTickMult * 12;
    const qMult = this.constellation >= 5 ? 9.078 : 7.69;
    return {
      "traveler-pyro-skill": {
        label: {
          zh: "E+焰槛×12",
          en: "E Blazing Threshold (×12)",
        },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-pyro-burst": {
        label: { zh: "Q 灼火燎原", en: "Q Plains Scorcher" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}
